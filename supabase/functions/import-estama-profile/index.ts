import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";
const MAX_HTML_BYTES = 2_000_000;
const MAX_PHOTOS = 6;

const FEATURE_LABELS = new Set([
  "新人", "経験豊富", "業界未経験", "施術上手", "上品", "甘えん坊", "おとなしい", "おっとり",
  "明るい", "優しい", "努力家", "礼儀正しい", "清楚系", "天然系", "セクシー系", "お姉様系",
  "お嬢様系", "ギャル系", "美人系", "熟女系", "かわいい系", "アイドル系", "癒し系", "妹系",
  "モデル体型", "小柄", "色白肌",
]);

class ImportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function compactText(value: string): string {
  return decodeEntities(value).replace(/[\s\u3000]+/g, " ").trim();
}

function nodeText(node: any): string {
  return compactText(node?.textContent ?? "");
}

function blockText(node: any): string {
  if (!node) return "";
  const html = String(node.innerHTML ?? node.textContent ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "");

  return decodeEntities(html)
    .replace(/\r/g, "")
    .replace(/[ \t\u3000]+\n/g, "\n")
    .replace(/\n[ \t\u3000]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeProfileUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new ImportError("エスたまのセラピストページURLを入力してください");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ImportError("URLの形式が正しくありません");
  }

  if (parsed.protocol !== "https:" || !["estama.jp", "www.estama.jp"].includes(parsed.hostname.toLowerCase())) {
    throw new ImportError("estama.jp のURLのみ取り込めます");
  }

  const match = parsed.pathname.match(/^\/shop\/(\d+)\/cast\/(\d+)\/?$/);
  if (!match) {
    throw new ImportError("エスたまのセラピスト詳細ページURLを入力してください");
  }

  return `https://estama.jp/shop/${match[1]}/cast/${match[2]}/`;
}

function collectProfilePairs(doc: any): Map<string, string> {
  const pairs = new Map<string, string>();

  for (const row of doc.querySelectorAll(".therapist__profile-table tr, .profile-table tr, tr")) {
    const labelNode = row.querySelector("th") ?? row.querySelector("dt");
    const valueNode = row.querySelector("td") ?? row.querySelector("dd");
    const label = nodeText(labelNode).replace(/[：:]$/, "");
    const value = blockText(valueNode);
    if (label && value && !pairs.has(label)) pairs.set(label, value);
  }

  for (const term of doc.querySelectorAll(".therapist__profile-table dt, .profile-table dt, dl dt")) {
    const label = nodeText(term).replace(/[：:]$/, "");
    const value = blockText(term.nextElementSibling);
    if (label && value && !pairs.has(label)) pairs.set(label, value);
  }

  return pairs;
}

function findPair(pairs: Map<string, string>, labels: string[]): string {
  for (const label of labels) {
    const exact = pairs.get(label);
    if (exact) return exact;
  }

  for (const [key, value] of pairs) {
    if (labels.some((label) => key.includes(label))) return value;
  }
  return "";
}

function sectionAfterHeading(doc: any, labels: string[]): string {
  for (const heading of doc.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const headingText = nodeText(heading);
    if (!labels.some((label) => headingText.includes(label))) continue;

    const chunks: string[] = [];
    let sibling = heading.nextElementSibling;
    let inspected = 0;
    while (sibling && inspected < 12) {
      if (/^H[1-6]$/.test(String(sibling.tagName ?? "").toUpperCase())) break;
      const chunk = blockText(sibling);
      if (chunk) chunks.push(chunk);
      sibling = sibling.nextElementSibling;
      inspected += 1;
    }
    if (chunks.length) return chunks.join("\n").trim();
  }
  return "";
}

function firstBlock(doc: any, selectors: string[]): string {
  for (const selector of selectors) {
    const value = blockText(doc.querySelector(selector));
    if (value) return value;
  }
  return "";
}

function parseNameAndAge(doc: any): { name: string; age: number | null } {
  const candidates: string[] = [];
  for (const selector of [
    ".therapist__profile h3",
    ".therapist__name",
    ".therapist__profile-name",
    ".therapist_details h3",
    "main h3",
    "h3",
  ]) {
    for (const node of doc.querySelectorAll(selector)) {
      const value = nodeText(node);
      if (value && !candidates.includes(value)) candidates.push(value);
    }
  }

  for (const candidate of candidates) {
    const match = candidate.match(/^(.+?)\s*[（(](\d{1,2})[）)]\s*$/);
    if (match) return { name: match[1].trim(), age: Number(match[2]) };
  }

  const title = nodeText(doc.querySelector("title"));
  const fallbackName = title.split(/\s+-\s+/)[0]?.trim() ?? "";
  return { name: fallbackName, age: null };
}

function extractNumber(text: string, label: string): number | null {
  const match = text.match(new RegExp(`${label}[.．]?\\s*(\\d{2,3})`, "i"));
  return match ? Number(match[1]) : null;
}

function normalizeExperience(value: string): string {
  const text = compactText(value);
  if (!text) return "";
  if (["1年未満", "1〜3年", "3〜5年", "5年以上"].includes(text)) return text;
  if (/未経験|初心者|1年未満/.test(text)) return "1年未満";

  const years = Number(text.match(/(\d+(?:\.\d+)?)\s*年/)?.[1]);
  if (!Number.isFinite(years)) return "";
  if (years < 1) return "1年未満";
  if (years < 3) return "1〜3年";
  if (years < 5) return "3〜5年";
  return "5年以上";
}

function normalizeBloodType(value: string): string {
  return compactText(value).replace(/型$/u, "").toUpperCase();
}

function normalizePhotoUrl(raw: string, pageUrl: string): string | null {
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const url = new URL(raw, pageUrl);
    if (url.protocol !== "https:" || url.hostname !== "img.estama.jp") return null;
    url.pathname = url.pathname.replace("/100x100/", "/357x556/");
    return url.toString();
  } catch {
    return null;
  }
}

function imageSource(image: any): string {
  const direct = image.getAttribute("data-src") || image.getAttribute("data-lazy") || image.getAttribute("src");
  if (direct) return direct;
  const srcset = image.getAttribute("srcset") || image.getAttribute("data-srcset") || "";
  return srcset.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}

function collectPhotos(doc: any, pageUrl: string): string[] {
  const selectors = [
    ".therapist__gallery img",
    ".therapist__photo img",
    ".therapist__slider img",
    ".therapist-slider img",
    ".swiper img",
    ".slider img",
  ];
  const photos: string[] = [];

  for (const selector of selectors) {
    for (const image of doc.querySelectorAll(selector)) {
      const url = normalizePhotoUrl(imageSource(image), pageUrl);
      if (url && !photos.includes(url)) photos.push(url);
      if (photos.length >= MAX_PHOTOS) return photos;
    }
    if (photos.length) return photos.slice(0, MAX_PHOTOS);
  }

  for (const image of doc.querySelectorAll("main img, img")) {
    const url = normalizePhotoUrl(imageSource(image), pageUrl);
    if (!url || !url.includes("/cast/")) continue;
    if (!photos.includes(url)) photos.push(url);
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

function collectFeatures(doc: any): string[] {
  const features: string[] = [];
  const root = doc.querySelector(".therapist__profile") ?? doc.querySelector("main") ?? doc;
  for (const node of root.querySelectorAll("li, .icon-badge, [class*='feature']")) {
    const value = nodeText(node);
    if (FEATURE_LABELS.has(value) && !features.includes(value)) features.push(value);
    if (features.length >= 4) break;
  }
  return features;
}

function firstSocialLink(doc: any, hostnames: string[]): string {
  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";
    try {
      const url = new URL(href);
      if (hostnames.includes(url.hostname.toLowerCase())) return url.toString();
    } catch {
      // Relative URLs cannot be social-profile links.
    }
  }
  return "";
}

function xAccountFromUrl(url: string): string {
  if (!url) return "";
  try {
    const username = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
    return username ? `@${username}` : "";
  } catch {
    return "";
  }
}

export function parseEstamaProfile(html: string, sourceUrl: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new ImportError("プロフィールページを解析できませんでした", 422);

  const { name, age } = parseNameAndAge(doc);
  if (!name || /Site Unavailable|ページが見つかりません/i.test(name)) {
    throw new ImportError("セラピスト情報が見つかりませんでした。URLを確認してください", 422);
  }

  const pairs = collectProfilePairs(doc);
  const profileRoot = doc.querySelector(".therapist__profile") ?? doc.querySelector("main") ?? doc.body;
  const profileText = nodeText(profileRoot);
  const height = extractNumber(profileText, "T");
  const bust = extractNumber(profileText, "B");
  const waist = extractNumber(profileText, "W");
  const hip = extractNumber(profileText, "H");
  const cupSize = profileText.match(/B[.．]?\s*\d{2,3}\s*[（(]([A-J])[）)]/i)?.[1]?.toUpperCase() ?? null;
  const bodySize = [bust, waist, hip].some((value) => value !== null)
    ? `${bust ?? ""}/${waist ?? ""}/${hip ?? ""}`
    : "";

  const therapistMessage = firstBlock(doc, [
    ".therapist__message",
    ".therapist-message",
    "[class*='therapist'][class*='message']",
  ]) || sectionAfterHeading(doc, ["セラピストからのメッセージ", "セラピストからのコメント"]);

  const shopComment = firstBlock(doc, [
    ".therapist__shop-comment",
    ".shop-comment",
    "[class*='shop'][class*='comment']",
    ".therapist__description",
  ]) || sectionAfterHeading(doc, ["お店からのコメント", "店舗からのコメント"]);

  const xUrl = firstSocialLink(doc, ["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
  const experienceRaw = findPair(pairs, ["エステ歴", "セラピスト歴", "経験年数"]);

  return {
    source_url: sourceUrl,
    name,
    age,
    height,
    bust,
    waist,
    hip,
    cup_size: cupSize,
    body_size: bodySize,
    hometown: findPair(pairs, ["出身地", "出身"]),
    blood_type: normalizeBloodType(findPair(pairs, ["血液型"])),
    therapist_experience: normalizeExperience(experienceRaw),
    favorite_techniques: findPair(pairs, ["得意な施術", "得意施術"]),
    favorite_food: findPair(pairs, ["好きな食べ物"]),
    ideal_type: findPair(pairs, ["好きな男性のタイプ", "好きなタイプ"]),
    celebrity_lookalike: findPair(pairs, ["似ている芸能人"]),
    day_off_activities: findPair(pairs, ["休みの日は何してる？", "休日の過ごし方"]),
    hobbies: findPair(pairs, ["趣味・特技", "趣味", "特技"]),
    therapist_comment: therapistMessage.replace(/^セラピストからの(?:メッセージ|コメント)\s*/u, "").trim(),
    shop_comment: shopComment.replace(/^(?:お店|店舗)からのコメント\s*/u, "").trim(),
    features: collectFeatures(doc),
    photos: collectPhotos(doc, sourceUrl),
    x_account: xAccountFromUrl(xUrl),
    instagram_url: firstSocialLink(doc, ["instagram.com", "www.instagram.com"]),
    blog_url: firstSocialLink(doc, ["m-sns.net", "www.m-sns.net"]),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POSTのみ利用できます" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sourceUrl = normalizeProfileUrl(body?.url);
    const response = await fetch(sourceUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
      },
    });

    if (!response.ok) {
      throw new ImportError(`エスたまのページを取得できませんでした（${response.status}）`, 502);
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) throw new ImportError("ページのサイズが大きすぎます", 413);

    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
      throw new ImportError("ページのサイズが大きすぎます", 413);
    }
    if (/Site Unavailable|Unable to access this site/i.test(html)) {
      throw new ImportError("現在エスたまへ接続できません。少し時間を置いて再度お試しください", 502);
    }

    const profile = parseEstamaProfile(html, sourceUrl);
    return json({ success: true, profile });
  } catch (error) {
    const status = error instanceof ImportError ? error.status : 500;
    const message = error instanceof Error ? error.message : "プロフィールの取得に失敗しました";
    console.error("import-estama-profile:", message);
    return json({ error: message }, status);
  }
});
