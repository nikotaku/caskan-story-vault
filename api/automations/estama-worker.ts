import {
  syncEstamaShiftBatch,
  type EstamaShiftBatchInput,
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

const SUPABASE_URL = "https://imrxzkivwrkqbhqfbbes.supabase.co";
const PUBLISHABLE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";

const stringValue = (value: unknown) => typeof value === "string" ? value : "";

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
  try {
    const body = req.body || {};
    const token = stringValue(body.token);
    if (!await claimToken(token)) {
      res.status(401).json({ error: "同期用トークンが無効または使用済みです" });
      return;
    }

    const input: EstamaShiftBatchInput = {
      storeId: stringValue(body.storeId),
      contextId: stringValue(body.contextId),
      configuration: body.configuration && typeof body.configuration === "object"
        ? body.configuration as Record<string, unknown>
        : {},
      items: parseItems(body.items),
      onResult: reportResult,
    };
    if (!input.storeId || !input.contextId || !input.items.length) {
      throw new Error("同期対象データが不足しています");
    }

    console.log(JSON.stringify({
      level: "info",
      msg: "estama_shift_worker_start",
      storeId: input.storeId,
      itemCount: input.items.length,
    }));
    const result = await syncEstamaShiftBatch(input);
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
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      level: "error",
      msg: "estama_shift_worker_failed",
      error: message,
      ms: Date.now() - startedAt,
    }));
    res.status(500).json({ error: message });
  }
}
