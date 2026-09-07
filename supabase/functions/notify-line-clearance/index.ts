import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATE_PATTERN = /^20\d{2}-\d{2}-\d{2}$/;

type ExtraItem = { label?: unknown; amount?: unknown; kind?: unknown };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function yen(value: unknown): string {
  const amount = Number(value ?? 0);
  return `¥${Number.isFinite(amount) ? amount.toLocaleString("ja-JP") : "0"}`;
}

function normalizeExtras(value: unknown): ExtraItem[] {
  if (Array.isArray(value)) return value.filter((item): item is ExtraItem => Boolean(item) && typeof item === "object");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is ExtraItem => Boolean(item) && typeof item === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildMessage(date: string, castName: string, clearance: Record<string, unknown>): string {
  const totalSales = Number(clearance.total_sales ?? 0);
  const therapistBack = Number(clearance.therapist_back ?? 0);
  const misc = Number(clearance.misc_expenses ?? 0);
  const accommodation = Number(clearance.accommodation_fee ?? 0);
  const transportation = Number(clearance.transportation_fee ?? 0);
  const storeShare = Number(clearance.payout_amount ?? 0);
  const salary = totalSales - storeShare;
  const extras = normalizeExtras(clearance.other_expenses);
  const deductions = extras.filter((item) => item.kind !== "salary_addition" && Number(item.amount ?? 0) > 0);
  const additions = extras.filter((item) => item.kind === "salary_addition" && Number(item.amount ?? 0) > 0);

  const lines = [
    "【日別清算 明細】",
    `${date.replace(/-/g, "/")}　${castName}`,
    "",
    `売上合計：${yen(totalSales)}`,
    `給与バック：${yen(therapistBack)}`,
    `雑費：-${yen(misc)}`,
    `宿泊費：-${yen(accommodation)}`,
  ];
  if (transportation > 0) lines.push(`交通費：+${yen(transportation)}`);
  for (const item of deductions) lines.push(`${String(item.label || "その他控除")}：-${yen(item.amount)}`);
  for (const item of additions) lines.push(`${String(item.label || "給与調整")}：+${yen(item.amount)}`);
  lines.push("", `セラピスト給与：${yen(salary)}`, `店舗取り分：${yen(storeShare)}`);
  if (clearance.payout_method) lines.push("", `投函方法：${String(clearance.payout_method)}`);
  lines.push("", "管理画面の日別清算から自動送信");
  return lines.join("\n");
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
    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!jwt || !supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "ログインが必要です" }, 401);
    if (!lineToken) return jsonResponse({ error: "LINE公式アカウントの設定がありません" }, 500);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: "ログインが必要です" }, 401);

    const payload = await req.json().catch(() => ({}));
    const date = typeof payload?.date === "string" ? payload.date.trim() : "";
    const cardText = typeof payload?.card_text === "string" ? payload.card_text : "";
    if (!DATE_PATTERN.test(date) || !cardText) return jsonResponse({ error: "清算明細の指定が不正です" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: casts, error: castsError } = await admin
      .from("casts")
      .select("id,name,store_id,line_group_id")
      .eq("is_active", true);
    if (castsError) throw castsError;

    const matching = (casts ?? [])
      .filter((cast) => cast.name && cardText.includes(cast.name))
      .sort((a, b) => b.name.length - a.name.length);
    if (matching.length === 0) return jsonResponse({ error: "対象セラピストを特定できませんでした" }, 404);

    let target: (typeof matching)[number] | null = null;
    for (const cast of matching) {
      const { data: canManage } = await authClient.rpc("can_manage_store", { p_store_id: cast.store_id });
      if (canManage === true) {
        target = cast;
        break;
      }
    }
    if (!target) return jsonResponse({ error: "この店舗の清算明細を共有する権限がありません" }, 403);

    const { data: clearance, error: clearanceError } = await admin
      .from("daily_clearances")
      .select("total_sales,therapist_back,misc_expenses,accommodation_fee,transportation_fee,other_expenses,payout_amount,payout_method,status")
      .eq("cast_id", target.id)
      .eq("date", date)
      .maybeSingle();
    if (clearanceError) throw clearanceError;
    if (!clearance || clearance.status === "draft") {
      return jsonResponse({ error: "清算確定後に明細を共有してください" }, 409);
    }

    const groupId = target.line_group_id || Deno.env.get("LINE_THERAPIST_GROUP_ID") || null;
    if (!groupId) return jsonResponse({ error: "このセラピストのLINEグループが未登録です" }, 409);

    const message = buildMessage(date, target.name, clearance as Record<string, unknown>);
    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineToken}` },
      body: JSON.stringify({ to: groupId, messages: [{ type: "text", text: message }] }),
    });
    if (!lineRes.ok) {
      const details = await lineRes.text();
      console.error(`LINE API error [${lineRes.status}]: ${details}`);
      return jsonResponse({ error: "LINE送信に失敗しました" }, 502);
    }

    return jsonResponse({ success: true, cast_name: target.name }, 200);
  } catch (error) {
    console.error("notify-line-clearance error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
