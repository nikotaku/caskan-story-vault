import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LoginRequiredError,
  refreshEstamaAvailability,
  type EstamaAvailabilityRefreshResult,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = {
  method?: string;
  body?: unknown;
};
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type ConnectionRow = {
  id: string;
  store_id: string;
  status: string;
  browserbase_context_id: string | null;
  setup_session_id: string | null;
  shop_id: string | null;
  configuration: Record<string, unknown> | null;
};

type ClaimedRun = {
  runToken: string;
  connections: ConnectionRow[];
  deferredCount: number;
  unavailableCount: number;
};

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || "https://imrxzkivwrkqbhqfbbes.supabase.co";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";

const formatJst = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value));

const resultItems = (result: EstamaAvailabilityRefreshResult) => result.castNames.map((castName) => ({
  kind: "availability_refresh",
  castName,
  ok: true,
  active: true,
  validUntil: result.validUntil,
}));

function buildSuccessSummary(result: EstamaAvailabilityRefreshResult, finishedAt: string) {
  if (result.deferred) {
    return [
      "⚠️ エスたま ご案内状況の更新を延期",
      `実行: ${formatJst(finishedAt)}`,
      "別のエスたま同期が実行中だったため、同時操作を避けました。",
      "次回の毎時実行で自動再試行します。",
    ].join("\n");
  }
  if (!result.updated) {
    return [
      "✅ エスたま ご案内状況を確認",
      `実行: ${formatJst(finishedAt)}`,
      result.confirmation,
      "次回は1時間後に自動確認します。",
    ].join("\n");
  }

  return [
    "✅ エスたま ご案内状況を自動更新",
    `実行: ${formatJst(finishedAt)}`,
    "表示: ◎今すぐご案内可",
    `今すぐ案内: ${result.availableNowCount}名${result.castNames.length ? `（${result.castNames.join("、")}）` : ""}`,
    ...(result.manualPreservedCount > 0
      ? [`手動設定を維持: ${result.manualPreservedCount}名`]
      : []),
    result.validUntil ? `表示期限: ${result.validUntil}` : result.confirmation,
    "次回は1時間後に自動更新します。",
  ].join("\n");
}

const buildFailureSummary = (error: string, finishedAt: string, loginRequired: boolean) => [
  "⚠️ エスたま ご案内状況の自動更新に失敗",
  `実行: ${formatJst(finishedAt)}`,
  `原因: ${error.replace(/\s+/g, " ").slice(0, 500)}`,
  loginRequired
    ? "エスたま連携画面から再ログインしてください。再ログイン後に自動更新を再開します。"
    : "次回は1時間後に自動再試行します。",
].join("\n");

function createPublicClient() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function saveResult(
  client: SupabaseClient,
  runToken: string,
  storeId: string,
  payload: Record<string, unknown>,
) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await client.rpc("save_estama_availability_result", {
      p_run_token: runToken,
      p_store_id: storeId,
      p_payload: payload,
    });
    if (!error && data === true) return;
    lastError = error?.message || "実行トークンが無効、または実行履歴が見つかりません";
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw new Error(`ご案内状況の実行履歴を保存できません: ${lastError}`);
}

function successPayload(
  result: EstamaAvailabilityRefreshResult,
  startedAt: string,
  finishedAt: string,
) {
  const items = resultItems(result);
  return {
    reportStatus: result.deferred ? "warning" : "success",
    startedAt,
    finishedAt,
    totalCount: items.length,
    successCount: items.length,
    castNames: result.castNames,
    summary: buildSuccessSummary(result, finishedAt),
    results: items,
    fatalError: null,
    configuration: {
      status: result.deferred ? "deferred" : result.updated ? "success" : "skipped",
      last_run_at: finishedAt,
      active_count: result.activeCount,
      available_now_count: result.availableNowCount,
      cast_names: result.castNames,
      valid_until: result.validUntil,
      updated: result.updated,
      ...(result.updated ? { last_success_at: finishedAt } : {}),
    },
  };
}

function failurePayload(
  errorMessage: string,
  loginRequired: boolean,
  startedAt: string,
  finishedAt: string,
) {
  return {
    reportStatus: "error",
    startedAt,
    finishedAt,
    totalCount: 0,
    successCount: 0,
    castNames: [],
    summary: buildFailureSummary(errorMessage, finishedAt, loginRequired),
    results: [],
    fatalError: errorMessage.slice(0, 1_000),
    configuration: {
      status: "error",
      last_run_at: finishedAt,
      error: errorMessage.slice(0, 1_000),
    },
    ...(loginRequired
      ? { connectionStatus: "login_in_progress", connectionError: errorMessage.slice(0, 1_000) }
      : {}),
  };
}

function parseBody(value: unknown) {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = parseBody(req.body);
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  const token = typeof payload.token === "string" ? payload.token : "";
  if (!/^[0-9a-f]{64}$/.test(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const client = createPublicClient();
  const { data: claimed, error: claimError } = await client.rpc(
    "claim_estama_availability_run",
    { p_token: token },
  );
  if (claimError) {
    res.status(500).json({ ok: false, error: claimError.message });
    return;
  }
  if (!claimed || typeof claimed !== "object") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const run = claimed as ClaimedRun;
  if (typeof run.runToken !== "string" || !/^[0-9a-f]{64}$/.test(run.runToken)) {
    res.status(500).json({ ok: false, error: "実行トークンを発行できませんでした" });
    return;
  }
  const connections = Array.isArray(run.connections) ? run.connections.slice(0, 10) : [];
  const deferredAtClaim = Number.isFinite(run.deferredCount) ? Math.max(0, run.deferredCount) : 0;
  const unavailableCount = Number.isFinite(run.unavailableCount)
    ? Math.max(0, run.unavailableCount)
    : 0;
  const results: Array<Record<string, unknown>> = [];

  for (const connection of connections) {
    const startedAt = new Date().toISOString();
    let refreshResult: EstamaAvailabilityRefreshResult;
    try {
      refreshResult = await refreshEstamaAvailability(
        client,
        connection,
        run.runToken,
        new Date(),
      );
    } catch (caught) {
      const finishedAt = new Date().toISOString();
      const errorMessage = caught instanceof Error ? caught.message : String(caught);
      let historyError = "";
      try {
        await saveResult(
          client,
          run.runToken,
          connection.store_id,
          failurePayload(
            errorMessage,
            caught instanceof LoginRequiredError,
            startedAt,
            finishedAt,
          ),
        );
      } catch (saveError) {
        historyError = saveError instanceof Error ? saveError.message : String(saveError);
      }
      results.push({
        storeId: connection.store_id,
        ok: false,
        error: errorMessage,
        ...(historyError ? { historyError } : {}),
      });
      continue;
    }

    const finishedAt = new Date().toISOString();
    try {
      await saveResult(
        client,
        run.runToken,
        connection.store_id,
        successPayload(refreshResult, startedAt, finishedAt),
      );
      results.push({
        storeId: connection.store_id,
        ok: true,
        updated: refreshResult.updated,
        deferred: refreshResult.deferred,
        activeCount: refreshResult.activeCount,
        validUntil: refreshResult.validUntil,
      });
    } catch (saveError) {
      results.push({
        storeId: connection.store_id,
        ok: false,
        updated: refreshResult.updated,
        error: saveError instanceof Error ? saveError.message : String(saveError),
      });
    }
  }

  const runDeferred = results.filter((result) => result.deferred === true).length;
  const failed = results.filter((result) => result.ok !== true).length + unavailableCount;
  const deferred = deferredAtClaim + runDeferred;
  const checked = results.length + deferredAtClaim + unavailableCount;
  res.status(failed ? 207 : 200).json({
    ok: failed === 0,
    checked,
    succeeded: results.filter((result) => result.ok === true && result.deferred !== true).length,
    deferred,
    failed,
    results,
  });
}
