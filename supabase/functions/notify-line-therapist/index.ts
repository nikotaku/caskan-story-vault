// 予約確認SMS送信と同時に、担当セラピストのグループLINEへ予約内容を共有する。
// 管理画面（Schedule）のSMSボタンから呼び出される。
// 送信先: casts.line_group_id（セラピストごとのグループ）。
// 未登録の場合は LINE_THERAPIST_GROUP_ID（共通グループ）にフォールバック。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildReservationLineMessage,
  type ReservationLineContext,
} from "./reservationLineNotification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface Payload {
  reservation_id?: string | null;
  cast_id?: string | null;
  customer_name: string;
  cast_name: string;
  reservation_date: string; // 表示用（例: 7月6日(月)）
  start_time: string;       // 表示用（例: 24:40）
  course_name: string;
  room?: string | null;
  options?: string[] | null;
  notes?: string | null;
}

function buildLegacyMessage(p: Payload): string {
  const lines = [
    "🔔 新規予約のご案内",
    "",
    `📅 ${p.reservation_date}`,
    `⏰ ${p.start_time}〜`,
    `💆 ${p.course_name}`,
    `👤 担当：${p.cast_name}`,
  ];
  if (p.options && p.options.length > 0) lines.push(`➕ オプション：${p.options.join("、")}`);
  if (p.room) lines.push(`🏠 ルーム：${p.room}`);
  lines.push(`お客様：${p.customer_name} 様`);
  if (p.notes) {
    lines.push("");
    lines.push(`📝 ${p.notes}`);
  }
  return lines.join("\n");
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!jwt || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "ログインが必要です" }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !authData.user) {
      return jsonResponse({ error: "ログインが必要です" }, 401);
    }

    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!token) {
      return jsonResponse({ error: "LINE token not configured" }, 500);
    }

    const p: Payload = await req.json();
    const reservationId = typeof p.reservation_id === "string" ? p.reservation_id.trim() : "";
    const castId = typeof p.cast_id === "string" ? p.cast_id.trim() : "";
    if ((reservationId && !UUID_PATTERN.test(reservationId)) || (!reservationId && !UUID_PATTERN.test(castId))) {
      return jsonResponse({ error: "予約またはセラピストの指定が不正です" }, 400);
    }

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // service roleで顧客情報を読む前に、JWT利用者が対象店舗の管理者か確認する。
    let targetStoreId: string;
    let legacyCastLineGroupId: string | null = null;
    if (reservationId) {
      const { data: reservation, error: reservationError } = await sb
        .from("reservations")
        .select("store_id")
        .eq("id", reservationId)
        .maybeSingle();
      if (reservationError) {
        console.error(`Reservation authorization lookup failed [${reservationError.code ?? "unknown"}]`);
        return jsonResponse({ error: "予約情報を取得できませんでした" }, 500);
      }
      if (!reservation) return jsonResponse({ error: "予約が見つかりません" }, 404);
      targetStoreId = reservation.store_id;
    } else {
      const { data: cast, error: castError } = await sb
        .from("casts")
        .select("store_id, line_group_id")
        .eq("id", castId)
        .maybeSingle();
      if (castError) {
        console.error(`Cast authorization lookup failed [${castError.code ?? "unknown"}]`);
        return jsonResponse({ error: "セラピスト情報を取得できませんでした" }, 500);
      }
      if (!cast) return jsonResponse({ error: "セラピストが見つかりません" }, 404);
      targetStoreId = cast.store_id;
      legacyCastLineGroupId = cast.line_group_id;
    }

    const { data: canManage, error: permissionError } = await authClient.rpc("can_manage_store", {
      p_store_id: targetStoreId,
    });
    if (permissionError || canManage !== true) {
      return jsonResponse({ error: "この店舗の予約を共有する権限がありません" }, 403);
    }

    // 新しいフロントからは予約IDだけを信頼し、金額・履歴などはDBの確定値を使う。
    // 旧画面からの呼び出しは、移行期間中も従来本文で送れるよう互換性を残す。
    let context: ReservationLineContext | null = null;
    if (reservationId) {
      const { data, error } = await sb.rpc("get_reservation_line_context", {
        p_reservation_id: reservationId,
      });
      if (error) {
        console.error(`Reservation context RPC failed [${error.code ?? "unknown"}]`);
        return jsonResponse({ error: "予約情報を取得できませんでした" }, 500);
      }
      if (!data || typeof data !== "object") {
        return jsonResponse({ error: "予約が見つかりません" }, 404);
      }
      context = data as ReservationLineContext;
    }

    // 担当セラピストのグループIDを取得（未登録なら共通グループにフォールバック）
    let groupId: string | null = context?.line_group_id ?? legacyCastLineGroupId;
    const notificationCastId = context?.cast_id ?? castId;
    if (!groupId && notificationCastId) {
      const { data } = await sb.from("casts").select("line_group_id").eq("id", notificationCastId).maybeSingle();
      groupId = data?.line_group_id ?? null;
    }
    if (!groupId) groupId = Deno.env.get("LINE_THERAPIST_GROUP_ID") ?? null;
    if (!groupId) {
      return jsonResponse({ error: "このセラピストのLINEグループが未登録です（グループ内で「連携 名前」を送信してください）" }, 500);
    }

    const message = context ? buildReservationLineMessage(context) : buildLegacyMessage(p);

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages: [{ type: "text", text: message }] }),
    });

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      console.error(`LINE API error [${lineRes.status}]: ${errText}`);
      return jsonResponse({ error: "LINE API failed", details: errText }, 502);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error("notify-line-therapist error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
