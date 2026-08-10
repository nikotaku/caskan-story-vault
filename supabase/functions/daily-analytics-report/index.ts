import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENKA_STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";

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

    const [dailyRes, pagesRes, trafficRes] = await Promise.all([
      supabase.from("hp_analytics_daily").select("visits,unique_visitors,page_views").eq("store_id", ENKA_STORE_ID).eq("date", dateStr).maybeSingle(),
      supabase.from("hp_analytics_pages").select("page_path,views").eq("store_id", ENKA_STORE_ID).eq("date", dateStr).order("views", { ascending: false }).limit(5),
      supabase.from("hp_analytics_traffic").select("source,medium,campaign,content,landing_path,visits").eq("store_id", ENKA_STORE_ID).eq("date", dateStr).order("visits", { ascending: false }),
    ]);

    if (dailyRes.error) throw dailyRes.error;
    if (pagesRes.error) throw pagesRes.error;
    if (trafficRes.error) throw trafficRes.error;

    const daily = dailyRes.data;
    const pages = pagesRes.data ?? [];

    const visits = daily?.visits ?? 0;
    const uniqueVisitors = daily?.unique_visitors ?? 0;
    const pageViews = daily?.page_views ?? 0;
    const traffic = trafficRes.data ?? [];

    const sourceLabel = (source: string) => {
      const value = source.toLowerCase();
      if (value === "direct") return "直接・不明";
      if (value === "x" || value === "twitter" || value === "t.co") return "X";
      if (value === "02" || value.includes("m-sns")) return "02";
      if (value === "estama" || value.includes("estama.jp")) return "エステ魂";
      if (value.includes("google")) return "Google検索";
      if (value.includes("yahoo")) return "Yahoo検索";
      if (value.includes("esthe-ranking")) return "エステランキング";
      if (value.includes("men-esthe")) return "メンエス.jp";
      if (value === "line" || value.includes("line.me") || value.includes("liff")) return "LINE";
      return source;
    };

    const sourceTotals = new Map<string, number>();
    traffic.forEach((row: { source: string; visits: number }) => {
      const label = sourceLabel(row.source);
      sourceTotals.set(label, (sourceTotals.get(label) ?? 0) + row.visits);
    });
    const sourceLines = [...sourceTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => `  ${label}：${count}件`)
      .join("\n") || "  データなし";

    const taggedLines = traffic
      .filter((row: { campaign: string; content: string }) => row.campaign || row.content)
      .slice(0, 5)
      .map((row: { source: string; campaign: string; content: string; visits: number }) => {
        const tag = [sourceLabel(row.source), row.campaign, row.content].filter(Boolean).join(" / ");
        return `  ${tag}：${row.visits}件`;
      })
      .join("\n") || "  タグ付き流入なし";

    const pageLines = pages.length > 0
      ? pages.map((p: { page_path: string; views: number }) => `  ${p.page_path}：${p.views}PV`).join("\n")
      : "  データなし";

    const message = [
      `📊 艶華HP アクセスレポート`,
      `${displayDate}（昨日）`,
      ``,
      `👥 セッション数：${visits}`,
      `👤 ユーザー数：${uniqueVisitors}`,
      `📄 ページビュー：${pageViews}`,
      ``,
      `🏷 流入元別`,
      sourceLines,
      ``,
      `🔖 設置タグ別 TOP5`,
      taggedLines,
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

    return new Response(JSON.stringify({ success: true, date: dateStr, visits, uniqueVisitors, pageViews }), {
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
