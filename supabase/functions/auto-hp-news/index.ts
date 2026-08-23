// 各店舗の実データを根拠に、1日1回HPニュースを自動生成して公開する。
// 既存のpg_cronからこの関数を1回呼べば、過去データと艶華の両店舗を更新する。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORES = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "艶華（過去データ）",
    slugPrefix: "auto-news",
  },
  {
    id: "404499ab-5350-490f-9608-5814faffda6f",
    name: "艶華",
    slugPrefix: "auto-news-enka",
  },
] as const;

type StoreConfig = typeof STORES[number];

function jstYmd(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

async function buildNewsGrounding(sb: any, storeId: string, ymd: string): Promise<{ facts: string; images: string[] }> {
  try {
    const [discountsRes, shiftsRes, castsRes, bannersRes] = await Promise.all([
      sb.from("discounts").select("name, discount_type, discount_value").eq("store_id", storeId).eq("is_active", true),
      sb.from("shifts").select("cast_id, shift_date, start_time, end_time").eq("store_id", storeId).eq("shift_date", ymd).order("start_time").limit(20),
      sb.from("casts").select("id, name, photo").eq("store_id", storeId).eq("is_visible", true),
      sb.from("banners").select("image_url").eq("store_id", storeId).eq("is_active", true).order("display_order").limit(1),
    ]);

    const lines: string[] = [];
    const discounts = discountsRes.data ?? [];
    if (discounts.length > 0) {
      lines.push("【現在有効な割引】");
      for (const discount of discounts) {
        const value = discount.discount_type === "percent" || discount.discount_type === "percentage"
          ? `${discount.discount_value}%OFF`
          : `${Number(discount.discount_value).toLocaleString()}円引き`;
        lines.push(`・${discount.name}：${value}`);
      }
    }

    const castMap = new Map<string, { name: string; photo: string | null }>();
    for (const cast of castsRes.data ?? []) castMap.set(cast.id, { name: cast.name, photo: cast.photo });

    const shifts = (shiftsRes.data ?? []).filter((shift: any) => castMap.has(shift.cast_id));
    if (shifts.length > 0) {
      lines.push("【本日の出勤】");
      for (const shift of shifts.slice(0, 8)) {
        const cast = castMap.get(shift.cast_id)!;
        const time = shift.start_time && shift.end_time
          ? ` ${String(shift.start_time).slice(0, 5)}〜${String(shift.end_time).slice(0, 5)}`
          : "";
        lines.push(`・${cast.name}${time}`);
      }
    }

    const images: string[] = [];
    const seen = new Set<string>();
    for (const shift of shifts) {
      const photo = castMap.get(shift.cast_id)?.photo;
      if (photo && !seen.has(photo)) {
        seen.add(photo);
        images.push(photo);
      }
      if (images.length >= 2) break;
    }
    const banner = bannersRes.data?.[0]?.image_url;
    if (banner && images.length < 2) images.push(banner);

    return { facts: lines.join("\n"), images };
  } catch (error) {
    console.error(`buildNewsGrounding failed for ${storeId}:`, error);
    return { facts: "", images: [] };
  }
}

async function generateForStore({
  sb,
  apiKey,
  store,
  ymd,
  force,
}: {
  sb: any;
  apiKey: string;
  store: StoreConfig;
  ymd: string;
  force: boolean;
}) {
  const slug = `${store.slugPrefix}-${ymd.replace(/-/g, "")}`;

  if (!force) {
    const { data: existing } = await sb
      .from("hp_articles")
      .select("id")
      .eq("store_id", store.id)
      .eq("slug", slug)
      .maybeSingle();
    if (existing) return { store: store.name, skipped: "already generated today", slug };
  }

  const { facts, images } = await buildNewsGrounding(sb, store.id, ymd);
  const factsBlock = facts
    ? `\n\n===== 参照データ（ここにある事実だけ使用） =====\n${facts}\n=============================================`
    : "\n\n参照データが空のため、具体的な料金・割引名・セラピスト名・日時は書かないでください。";

  const systemPrompt = `あなたは仙台・宮城のメンズエステ「${store.name}」公式サイトの予約獲得を担当する編集者です。
スマートフォンで一読でき、そのまま予約したくなる短いニュースを書いてください。

【厳守事項】
・料金、割引、出勤、固有名詞は参照データにある事実だけを使い、創作しない。
・過度な性的表現、誇大表現、同じ言い回しの繰り返しを避ける。
・季節や天気の挨拶、一般論、翌日以降の案内、オプションの説明は書かない。
・参照データに割引がある場合は、最も予約につながる割引名と金額を必ずタイトルまたは本文前半に入れる。
・参照データに本日の出勤がある場合は、名前と時間を簡潔に案内する。
・本文の最後は「Web予約またはLINEからご予約ください」など、次の行動が明確な一文にする。URLは書かない。
・Markdown記法、絵文字、ハッシュタグは使わない。

【出力形式】
1行目：記事タイトル（14〜30文字。空き状況または割引の利点を結論から伝える）
2行目：空行
3行目以降：本文（合計90〜180文字、段落は2〜3つ。結論→本日の案内→予約の順）`;
  const userPrompt = `本日（${ymd}）の${store.name}公式ニュースを作成してください。目的はニュースを読んだ方に、クーポンまたは本日の空き状況を確認して予約してもらうことです。参照データの中から予約判断に必要な情報だけを選び、短くまとめてください。${factsBlock}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const generated = String(data.content?.[0]?.text ?? "").trim();
  if (!generated) throw new Error("empty generation");

  const parts = generated.split("\n");
  let title = String(parts.shift() ?? "").trim().replace(/^タイトル[:：\s]*/, "");
  const content = parts.join("\n").trim() || generated;
  if (!title) title = `${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日のお知らせ`;
  if (title.length > 40) title = title.slice(0, 40);

  if (force) {
    await sb.from("hp_articles").delete().eq("store_id", store.id).eq("slug", slug);
  }

  const { error: insertError } = await sb.from("hp_articles").insert({
    title,
    slug,
    content,
    category: "news",
    is_published: true,
    image_urls: images,
    store_id: store.id,
  });
  if (insertError) throw insertError;

  return { store: store.name, success: true, slug, title };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment variables are not configured");
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    let force = false;
    let requestedStoreId: string | null = null;
    try {
      const body = await req.json();
      force = body?.force === true;
      requestedStoreId = typeof body?.storeId === "string" ? body.storeId : null;
    } catch (_) {
      // 定期実行はbodyなしでも利用できる。
    }

    const targets = requestedStoreId ? STORES.filter((store) => store.id === requestedStoreId) : STORES;
    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: "Unknown storeId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const ymd = jstYmd();
    const results = [];

    // APIのレート制限を避け、片方の失敗でももう一方を必ず実行する。
    for (const store of targets) {
      try {
        results.push(await generateForStore({ sb, apiKey: anthropicApiKey, store, ymd, force }));
      } catch (error) {
        console.error(`auto-hp-news failed for ${store.name}:`, error);
        results.push({
          store: store.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const hasFailure = results.some((result) => result.success === false);
    return new Response(JSON.stringify({ success: !hasFailure, date: ymd, results }), {
      status: hasFailure ? 207 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auto-hp-news error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
