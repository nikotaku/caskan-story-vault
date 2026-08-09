import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

type Json = Record<string, unknown>;

type BatchItem = {
  jobId: string;
  shiftId: string;
  castId: string;
  castName: string;
  externalId: string | null;
  remoteName: string | null;
  reportToken: string;
  action: "upsert" | "delete";
  shiftDate: string;
  startTime: string;
  endTime: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const hex = (bytes: Uint8Array) =>
  Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");

const sha256 = async (value: string) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

const randomToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hex(bytes);
};

// エステ魂の管理画面はUTC日付で14日分を切り替えるため、同じ基準日を使う。
// 通常実行の23:00 JSTではJST日付と一致し、深夜の手動実行でも範囲外送信を防げる。
const estamaAdminDate = () => new Date().toISOString().slice(0, 10);

const addDays = (date: string, days: number) => {
  const value = new Date(date + "T00:00:00.000Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const getAdminKey = () => {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Supabaseの管理用鍵がEdge Functionにありません");
  const parsed = JSON.parse(raw) as Record<string, string>;
  const key = parsed.default || Object.values(parsed)[0];
  if (!key) throw new Error("Supabaseの管理用鍵を取得できません");
  return key;
};

async function notifyWithoutEvidence(
  supabaseUrl: string,
  notificationToken: string,
  report: Json,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/notify-estama-shift-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationToken, report }),
    signal: AbortSignal.timeout(60_000),
  });
  const detail = await response.text();
  if (!response.ok) {
    throw new Error(`エスたまLINE通知 ${response.status}: ${detail.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  let admin: ReturnType<typeof createClient> | null = null;
  let claimedDispatcherId = "";

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const payload = await req.json().catch(() => ({})) as Record<string, unknown>;
    const dispatcherToken = typeof payload.token === "string" ? payload.token : "";
    if (dispatcherToken.length < 48) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://imrxzkivwrkqbhqfbbes.supabase.co";
    admin = createClient(supabaseUrl, getAdminKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const dispatcherHash = await sha256(dispatcherToken);
    const { data: claimed, error: claimError } = await admin
      .from("estama_sync_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", dispatcherHash)
      .eq("purpose", "dispatcher")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed?.id) return json({ error: "Unauthorized" }, 401);
    claimedDispatcherId = claimed.id;

    const { data: connections, error: connectionError } = await admin
      .from("automation_connections")
      .select("id,store_id,status,browserbase_context_id,shop_id,configuration")
      .eq("provider", "estama")
      .eq("status", "ready")
      .not("browserbase_context_id", "is", null);
    if (connectionError) throw connectionError;

    const startDate = estamaAdminDate();
    const endDate = addDays(startDate, 13);
    const reports: Json[] = [];

    for (const connection of connections || []) {
      const [{ data: profiles, error: profileError }, { data: casts, error: castError }] = await Promise.all([
        admin.from("external_cast_profiles")
          .select("id,cast_id,external_cast_id,remote_name")
          .eq("store_id", connection.store_id)
          .eq("provider", "estama")
          .eq("sync_status", "synced"),
        admin.from("casts").select("id,name,estama_listed").eq("store_id", connection.store_id),
      ]);
      if (profileError) throw profileError;
      if (castError) throw castError;

      const castById = new Map((casts || []).map((cast) => [cast.id, cast]));
      const profileByCast = new Map((profiles || []).map((profile) => [profile.cast_id, profile]));
      const profileCastIds = [...profileByCast.keys()];
      let shiftRows: Array<Record<string, unknown>> = [];
      if (profileCastIds.length) {
        const { data, error } = await admin.from("shifts")
          .select("id,cast_id,shift_date,start_time,end_time,status,approval_status,updated_at")
          .eq("store_id", connection.store_id)
          .in("cast_id", profileCastIds)
          .gte("shift_date", startDate)
          .lte("shift_date", endDate)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        shiftRows = (data || []) as Array<Record<string, unknown>>;
      }

      const latestByCastDate = new Map<string, Record<string, unknown>>();
      for (const shift of shiftRows) {
        const key = String(shift.cast_id) + ":" + String(shift.shift_date).slice(0, 10);
        if (!latestByCastDate.has(key)) latestByCastDate.set(key, shift);
      }

      const items: BatchItem[] = [];
      for (const shift of latestByCastDate.values()) {
        const castId = String(shift.cast_id);
        const cast = castById.get(castId);
        const profile = profileByCast.get(castId);
        if (!cast || !profile) continue;
        const action: "upsert" | "delete" =
          shift.approval_status === "approved" && shift.status !== "cancelled" ? "upsert" : "delete";
        const shiftId = String(shift.id);
        const { data: jobId, error: jobError } = await admin.rpc("enqueue_estama_job", {
          p_store_id: connection.store_id,
          p_job_type: "estama_sync_shift",
          p_cast_id: castId,
          p_shift_id: shiftId,
          p_dedupe_key: "estama:edge:" + shiftId,
          p_payload: {
            source: "supabase_cron",
            action,
            shift_date: String(shift.shift_date).slice(0, 10),
            start_time: String(shift.start_time),
            end_time: String(shift.end_time),
          },
        });
        if (jobError) throw jobError;
        await admin.from("automation_jobs").update({
          status: "running",
          attempts: 1,
          started_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", jobId);
        const reportToken = randomToken();
        const { error: reportTokenError } = await admin.from("estama_sync_tokens").insert({
          token_hash: await sha256(reportToken),
          purpose: "report:" + String(jobId),
          expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        });
        if (reportTokenError) throw reportTokenError;
        items.push({
          jobId: String(jobId),
          shiftId,
          castId,
          castName: String(cast.name),
          externalId: profile.external_cast_id ? String(profile.external_cast_id) : null,
          remoteName: profile.remote_name ? String(profile.remote_name) : null,
          reportToken,
          action,
          shiftDate: String(shift.shift_date).slice(0, 10),
          startTime: String(shift.start_time),
          endTime: String(shift.end_time),
        });
      }

      const missingProfiles = (casts || []).filter((cast) =>
        cast.estama_listed === true && !profileByCast.has(cast.id)
      ).map((cast) => cast.name);

      if (!items.length) {
        const notificationToken = randomToken();
        const notificationBatchId = crypto.randomUUID();
        const { error: notificationTokenError } = await admin.from("estama_sync_tokens").insert({
          token_hash: await sha256(notificationToken),
          purpose: "notify:" + notificationBatchId,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
        if (notificationTokenError) throw notificationTokenError;
        const message = missingProfiles.length
          ? "エスたま紐付け未完了: " + missingProfiles.join("、")
          : null;
        await admin.from("automation_connections").update({
          last_reconciled_at: new Date().toISOString(),
          last_error: message,
        }).eq("id", connection.id);
        reports.push({
          storeId: connection.store_id,
          attempted: 0,
          succeeded: 0,
          failed: 0,
          missingProfiles,
        });
        await notifyWithoutEvidence(supabaseUrl, notificationToken, {
          storeId: connection.store_id,
          shopId: connection.shop_id ? String(connection.shop_id) : "",
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date().toISOString(),
          results: [],
          evidence: [],
          missingProfiles,
        });
        continue;
      }

      await admin.from("automation_connections").update({
        last_error: missingProfiles.length
          ? "エスたま紐付け未完了: " + missingProfiles.join("、")
          : null,
        status: "ready",
      }).eq("id", connection.id);

      const batches = [...items.reduce((groups, item) => {
        const key = item.externalId || item.castId;
        groups.set(key, [...(groups.get(key) || []), item]);
        return groups;
      }, new Map<string, BatchItem[]>()).values()];

      let nextPayload: Record<string, unknown> | null = null;
      for (let index = batches.length - 1; index >= 0; index -= 1) {
        const batch = batches[index];
        const workerToken = randomToken();
        const notificationToken = randomToken();
        const notificationBatchId = crypto.randomUUID();
        const tokenRows = [
          {
            token_hash: await sha256(workerToken),
            purpose: "worker",
            expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
          {
            token_hash: await sha256(notificationToken),
            purpose: "notify:" + notificationBatchId,
            expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
        ];

        let continuation: { token: string; payload: Record<string, unknown> } | undefined;
        if (nextPayload) {
          const continuationToken = randomToken();
          tokenRows.push({
            token_hash: await sha256(continuationToken),
            purpose: "continue:" + crypto.randomUUID(),
            expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          });
          continuation = { token: continuationToken, payload: nextPayload };
        }

        const { error: tokenError } = await admin.from("estama_sync_tokens").insert(tokenRows);
        if (tokenError) throw tokenError;
        nextPayload = {
          token: workerToken,
          storeId: connection.store_id,
          shopId: connection.shop_id ? String(connection.shop_id) : "",
          contextId: connection.browserbase_context_id,
          configuration: connection.configuration || {},
          notificationToken,
          missingProfiles: index === 0 ? missingProfiles : [],
          items: batch,
          ...(continuation ? { continuation } : {}),
        };
      }

      if (!nextPayload) throw new Error("エスたま同期バッチを作成できませんでした");
      const { data: requestId, error: dispatchError } = await admin.rpc(
        "dispatch_estama_worker_request",
        { p_payload: nextPayload },
      );
      if (dispatchError) throw dispatchError;
      if (!requestId) throw new Error("エスたま同期バッチを開始できませんでした");

      reports.push({
        storeId: connection.store_id,
        attempted: items.length,
        batches: batches.length,
        queued: true,
        requestId,
        missingProfiles,
      });
    }

    return json({
      ok: reports.every((report) => !report.error),
      range: { startDate, endDate },
      reports,
      ms: Date.now() - startedAt,
      dispatcher: claimedDispatcherId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      level: "error",
      msg: "estama_reconcile_dispatch_failed",
      error: message,
      ms: Date.now() - startedAt,
    }));
    return json({ error: message }, 500);
  }
});
