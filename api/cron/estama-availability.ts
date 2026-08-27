import { createHash } from "node:crypto";
import {
  getAdminClient,
  LoginRequiredError,
  refreshEstamaAvailability,
  type EstamaAvailabilityRefreshResult,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
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
  if (!result.updated) {
    return [
      "✅ エスたま ご案内状況を確認",
      `実行: ${formatJst(finishedAt)}`,
      "現在勤務中のセラピストがいないため、表示の更新はありません。",
      "次回は1時間後に自動確認します。",
    ].join("\n");
  }

  return [
    "✅ エスたま ご案内状況を自動更新",
    `実行: ${formatJst(finishedAt)}`,
    "表示: ◎今すぐご案内可",
    `対象: ${result.activeCount}名${result.castNames.length ? `（${result.castNames.join("、")}）` : ""}`,
    result.validUntil ? `表示期限: ${result.validUntil}` : result.confirmation,
    "次回は1時間後に自動更新します。",
  ].join("\n");
}

const buildFailureSummary = (error: string, finishedAt: string) => [
  "⚠️ エスたま ご案内状況の自動更新に失敗",
  `実行: ${formatJst(finishedAt)}`,
  `原因: ${error.replace(/\s+/g, " ").slice(0, 500)}`,
  "次回は1時間後に自動再試行します。",
].join("\n");

async function saveSuccess(
  admin: ReturnType<typeof getAdminClient>,
  connection: ConnectionRow,
  startedAt: string,
  finishedAt: string,
  result: EstamaAvailabilityRefreshResult,
) {
  const items = resultItems(result);
  const baseConfiguration = connection.configuration && !Array.isArray(connection.configuration)
    ? connection.configuration
    : {};
  const { error: connectionError } = await admin.from("automation_connections").update({
    configuration: {
      ...baseConfiguration,
      availability_refresh: {
        status: result.updated ? "success" : "skipped",
        last_run_at: finishedAt,
        active_count: result.activeCount,
        cast_names: result.castNames,
        valid_until: result.validUntil,
        updated: result.updated,
      },
    },
  }).eq("id", connection.id);
  if (connectionError) throw connectionError;

  const { error: reportError } = await admin.from("estama_sync_reports").insert({
    store_id: connection.store_id,
    shop_id: connection.shop_id,
    status: "success",
    started_at: startedAt,
    finished_at: finishedAt,
    total_count: items.length,
    success_count: items.length,
    cast_names: result.castNames,
    summary: buildSuccessSummary(result, finishedAt),
    results: items,
    evidence: [],
    missing_profiles: [],
    fatal_error: null,
  });
  if (reportError) throw reportError;
}

async function saveFailure(
  admin: ReturnType<typeof getAdminClient>,
  connection: ConnectionRow,
  startedAt: string,
  finishedAt: string,
  errorMessage: string,
  loginRequired: boolean,
) {
  const baseConfiguration = connection.configuration && !Array.isArray(connection.configuration)
    ? connection.configuration
    : {};
  await admin.from("automation_connections").update({
    ...(loginRequired ? { status: "login_in_progress", last_error: errorMessage } : {}),
    configuration: {
      ...baseConfiguration,
      availability_refresh: {
        status: "error",
        last_run_at: finishedAt,
        error: errorMessage.slice(0, 1_000),
      },
    },
  }).eq("id", connection.id);

  await admin.from("estama_sync_reports").insert({
    store_id: connection.store_id,
    shop_id: connection.shop_id,
    status: "error",
    started_at: startedAt,
    finished_at: finishedAt,
    total_count: 0,
    success_count: 0,
    cast_names: [],
    summary: buildFailureSummary(errorMessage, finishedAt),
    results: [],
    evidence: [],
    missing_profiles: [],
    fatal_error: errorMessage.slice(0, 1_000),
  });
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const admin = getAdminClient();
  let payload: Record<string, unknown> = {};
  try {
    payload = typeof req.body === "string"
      ? JSON.parse(req.body) as Record<string, unknown>
      : (req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {});
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  const token = typeof payload.token === "string" ? payload.token : "";
  if (token.length < 48) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: claimed, error: claimError } = await admin
    .from("estama_sync_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .eq("purpose", "availability-refresh")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (claimError) {
    res.status(500).json({ ok: false, error: claimError.message });
    return;
  }
  if (!claimed?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data, error } = await admin
    .from("automation_connections")
    .select("id,store_id,status,browserbase_context_id,setup_session_id,shop_id,configuration")
    .eq("provider", "estama")
    .eq("status", "ready")
    .not("browserbase_context_id", "is", null)
    .limit(10);
  if (error) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }

  const results: Array<Record<string, unknown>> = [];
  for (const connection of (data || []) as ConnectionRow[]) {
    const startedAt = new Date().toISOString();
    try {
      const result = await refreshEstamaAvailability(connection, new Date());
      const finishedAt = new Date().toISOString();
      await saveSuccess(admin, connection, startedAt, finishedAt, result);
      results.push({
        storeId: connection.store_id,
        ok: true,
        updated: result.updated,
        activeCount: result.activeCount,
        validUntil: result.validUntil,
      });
    } catch (caught) {
      const finishedAt = new Date().toISOString();
      const errorMessage = caught instanceof Error ? caught.message : String(caught);
      await saveFailure(
        admin,
        connection,
        startedAt,
        finishedAt,
        errorMessage,
        caught instanceof LoginRequiredError,
      );
      results.push({ storeId: connection.store_id, ok: false, error: errorMessage });
    }
  }

  const failed = results.filter((result) => result.ok !== true).length;
  res.status(failed ? 207 : 200).json({
    ok: failed === 0,
    checked: results.length,
    succeeded: results.length - failed,
    failed,
    results,
  });
}
