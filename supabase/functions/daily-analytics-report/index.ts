import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ZENRYOKU_STORE_ID = "00000000-0000-0000-0000-000000000001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const groupId = Deno.env.get("LINE_GROUP_ID");
    if (!token || !groupId) throw new Error("LINE credentials not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Yesterday in JST
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const yesterday = new Date(jstNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const displayDate = `${yesterday.getMonth() + 1}月${yesterday.getDate()}日`;

    const [dailyRes, pagesRes] = await Promise.all([
      supabase.from("hp_analytics_daily").select("visits,page_views").eq("store_id", ZENRYOKU_STORE_ID).eq("date", dateStr).maybeSingle(),
      supabase.from("hp_analytics_pages").select("page_path,views").eq("store_id", ZENRYOKU_STORE_ID).eq("date", dateStr).order("views", { ascending: false }).limit(5),
    ]);

    const daily = dailyRes.data;
    const pages = pagesRes.data ?? [];

    const visits = daily?.visits ?? 0;
    const pageViews = daily?.page_views ?? 0;

    const pageLines = pages.length > 0
      ? pages.map((p: { page_path: string; views: number }) => `  ${p.page_path}：${p.views}PV`).join("\n")
      : "  データなし";

    const message = [
      `📊 全力エステHP アクセスレポート`,
      `${displayDate}（昨日）`,
      ``,
      `👥 セッション数：${visits}`,
      `📄 ページビュー：${pageViews}`,
      ``,
      `🔝 アクセスページ TOP5`,
      pageLines,
    ].join("\n");

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: "text", text: message }],
      }),
    });

    if (!lineRes.ok) {
      const err = await lineRes.text();
      throw new Error("LINE送信失敗: " + err);
    }

    return new Response(JSON.stringify({ success: true, date: dateStr, visits, pageViews }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
