// エステ魂のセラピストプロフィールページから写メ日記カードを取り込み、
// 画像を自社ストレージへ保存して cast_diaries に登録する。
// 管理画面の「写メ日記を取り込む」ボタンから cast_id を渡して呼び出す。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  allowedEstamaUrl,
  findSourceDiaryMatch,
  type ImportedDiaryCandidate,
  type SourceDiaryCandidate,
} from "./dedupe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";
const MAX_CARDS = 12;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type SavedDiaryRow = {
  cast_id: string;
  title: string | null;
  category: string | null;
  image_url: string | null;
  body: string | null;
  posted_at: string | null;
  external_url: string | null;
  display_order: number;
};

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

async function fetchEstamaResource(rawUrl: string, referer?: string) {
  let url = allowedEstamaUrl(rawUrl, referer);
  if (!url) throw new Error("エステ魂以外のURLは取得できません");

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, ...(referer ? { Referer: referer } : {}) },
      redirect: "manual",
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const next = allowedEstamaUrl(response.headers.get("location") || "", url);
    if (!next || redirects === 3) throw new Error("安全でないリダイレクトを検出しました");
    url = next;
  }
  throw new Error("リダイレクトが多すぎます");
}

async function readLimited(response: Response, maxBytes: number) {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > maxBytes) throw new Error("取得データが上限を超えています");
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("取得データが上限を超えています");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POSTのみ利用できます" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "ログインが必要です" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "ログインが必要です" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cast_id } = await req.json();
    if (typeof cast_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cast_id)) {
      throw new Error("cast_id is required");
    }

    const sb = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: cast, error: castErr } = await sb
      .from("casts")
      .select("id, store_id, estama_profile_url")
      .eq("id", cast_id)
      .single();
    if (castErr || !cast) throw new Error("キャストが見つかりません");
    const { data: canManage, error: permissionError } = await authClient.rpc("can_manage_store", {
      p_store_id: cast.store_id,
    });
    if (permissionError || canManage !== true) {
      return new Response(JSON.stringify({ error: "この店舗の日記を取り込む権限がありません" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = cast.estama_profile_url as string | null;
    if (!url) throw new Error("エステ魂プロフィールURLが未設定です");
    const profileUrl = allowedEstamaUrl(url);
    if (!profileUrl) throw new Error("エステ魂プロフィールURLが不正です");

    // プロフィールページ取得
    const res = await fetchEstamaResource(profileUrl);
    if (!res.ok) throw new Error(`ページ取得失敗: ${res.status}`);
    if (!/^text\/html\b/i.test(res.headers.get("content-type") || "")) {
      throw new Error("プロフィールページの形式が不正です");
    }
    const html = new TextDecoder().decode(await readLimited(res, MAX_HTML_BYTES));

    // 写メ日記セクションを切り出す
    const secStart = html.indexOf('id="TherapistDiary"');
    if (secStart < 0) throw new Error("写メ日記が見つかりませんでした");
    const section = html.slice(secStart, secStart + 40000);

    // 各カードを抽出
    const cardRe = /<a\s+href="([^"]+)"\s+class="cast-diary-card">([\s\S]*?)<\/a>/g;
    const cards: (ImportedDiaryCandidate & {
      external_url: string; image_src: string | null; category: string | null;
    })[] = [];
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(section)) && cards.length < MAX_CARDS) {
      const href = m[1];
      const inner = m[2];
      const img = inner.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;
      const category = inner.match(/cast-diary-card__category">([^<]*)</)?.[1] ?? null;
      const datetime = inner.match(/<time[^>]+datetime="([^"]+)"/)?.[1] ?? null;
      const title = decodeEntities(inner.match(/cast-diary-card__title">([\s\S]*?)<\/h3>/)?.[1] ?? "");
      const body = decodeEntities(inner.match(/cast-diary-card__text">([\s\S]*?)<\/p>/)?.[1] ?? "");
      cards.push({
        external_url: allowedEstamaUrl(href, profileUrl) || "",
        image_src: img ? allowedEstamaUrl(img, profileUrl) : null,
        category,
        datetime,
        title,
        body,
      });
    }

    const safeCards = cards.filter((card) => Boolean(card.external_url));

    if (safeCards.length === 0) throw new Error("写メ日記のカードが取得できませんでした");

    // 同時投稿ですでにHPへ掲載した日記は、魂から再取込しても二重登録しない。
    const { data: sourceRows, error: sourceError } = await sb
      .from("cast_diaries")
      .select("id,title,body,posted_at,external_url")
      .eq("cast_id", cast_id)
      .not("source_post_id", "is", null);
    if (sourceError) throw new Error("同時投稿済み日記の確認に失敗: " + sourceError.message);
    const remainingSources = [...((sourceRows || []) as SourceDiaryCandidate[])];
    const cardsToImport: typeof cards = [];
    let linkedExisting = 0;
    for (const card of safeCards) {
      const source = findSourceDiaryMatch(card, remainingSources);
      if (!source) {
        cardsToImport.push(card);
        continue;
      }
      remainingSources.splice(remainingSources.findIndex((row) => row.id === source.id), 1);
      linkedExisting += 1;
      if (source.external_url !== card.external_url) {
        const { error: linkError } = await sb
          .from("cast_diaries")
          .update({ external_url: card.external_url })
          .eq("id", source.id)
          .eq("cast_id", cast_id);
        if (linkError) throw new Error("同時投稿済み日記の紐付けに失敗: " + linkError.message);
      }
    }

    // 画像を自社ストレージへ保存
    const bucket = "cast-photos";
    const savedRows: SavedDiaryRow[] = [];
    for (let i = 0; i < cardsToImport.length; i++) {
      const c = cardsToImport[i];
      let publicUrl: string | null = null;
      if (c.image_src) {
        try {
          const imgRes = await fetchEstamaResource(c.image_src, profileUrl);
          if (imgRes.ok) {
            const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
            if (!/^image\/(jpeg|png|webp)\b/i.test(ct)) {
              throw new Error("画像形式が不正です");
            }
            const buf = await readLimited(imgRes, MAX_IMAGE_BYTES);
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

    // エステ魂から取り込んだ行だけを置き換える。
    // 同時投稿から作成したHP写メ日記（source_post_idあり）は保持する。
    const { error: deleteErr } = await sb
      .from("cast_diaries")
      .delete()
      .eq("cast_id", cast_id)
      .is("source_post_id", null);
    if (deleteErr) throw new Error("既存データの整理に失敗: " + deleteErr.message);
    if (savedRows.length) {
      const { error: insErr } = await sb.from("cast_diaries").insert(savedRows);
      if (insErr) throw new Error("保存に失敗: " + insErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      count: savedRows.length,
      linkedExisting,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
