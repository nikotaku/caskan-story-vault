// 日別予約情報から、担当セラピスト本人のLINEグループへ
// マイページURLと追加オプション入力マニュアルを送る。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  cast_id: string;
  business_date: string;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  try {
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!lineToken || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "server configuration is incomplete" }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse({ error: "authentication required" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return jsonResponse({ error: "invalid session" }, 401);

    const payload = await req.json() as Payload;
    if (!payload.cast_id || !/^\d{4}-\d{2}-\d{2}$/.test(payload.business_date || "")) {
      return jsonResponse({ error: "cast_id and business_date are required" }, 400);
    }

    const { data: cast, error: castError } = await admin
      .from("casts")
      .select("id, name, line_group_id, store_id, store:stores(custom_domain)")
      .eq("id", payload.cast_id)
      .maybeSingle();
    if (castError || !cast) return jsonResponse({ error: "therapist not found" }, 404);

    const { data: membership } = await admin
      .from("user_stores")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("store_id", cast.store_id)
      .maybeSingle();
    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return jsonResponse({ error: "この連絡を送信する権限がありません" }, 403);
    }

    const { data: shopSettings } = await admin
      .from("shop_settings")
      .select("business_day_start")
      .eq("store_id", cast.store_id)
      .limit(1)
      .maybeSingle();
    const [dayStartHour, dayStartMinute] = (shopSettings?.business_day_start || "10:00")
      .split(":")
      .slice(0, 2)
      .map(Number);
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const currentMinutes = jstNow.getUTCHours() * 60 + jstNow.getUTCMinutes();
    if (currentMinutes < dayStartHour * 60 + dayStartMinute) {
      jstNow.setUTCDate(jstNow.getUTCDate() - 1);
    }
    const currentBusinessDate = jstNow.toISOString().slice(0, 10);
    if (payload.business_date !== currentBusinessDate) {
      return jsonResponse({ error: "受付終了連絡は本日の営業日のみ送信できます" }, 409);
    }

    if (!cast.line_group_id) {
      return jsonResponse({ error: "このセラピストのLINEグループが未連携です" }, 409);
    }
    const { data: tokenRow, error: tokenError } = await admin
      .from("cast_access_tokens")
      .select("access_token")
      .eq("cast_id", cast.id)
      .maybeSingle();
    if (tokenError || !tokenRow?.access_token) {
      return jsonResponse({ error: "このセラピストのマイページが未発行です" }, 409);
    }

    const storeRow = Array.isArray(cast.store) ? cast.store[0] : cast.store;
    const customDomain = storeRow?.custom_domain?.trim();
    const portalBase = customDomain ? `https://${customDomain}` : "https://newkyasukan.vercel.app";
    const portalUrl = `${portalBase}/therapist/${tokenRow.access_token}`;
    const guideUrl = `${portalBase}/therapist-option-sales-guide.png?v=20260813`;

    const text = [
      "【受付終了のご連絡】",
      `${cast.name}さん、本日もお疲れさまです。`,
      "本日の受付を終了しました。",
      "",
      "▼セラピストマイページ",
      portalUrl,
      "",
      "本日の各予約から「オプション入力」を開き、",
      "追加オプションとお支払い方法を確認してください。",
      "最後に「本日の売上を確定」を押してください。",
      "",
      "操作手順は次の画像をご確認ください。",
    ].join("\n");

    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lineToken}`,
      },
      body: JSON.stringify({
        to: cast.line_group_id,
        messages: [
          { type: "text", text },
          { type: "image", originalContentUrl: guideUrl, previewImageUrl: guideUrl },
        ],
      }),
    });

    if (!lineResponse.ok) {
      const details = await lineResponse.text();
      console.error(`LINE API error [${lineResponse.status}]: ${details}`);
      return jsonResponse({ error: "LINEへの送信に失敗しました" }, 502);
    }

    const sentAt = new Date().toISOString();
    const { error: historyError } = await admin
      .from("therapist_reception_end_notifications")
      .upsert({
        store_id: cast.store_id,
        cast_id: cast.id,
        business_date: payload.business_date,
        sent_at: sentAt,
        sent_by: userData.user.id,
      }, { onConflict: "store_id,cast_id,business_date" });
    if (historyError) {
      console.error("Failed to record reception-end notification:", historyError);
      return jsonResponse({
        error: "LINE送信は完了しましたが、送信履歴を保存できませんでした。再送せず管理者へ確認してください",
      }, 500);
    }

    return jsonResponse({ success: true, sent_at: sentAt });
  } catch (error) {
    console.error("notify-line-reception-end error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown error" }, 500);
  }
});
