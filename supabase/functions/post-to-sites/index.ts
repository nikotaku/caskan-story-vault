import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const O2_BASE = "https://m-sns.net";
const O2_LOGIN = `${O2_BASE}/cast/login/`;
const ALLOWED_ORIGINS = new Set([
  "https://zenryokuesthe.com",
  "https://www.zenryokuesthe.com",
  "http://localhost:5173",
  "http://localhost:8080",
]);

type JsonRecord = Record<string, unknown>;
type PostRecord = {
  id: string;
  cast_id: string;
  title: string | null;
  body: string;
  image_urls: string[] | null;
  hp_status: string;
  o2_status: string;
  esutama_status: string;
  o2_attempts: number;
};

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://zenryokuesthe.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (req: Request, value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "private, no-store" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const body = await req.json() as JsonRecord;
    const postId = typeof body.post_id === "string" ? body.post_id : "";
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";
    if (!postId || !accessToken) return json(req, { error: "投稿IDとポータルトークンが必要です" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: post, error: postError } = await admin.from("cast_posts")
      .select("id,cast_id,title,body,image_urls,hp_status,o2_status,esutama_status,o2_attempts")
      .eq("id", postId)
      .maybeSingle<PostRecord>();
    if (postError) throw postError;
    const { data: cast } = post
      ? await admin.from("casts").select("id,access_token").eq("id", post.cast_id).maybeSingle()
      : { data: null };
    if (!post || cast?.access_token !== accessToken) return json(req, { error: "ポータルの認証情報が正しくありません" }, 401);
    if (post.o2_status === "posted") return json(req, { success: true, results: { o2: { status: "posted", skipped: true } } });
    if (post.o2_status === "posting") return json(req, { success: true, results: { o2: { status: "posting", skipped: true } } });

    const { data: credential } = await admin.from("cast_site_credentials")
      .select("login_id,password")
      .eq("cast_id", post.cast_id)
      .eq("site", "o2")
      .maybeSingle();
    if (!credential?.login_id || !credential?.password) {
      const message = "O2のログイン情報が未設定です";
      await admin.from("cast_posts").update({ o2_status: "skipped", o2_error: message }).eq("id", post.id);
      await updateOverallStatus(admin, post.id);
      return json(req, { success: true, results: { o2: { status: "skipped", error: message } } });
    }

    const { data: locked } = await admin.from("cast_posts").update({
      o2_status: "posting",
      o2_error: null,
      o2_attempts: Number(post.o2_attempts || 0) + 1,
      last_attempt_at: new Date().toISOString(),
    }).eq("id", post.id).in("o2_status", ["pending", "failed", "skipped"]).select("id").maybeSingle();
    if (!locked) return json(req, { success: true, results: { o2: { status: "posting", skipped: true } } });

    try {
      const result = await postToO2(credential.login_id, credential.password, post);
      await admin.from("cast_posts").update({ o2_status: "posted", o2_error: null }).eq("id", post.id);
      await updateOverallStatus(admin, post.id);
      return json(req, { success: true, results: { o2: result } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from("cast_posts").update({ o2_status: "failed", o2_error: message }).eq("id", post.id);
      await updateOverallStatus(admin, post.id);
      return json(req, { success: false, results: { o2: { status: "failed", error: message } } }, 422);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(req, { error: message }, 500);
  }
});

async function updateOverallStatus(admin: ReturnType<typeof createClient>, postId: string) {
  const { data } = await admin.from("cast_posts").select("hp_status,o2_status,esutama_status").eq("id", postId).single();
  if (!data) return;
  const statuses = [data.hp_status, data.o2_status, data.esutama_status];
  const complete = statuses.every((status) => status === "posted");
  const failed = statuses.some((status) => status === "failed" || status === "skipped");
  await admin.from("cast_posts").update({
    status: complete ? "posted" : failed ? "failed" : "pending",
    posted_at: complete ? new Date().toISOString() : null,
  }).eq("id", postId);
}

const decodeHtml = (value: string) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#039;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

const attributes = (html: string) => {
  const result: Record<string, string> = {};
  for (const match of html.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = decodeHtml(match[2]);
  return result;
};

class CookieJar {
  values = new Map<string, string>();

  capture(response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = headers.getSetCookie?.() || [response.headers.get("set-cookie") || ""];
    for (const raw of cookies) {
      for (const part of raw.split(/,(?=[^;,]+=)/)) {
        const pair = part.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) this.values.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }
    }
  }

  header() {
    return [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function request(jar: CookieJar, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (jar.values.size) headers.set("Cookie", jar.header());
  headers.set("User-Agent", "Mozilla/5.0 (compatible; ZenryokuEstheTherapistPortal/1.0)");
  const response = await fetch(url, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  jar.capture(response);
  return response;
}

async function follow(jar: CookieJar, response: Response, fallbackUrl: string) {
  if (![301, 302, 303, 307, 308].includes(response.status)) return response;
  const location = response.headers.get("location");
  return request(jar, location ? new URL(location, fallbackUrl).toString() : O2_BASE, { method: "GET" });
}

type HtmlForm = { action: string; method: string; html: string; attributes: Record<string, string> };

const formsFrom = (html: string, baseUrl: string): HtmlForm[] => [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((match) => {
  const attrs = attributes(match[1]);
  return {
    action: new URL(attrs.action || baseUrl, baseUrl).toString(),
    method: (attrs.method || "post").toUpperCase(),
    html: match[2],
    attributes: attrs,
  };
});

const hiddenFields = (html: string) => {
  const fields = new Map<string, string>();
  for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = attributes(match[1]);
    if (attrs.name && (attrs.type || "text").toLowerCase() === "hidden") fields.set(attrs.name, attrs.value || "");
  }
  return fields;
};

const fieldNames = (html: string, tag: "input" | "textarea") => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))]
  .map((match) => attributes(match[1]))
  .filter((attrs) => attrs.name);

const pageLinks = (html: string, baseUrl: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map((match) => ({ attrs: attributes(match[1]), text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }))
  .filter(({ attrs }) => attrs.href)
  .map(({ attrs, text }) => ({ url: new URL(attrs.href, baseUrl).toString(), text }));

async function postToO2(loginId: string, password: string, post: PostRecord) {
  const jar = new CookieJar();
  const loginPage = await request(jar, O2_LOGIN);
  const loginHtml = await loginPage.text();
  const loginForm = formsFrom(loginHtml, O2_LOGIN).find((form) => /type=["']password/i.test(form.html));
  if (!loginForm) throw new Error("O2のログインフォームが見つかりません（画面仕様変更の可能性）");
  const loginBody = new URLSearchParams();
  for (const [name, value] of hiddenFields(loginForm.html)) loginBody.set(name, value);
  loginBody.set("username", loginId);
  loginBody.set("password", password);
  let loggedIn = await request(jar, loginForm.action, {
    method: loginForm.method,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: O2_LOGIN },
    body: loginBody.toString(),
  });
  loggedIn = await follow(jar, loggedIn, loginForm.action);
  let currentUrl = loggedIn.url || O2_BASE;
  let currentHtml = await loggedIn.text();
  if (loggedIn.status >= 400 || /name=["'](?:username|password)["']/i.test(currentHtml) && /ログイン/.test(currentHtml)) {
    throw new Error("O2へログインできません。ID・パスワードを確認してください");
  }

  let postForm = formsFrom(currentHtml, currentUrl).find((form) =>
    /<textarea\b/i.test(form.html) && !/type=["']password/i.test(form.html),
  );
  if (!postForm) {
    const links = pageLinks(currentHtml, currentUrl).filter(({ text, url }) =>
      /投稿|タイムライン|写メ日記|新規作成/.test(text) || /post|timeline|diary|create/i.test(url),
    ).slice(0, 8);
    for (const link of links) {
      const page = await request(jar, link.url, { headers: { Referer: currentUrl } });
      if (page.status >= 400) continue;
      const html = await page.text();
      const candidate = formsFrom(html, link.url).find((form) => /<textarea\b/i.test(form.html) && !/type=["']password/i.test(form.html));
      if (candidate) {
        postForm = candidate;
        currentUrl = link.url;
        break;
      }
    }
  }
  if (!postForm) throw new Error("O2の投稿フォームが見つかりません（画面仕様変更の可能性）。投稿は行っていません");

  const form = new FormData();
  for (const [name, value] of hiddenFields(postForm.html)) form.set(name, value);
  const textareas = fieldNames(postForm.html, "textarea");
  const inputs = fieldNames(postForm.html, "input");
  const bodyName = textareas.find((field) => /body|content|text|message|post|caption/i.test(field.name))?.name || textareas[0]?.name;
  if (!bodyName) throw new Error("O2の投稿本文欄を特定できません。投稿は行っていません");
  form.set(bodyName, post.body);
  const titleName = inputs.find((field) => /title|subject/i.test(field.name))?.name;
  if (titleName && post.title) form.set(titleName, post.title);

  const fileFields = inputs.filter((field) => (field.type || "").toLowerCase() === "file");
  const imageUrls = Array.isArray(post.image_urls) ? post.image_urls.slice(0, 3) : [];
  for (let index = 0; index < imageUrls.length && fileFields.length; index += 1) {
    const image = await downloadImage(imageUrls[index], index);
    const fieldName = fileFields[Math.min(index, fileFields.length - 1)].name;
    form.append(fieldName, image.blob, image.name);
  }

  let posted = await request(jar, postForm.action, {
    method: postForm.method === "GET" ? "POST" : postForm.method,
    headers: { Referer: currentUrl },
    body: form,
  });
  posted = await follow(jar, posted, postForm.action);
  const responseHtml = await posted.text();
  if (posted.status >= 400) throw new Error(`O2投稿エラー（HTTP ${posted.status}）`);
  if (/name=["'](?:username|password)["']/i.test(responseHtml) && /ログイン/.test(responseHtml)) {
    throw new Error("O2のログイン有効期限が切れました。投稿は完了していません");
  }
  const errors = [...responseHtml.matchAll(/<(?:div|p|li)[^>]+class=["'][^"']*(?:error|danger|invalid)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|li)>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (errors.length) throw new Error(`O2: ${errors.join(" / ").slice(0, 300)}`);
  return { status: "posted", url: posted.url || postForm.action, images: Math.min(imageUrls.length, fileFields.length) };
}

async function downloadImage(rawUrl: string, index: number) {
  const url = new URL(rawUrl);
  const allowed = url.protocol === "https:" && (
    url.hostname.endsWith(".supabase.co") ||
    url.hostname === "drive.google.com" ||
    url.hostname === "storage.googleapis.com"
  );
  if (!allowed) throw new Error(`画像${index + 1}の保存先が許可されていません`);
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`画像${index + 1}を取得できません（HTTP ${response.status}）`);
  const contentType = response.headers.get("content-type") || "";
  if (!/^image\/(jpeg|png|webp)$/i.test(contentType)) throw new Error(`画像${index + 1}はJPEG・PNG・WebPのみ対応です`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 10 * 1024 * 1024) throw new Error(`画像${index + 1}が10MBを超えています`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error(`画像${index + 1}が10MBを超えています`);
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return { blob: new Blob([buffer], { type: contentType }), name: `photo-${index + 1}.${extension}` };
}
