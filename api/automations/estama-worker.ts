import { createHash, randomBytes } from "node:crypto";
import {
  EstamaContextBusyError,
  getAdminClient,
  syncEstamaShiftBatch,
  type EstamaShiftBatchInput,
  type EstamaShiftEvidenceReport,
  type EstamaShiftBatchItem,
  type EstamaShiftBatchResult,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = { method?: string; body?: Record<string, unknown> };
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type WorkerContinuation = {
  token: string;
  payload: Record<string, unknown>;
};

const SUPABASE_URL = "https://imrxzkivwrkqbhqfbbes.supabase.co";
const PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";

const stringValue = (value: unknown) => typeof value === "string" ? value : "";

async function redispatchAfterContextBusy(body: Record<string, unknown>) {
  const retryCount = Math.max(0, Math.trunc(Number(body.contextRetry) || 0));
  if (retryCount >= 5) return null;

  const admin = getAdminClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error: tokenError } = await admin.from("estama_sync_tokens").insert({
    token_hash: tokenHash,
    purpose: "worker",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (tokenError) throw tokenError;

  await new Promise((resolve) => setTimeout(resolve, 15_000));
  const payload = { ...body, token, contextRetry: retryCount + 1 };
  const { data: requestId, error: dispatchError } = await admin.rpc(
    "dispatch_estama_worker_request",
    { p_payload: payload },
  );
  if (dispatchError) throw dispatchError;
  if (!requestId) throw new Error("競合解消後のシフト同期を再開できませんでした");
  return { requestId, retryCount: retryCount + 1 };
}

async function claimToken(token: string) {
  if (!token || token.length < 48) return false;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_estama_worker_token`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`同期用トークンを確認できませんでした (${response.status}): ${detail.slice(0, 300)}`);
  }
  return await response.json() === true;
}

async function reportResult(token: string, result: EstamaShiftBatchResult) {
  if (!token || token.length < 48) throw new Error("同期結果トークンがありません");
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/report_estama_shift_result`, {
        method: "POST",
        headers: {
          apikey: PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_token: token,
          p_job_id: result.jobId,
          p_result: result,
        }),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`同期結果の保存に失敗しました (${response.status}): ${body.slice(0, 300)}`);
      if (JSON.parse(body) !== true) throw new Error("同期結果トークンが無効または使用済みです");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(lastError || "同期結果を保存できませんでした");
}

async function notifyEvidence(token: string, report: EstamaShiftEvidenceReport) {
  if (!token || token.length < 48) throw new Error("同期履歴保存用トークンがありません");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/notify-estama-shift-sync`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notificationToken: token, report }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`公開確認結果の保存に失敗しました (${response.status}): ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : { success: true };
}

async function dispatchContinuation(continuation: WorkerContinuation) {
  if (!continuation.token || continuation.token.length < 48) {
    throw new Error("次の同期バッチ用トークンがありません");
  }
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/dispatch_estama_worker_continuation`,
        {
          method: "POST",
          headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ p_token: continuation.token, p_payload: continuation.payload }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`次の同期バッチを開始できません (${response.status}): ${body.slice(0, 300)}`);
      }
      const requestId = JSON.parse(body);
      if (!requestId) throw new Error("次の同期バッチの受付番号を取得できませんでした");
      return requestId;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw new Error(lastError || "次の同期バッチを開始できませんでした");
}

function parseItems(value: unknown): EstamaShiftBatchItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 60).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const action: EstamaShiftBatchItem["action"] = row.action === "delete" ? "delete" : "upsert";
    return {
      jobId: stringValue(row.jobId),
      shiftId: stringValue(row.shiftId),
      castId: stringValue(row.castId),
      castName: stringValue(row.castName),
      externalId: stringValue(row.externalId) || null,
      remoteName: stringValue(row.remoteName) || null,
      reportToken: stringValue(row.reportToken),
      action,
      shiftDate: stringValue(row.shiftDate).slice(0, 10),
      startTime: stringValue(row.startTime).slice(0, 8),
      endTime: stringValue(row.endTime).slice(0, 8),
    };
  }).filter((item) =>
    item.jobId && item.shiftId && item.castId && item.castName && item.shiftDate && item.reportToken
    && (item.action === "delete" || (item.startTime && item.endTime))
  );
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const startedAt = Date.now();
  let notificationAttempted = false;
  let notificationToken = "";
  let storeId = "";
  let shopId = "";
  let continuation: WorkerContinuation | null = null;
  let continuationAttempted = false;
  let parsedItems: EstamaShiftBatchItem[] = [];
  const reportedResults = new Map<string, EstamaShiftBatchResult>();
  try {
    const body = req.body || {};
    const token = stringValue(body.token);
    notificationToken = stringValue(body.notificationToken);
    storeId = stringValue(body.storeId);
    shopId = stringValue(body.shopId);
    const continuationValue = body.continuation && typeof body.continuation === "object"
      ? body.continuation as Record<string, unknown>
      : null;
    if (continuationValue) {
      const payload = continuationValue.payload && typeof continuationValue.payload === "object"
        ? continuationValue.payload as Record<string, unknown>
        : null;
      if (payload) {
        continuation = { token: stringValue(continuationValue.token), payload };
      }
    }
    if (!await claimToken(token)) {
      res.status(401).json({ error: "同期用トークンが無効または使用済みです" });
      return;
    }

    parsedItems = parseItems(body.items);
    const input: EstamaShiftBatchInput = {
      storeId,
      shopId,
      contextId: stringValue(body.contextId),
      configuration: body.configuration && typeof body.configuration === "object"
        ? body.configuration as Record<string, unknown>
        : {},
      items: parsedItems,
      missingProfiles: Array.isArray(body.missingProfiles)
        ? body.missingProfiles.filter((item): item is string => typeof item === "string").slice(0, 30)
        : [],
      onResult: async (result, reportToken) => {
        await reportResult(reportToken, result);
        reportedResults.set(result.jobId, result);
      },
      onEvidence: async (report) => {
        notificationAttempted = true;
        await notifyEvidence(notificationToken, report);
      },
    };
    if (!input.storeId || !input.shopId || !input.contextId || !input.items.length || !notificationToken) {
      throw new Error("同期対象データが不足しています");
    }

    console.log(JSON.stringify({
      level: "info",
      msg: "estama_shift_worker_start",
      storeId: input.storeId,
      itemCount: input.items.length,
    }));
    const result = await syncEstamaShiftBatch(input);
    if (continuation) {
      continuationAttempted = true;
      await dispatchContinuation(continuation);
    }
    console.log(JSON.stringify({
      level: "info",
      msg: "estama_shift_worker_done",
      storeId: input.storeId,
      itemCount: input.items.length,
      succeeded: result.results.filter((item) => item.ok).length,
      failed: result.results.filter((item) => !item.ok).length,
      ms: Date.now() - startedAt,
    }));
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof EstamaContextBusyError) {
      try {
        const redispatched = await redispatchAfterContextBusy(req.body || {});
        if (redispatched) {
          console.warn(JSON.stringify({
            level: "warning",
            msg: "estama_shift_worker_deferred_for_context",
            storeId,
            ...redispatched,
          }));
          res.status(202).json({
            ok: true,
            deferred: true,
            reason: error.message,
            ...redispatched,
          });
          return;
        }
      } catch (redispatchError) {
        console.error(JSON.stringify({
          level: "error",
          msg: "estama_shift_worker_redispatch_failed",
          storeId,
          error: redispatchError instanceof Error ? redispatchError.message : String(redispatchError),
        }));
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    const fatalResults: EstamaShiftBatchResult[] = [...reportedResults.values()];
    for (const item of parsedItems) {
      if (reportedResults.has(item.jobId)) continue;
      const result: EstamaShiftBatchResult = {
        jobId: item.jobId,
        shiftId: item.shiftId,
        castId: item.castId,
        castName: item.castName,
        action: item.action,
        shiftDate: item.shiftDate,
        startTime: item.startTime,
        endTime: item.endTime,
        ok: false,
        publicVerified: false,
        publicUrl: item.externalId && shopId
          ? `https://estama.jp/shop/${encodeURIComponent(shopId)}/cast/${encodeURIComponent(item.externalId)}/`
          : undefined,
        error: `同期処理中断: ${message}`,
      };
      try {
        await reportResult(item.reportToken, result);
        reportedResults.set(item.jobId, result);
      } catch (reportError) {
        console.error(JSON.stringify({
          level: "error",
          msg: "estama_shift_fatal_item_report_failed",
          jobId: item.jobId,
          error: reportError instanceof Error ? reportError.message : String(reportError),
        }));
      }
      fatalResults.push(result);
    }
    if (!notificationAttempted && notificationToken && storeId) {
      notificationAttempted = true;
      try {
        await notifyEvidence(notificationToken, {
          storeId,
          shopId,
          sessionId: "",
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date().toISOString(),
          results: fatalResults,
          evidence: [],
          fatalError: message,
        });
      } catch (notifyError) {
        console.error(JSON.stringify({
          level: "error",
          msg: "estama_shift_fatal_notification_failed",
          error: notifyError instanceof Error ? notifyError.message : String(notifyError),
        }));
      }
    }
    if (continuation && !continuationAttempted) {
      continuationAttempted = true;
      try {
        await dispatchContinuation(continuation);
      } catch (continuationError) {
        console.error(JSON.stringify({
          level: "error",
          msg: "estama_shift_continuation_failed",
          error: continuationError instanceof Error ? continuationError.message : String(continuationError),
        }));
      }
    }
    console.error(JSON.stringify({
      level: "error",
      msg: "estama_shift_worker_failed",
      error: message,
      ms: Date.now() - startedAt,
    }));
    res.status(500).json({ error: message });
  }
}
