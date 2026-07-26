// エステ魂のセラピストプロフィールページから写メ日記カードを取り込み、
// 画像を自社ストレージへ保存して cast_diaries に登録する。
// 管理画面の「写メ日記を取り込む」ボタンから cast_id を渡して呼び出す。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";
const MAX_CARDS = 12;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cast_id } = await req.json();
    if (!cast_id) throw new Error("cast_id is required");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cast, error: castErr } = await sb
      .from("casts")
      .select("id, estama_profile_url")
      .eq("id", cast_id)
      .single();
    if (castErr || !cast) throw new Error("キャストが見つかりません");
    const url = (cast as any).estama_profile_url;
    if (!url) throw new Error("エステ魂プロフィールURLが未設定です");

    // プロフィールページ取得
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) throw new Error(`ページ取得失敗: ${res.status}`);
    const html = await res.text();

    // 写メ日記セクションを切り出す
    const secStart = html.indexOf('id="TherapistDiary"');
    if (secStart < 0) throw new Error("写メ日記が見つかりませんでした");
    const section = html.slice(secStart, secStart + 40000);

    // 各カードを抽出
    const cardRe = /<a\s+href="([^"]+)"\s+class="cast-diary-card">([\s\S]*?)<\/a>/g;
    const cards: {
      external_url: string; image_src: string | null; category: string | null;
      datetime: string | null; title: string; body: string;
    }[] = [];
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(section)) && cards.length < MAX_CARDS) {
      const href = m[1];
      const inner = m[2];
      const img = inner.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;
      const category = inner.match(/cast-diary-card__category">([^<]*)</)?.[1] ?? null;
      const datetime = inner.match(/<time[^>]+datetime="([^"]+)"/)?.[1] ?? null;
      const title = decodeEntities(inner.match(/cast-diary-card__title">([\s\S]*?)<\/h3>/)?.[1] ?? "");
      const body = decodeEntities(inner.match(/cast-diary-card__text">([\s\S]*?)<\/p>/)?.[1] ?? "");
      cards.push({ external_url: href, image_src: img, category, datetime, title, body });
    }

    if (cards.length === 0) throw new Error("写メ日記のカードが取得できませんでした");

    // 画像を自社ストレージへ保存
    const bucket = "cast-photos";
    const savedRows: any[] = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      let publicUrl: string | null = null;
      if (c.image_src) {
        try {
          const imgRes = await fetch(c.image_src, {
            headers: { "User-Agent": UA, Referer: url },
          });
          if (imgRes.ok) {
            const buf = new Uint8Array(await imgRes.arrayBuffer());
            const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
            const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
            const path = `estama-diary/${cast_id}/${i}.${ext}`;
            const up = await sb.storage.from(bucket).upload(path, buf, { contentType: ct, upsert: true });
            if (!up.error) {
              publicUrl = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
            }
          }
        } catch (_e) { /* 画像失敗はスキップ */ }
      }
      savedRows.push({
        cast_id,
        title: c.title || null,
        category: c.category || null,
        image_url: publicUrl,
        body: c.body || null,
        posted_at: c.datetime || null,
        external_url: c.external_url || null,
        display_order: i,
      });
    }

    // 既存を置き換え
    await sb.from("cast_diaries").delete().eq("cast_id", cast_id);
    const { error: insErr } = await sb.from("cast_diaries").insert(savedRows);
    if (insErr) throw new Error("保存に失敗: " + insErr.message);

    return new Response(JSON.stringify({ success: true, count: savedRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
