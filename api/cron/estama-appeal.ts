import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  appealEstamaTherapist,
  LoginRequiredError,
  type EstamaTherapistAppealResult,
  type EstamaTherapistAppealTarget,
} from "../../server/estama-automation.js";
import {
  nextDueEstamaAppealSlot,
  type EstamaAppealShift,
} from "../../server/estama-appeal.js";

export const config = { maxDuration: 300 };

type RequestLike = { method?: string; body?: unknown };
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type AppealShift = EstamaAppealShift & {
  castId: string;
  castName: string;
  externalId: string | null;
  remoteName: string | null;
};

type AppealSlot = {
  slot: number;
  status: string;
  attemptCount?: number | null;
  scheduledFor: string | null;
};

type AppealConnection = {
  id: string;
  store_id: string;
  status: string;
  browserbase_context_id: string | null;
  setup_session_id: string | null;
  shop_id: string | null;
  configuration: Record<string, unknown> | null;
  shifts: AppealShift[];
  slots: AppealSlot[];
};

type ClaimedDispatch = {
  runToken: string;
  businessDate: string;
  connections: AppealConnection[];
};

type ClaimedSlot = {
  claimed: true;
  connection: AppealConnection;
  target: EstamaTherapistAppealTarget;
};

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || "https://imrxzkivwrkqbhqfbbes.supabase.co";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";
const MAX_CONNECTIONS_PER_DISPATCH = 3;

const formatJst = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value));

function createPublicClient() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseBody(value: unknown) {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nextDueSlot(connection: AppealConnection, businessDate: string, now: Date) {
  return nextDueEstamaAppealSlot({
    shifts: connection.shifts,
    slots: connection.slots,
    businessDate,
    now,
  });
}

function dispatchOrderKey(storeId: string, bucket: number) {
  let hash = (2166136261 ^ bucket) >>> 0;
  for (let index = 0; index < storeId.length; index += 1) {
    hash ^= storeId.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

async function saveResult(
  client: SupabaseClient,
  runToken: string,
  storeId: string,
  slot: number,
  payload: Record<string, unknown>,
) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await client.rpc("save_estama_appeal_result", {
      p_run_token: runToken,
      p_store_id: storeId,
      p_slot: slot,
      p_payload: payload,
    });
    if (!error && data === true) return;
    lastError = error?.message || "実行枠または実行トークンが無効です";
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw new Error(`アピール結果を保存できません: ${lastError}`);
}

function successPayload(
  result: EstamaTherapistAppealResult,
  target: EstamaTherapistAppealTarget,
  startedAt: string,
  finishedAt: string,
) {
  const skipped = result.status === "skipped";
  return {
    status: result.status,
    startedAt,
    finishedAt,
    summary: skipped
      ? [
          "⚠️ エスたま セラピストアピールを見送り",
          `実行: ${formatJst(finishedAt)}`,
          `対象: ${target.castName}`,
          "本日のアピール残り回数が0回のため、ボタンは押していません。",
        ].join("\n")
      : [
          "✅ エスたま セラピストアピール完了",
          `実行: ${formatJst(finishedAt)}`,
          `対象: ${target.castName}`,
          `残り回数: ${result.remainingBefore}回 → ${result.remainingAfter}回`,
          `最終アピール: ${result.lastAppealAfter || "更新確認済み"}`,
        ].join("\n"),
    remainingBefore: result.remainingBefore,
    remainingAfter: result.remainingAfter,
    lastAppealBefore: result.lastAppealBefore,
    lastAppealAfter: result.lastAppealAfter,
    appealUrl: result.appealUrl,
    configuration: {
      status: result.status,
      last_run_at: finishedAt,
      last_cast_id: target.castId,
      last_cast_name: target.castName,
      last_slot: target.slot,
      ...(result.status === "success" ? { last_success_at: finishedAt } : {}),
    },
  };
}

function failurePayload(error: unknown, target: EstamaTherapistAppealTarget, startedAt: string, finishedAt: string) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: "error",
    startedAt,
    finishedAt,
    summary: [
      "⚠️ エスたま セラピストアピールを確認できません",
      `実行: ${formatJst(finishedAt)}`,
      `対象: ${target.castName}`,
      `原因: ${message.replace(/\s+/g, " ").slice(0, 500)}`,
      "ボタン押下後の結果が不明な場合は、重複消費を防ぐため同じ枠を再実行しません。",
    ].join("\n"),
    fatalError: message.slice(0, 1_000),
    configuration: {
      status: "error",
      last_run_at: finishedAt,
      error: message.slice(0, 1_000),
    },
    ...(error instanceof LoginRequiredError
      ? { connectionStatus: "login_in_progress", connectionError: message.slice(0, 1_000) }
      : {}),
  };
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = parseBody(req.body);
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[0-9a-f]{64}$/.test(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const client = createPublicClient();
  const { data, error: claimError } = await client.rpc("claim_estama_appeal_dispatch", {
    p_token: token,
  });
  if (claimError) {
    res.status(500).json({ ok: false, error: claimError.message });
    return;
  }
  if (!data || typeof data !== "object") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const dispatch = data as ClaimedDispatch;
  if (!/^[0-9a-f]{64}$/.test(dispatch.runToken || "") || !/^\d{4}-\d{2}-\d{2}$/.test(dispatch.businessDate || "")) {
    res.status(500).json({ ok: false, error: "実行情報を発行できませんでした" });
    return;
  }

  const now = new Date();
  const connections = Array.isArray(dispatch.connections) ? dispatch.connections : [];
  const dispatchBucket = Math.floor(now.getTime() / (5 * 60_000));
  const dueConnections = connections.flatMap((connection) => {
    const due = nextDueSlot(connection, dispatch.businessDate, now);
    if (!due) return [];
    const existing = connection.slots.find((slot) => slot.slot === due.slot);
    return [{
      connection,
      due,
      retry: existing?.status === "error" ? 1 : 0,
      order: dispatchOrderKey(connection.store_id, dispatchBucket),
    }];
  }).sort((left, right) => (
    left.due.slot - right.due.slot
    || left.retry - right.retry
    || left.order - right.order
  ));
  const selectedConnections = dueConnections.slice(0, MAX_CONNECTIONS_PER_DISPATCH);
  const results: Array<Record<string, unknown>> = [];

  // A browser run can take tens of seconds. Limit each five-minute dispatch to
  // a time-safe batch, while rotating equal-priority stores every dispatch so
  // stores after the first page cannot starve.
  for (const { connection, due } of selectedConnections) {

    const { data: claimed, error: slotError } = await client.rpc("claim_estama_appeal_slot", {
      p_run_token: dispatch.runToken,
      p_store_id: connection.store_id,
      p_slot: due.slot,
      p_scheduled_for: due.scheduledFor,
    });
    if (slotError) {
      results.push({ storeId: connection.store_id, slot: due.slot, ok: false, error: slotError.message });
      continue;
    }
    if (!claimed || typeof claimed !== "object" || (claimed as Record<string, unknown>).claimed !== true) {
      const reason = claimed && typeof claimed === "object"
        ? String((claimed as Record<string, unknown>).reason || "not_claimed")
        : "not_claimed";
      results.push({ storeId: connection.store_id, slot: due.slot, ok: true, deferred: true, reason });
      continue;
    }

    const claim = claimed as ClaimedSlot;
    const startedAt = new Date().toISOString();
    try {
      const appeal = await appealEstamaTherapist(client, claim.connection, dispatch.runToken, claim.target);
      const finishedAt = new Date().toISOString();
      await saveResult(
        client,
        dispatch.runToken,
        connection.store_id,
        due.slot,
        successPayload(appeal, claim.target, startedAt, finishedAt),
      );
      results.push({
        storeId: connection.store_id,
        slot: due.slot,
        ok: true,
        status: appeal.status,
        castName: claim.target.castName,
        remainingAfter: appeal.remainingAfter,
      });
    } catch (caught) {
      const finishedAt = new Date().toISOString();
      let historyError = "";
      try {
        await saveResult(
          client,
          dispatch.runToken,
          connection.store_id,
          due.slot,
          failurePayload(caught, claim.target, startedAt, finishedAt),
        );
      } catch (saveError) {
        historyError = saveError instanceof Error ? saveError.message : String(saveError);
      }
      results.push({
        storeId: connection.store_id,
        slot: due.slot,
        ok: false,
        castName: claim.target.castName,
        error: caught instanceof Error ? caught.message : String(caught),
        ...(historyError ? { historyError } : {}),
      });
    }
  }

  const failed = results.filter((result) => result.ok !== true).length;
  res.status(failed ? 207 : 200).json({
    ok: failed === 0,
    businessDate: dispatch.businessDate,
    checked: connections.length,
    due: dueConnections.length,
    queued: Math.max(0, dueConnections.length - selectedConnections.length),
    attempted: results.filter((result) => result.deferred !== true).length,
    deferred: results.filter((result) => result.deferred === true).length,
    failed,
    results,
  });
}
