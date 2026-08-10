import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";
const ESTAMA_SHOP_ID = "51445";
const REVIEW_LIST_URL = `https://estama.jp/shop/${ESTAMA_SHOP_ID}/reviewlist/`;
// 自動同期開始時点の口コミ。このIDより前の過去口コミは遡って公開しない。
const FIRST_REVIEW_ID = 468117;
const MAX_HTML_BYTES = 2_000_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

const CATEGORY_LABELS = [
  "ルックスS級",
  "非日常感",
  "ゴッドハンド指数",
  "値段以上のサービス",
  "ハイレベルなおもてなし",
  "あぁぁぁぁぁ！",
] as const;

type CategoryLabel = typeof CATEGORY_LABELS[number];

type ParsedReview = {
  source_external_id: string;
  reviewer_name: string;
  reviewed_at: string;
  visit_frequency: string | null;
  amount: string | null;
  therapist_name: string;
  therapist_external_id: string | null;
  therapist_profile_url: string | null;
  rating: number;
  category_scores: Partial<Record<CategoryLabel, number>>;
  review_title: string | null;
  review_text: string;
  source_url: string;
};

type ElementLike = {
  textContent?: string | null;
  innerHTML?: string | null;
  getAttribute: (name: string) => string | null;
  querySelector: (selector: string) => ElementLike | null;
};

class SyncError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
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

function compactText(value: unknown): string {
  return decodeEntities(String(value ?? "")).replace(/[\s\u3000]+/g, " ").trim();
}

function nodeText(node: ElementLike | null | undefined): string {
  return compactText(node?.textContent);
}

function blockText(node: ElementLike | null): string {
  if (!node) return "";
  const html = String(node.innerHTML ?? node.textContent ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "");

  return decodeEntities(html)
    .replace(/\r/g, "")
    .replace(/[ \t\u3000]+\n/g, "\n")
    .replace(/\n[ \t\u3000]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function formatDate(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseReviewedAt(text: string): string | null {
  const match = text.match(/(20\d{2})[/.年-](\d{1,2})[/.月-](\d{1,2})(?:日)?/u);
  return match ? formatDate(match[1], match[2], match[3]) : null;
}

function parseTherapist(item: ElementLike): {
  name: string;
  externalId: string | null;
  profileUrl: string | null;
} {
  const anchor = item.querySelector(`a.review-link[href*="/shop/${ESTAMA_SHOP_ID}/cast/"]`)
    ?? item.querySelector(`a[href*="/shop/${ESTAMA_SHOP_ID}/cast/"]`);
  const rawHref = anchor?.getAttribute("href") ?? "";
  let profileUrl: string | null = null;
  try {
    profileUrl = rawHref ? new URL(rawHref, REVIEW_LIST_URL).toString() : null;
  } catch {
    profileUrl = null;
  }

  const externalId = profileUrl?.match(/\/cast\/(\d+)\/?/)?.[1] ?? null;
  const nameNode = anchor?.querySelector("span.bold.font-size-24")
    ?? anchor?.querySelector(".bold")
    ?? anchor;
  const name = nodeText(nameNode).replace(/\s*[（(]\d{1,2}[）)]\s*$/u, "").trim();
  return { name, externalId, profileUrl };
}

function parseCategoryScores(itemText: string): Partial<Record<CategoryLabel, number>> {
  const scores: Partial<Record<CategoryLabel, number>> = {};
  for (const label of CATEGORY_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = itemText.match(new RegExp(`${escaped}\\s*[：:]?\\s*([1-5](?:\\.\\d)?)`, "u"));
    if (!match) continue;
    const score = Number(match[1]);
    if (Number.isFinite(score) && score >= 1 && score <= 5) scores[label] = score;
  }
  return scores;
}

export function parseEstamaReviews(html: string): ParsedReview[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new SyncError("エスたまの口コミページを解析できませんでした", 422);

  const reviews: ParsedReview[] = [];
  for (const node of doc.querySelectorAll("li.cast_review__item")) {
    const item = node as unknown as ElementLike;
    const reviewBox = item.querySelector("[id^='review_']") ?? item;
    const externalId = String(reviewBox.getAttribute("id") ?? "").match(/^review_(\d+)$/)?.[1];
    if (!externalId || Number(externalId) < FIRST_REVIEW_ID) continue;

    const itemText = nodeText(item);
    const reviewedAt = parseReviewedAt(itemText);
    const ratingMatch = nodeText(item.querySelector(".cast_review_score")).match(/([1-5](?:\.\d)?)/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : Number.NaN;
    const therapist = parseTherapist(item);
    const reviewText = blockText(
      item.querySelector(".cast_review__item__box.text-wrap.p0.mt10 p.comment")
        ?? item.querySelector("p.comment"),
    );

    if (!reviewedAt || !Number.isFinite(rating) || rating < 1 || rating > 5 || !therapist.name || !reviewText) {
      console.warn("Skipping incomplete Estama review", { externalId });
      continue;
    }

    const reviewerName = nodeText(item.querySelector(".cast_review__item__member .text_gray"))
      .replace(/\s*さん\s*$/u, "")
      .trim() || "お客様";
    const title = nodeText(
      item.querySelector(".cast_review__item__inner.bold.mb10.mt15 p.font-size-16")
        ?? item.querySelector(".cast_review__item__inner.bold p"),
    );
    const visitFrequency = itemText.match(/[（(]((?:初めて|\d+回目|\d+回以上))[）)]/u)?.[1]
      ?? itemText.match(/(?:来店|利用)回数\s*[：:]\s*([^\s]+)/u)?.[1]
      ?? null;
    const amount = itemText.match(/(\d{1,3}(?:,\d{3})*円?\s*[〜~～-]\s*\d{1,3}(?:,\d{3})*円)/u)?.[1]
      ?? null;

    reviews.push({
      source_external_id: externalId,
      reviewer_name: reviewerName,
      reviewed_at: reviewedAt,
      visit_frequency: visitFrequency,
      amount,
      therapist_name: therapist.name,
      therapist_external_id: therapist.externalId,
      therapist_profile_url: therapist.profileUrl,
      rating,
      category_scores: parseCategoryScores(itemText),
      review_title: title || null,
      review_text: reviewText,
      source_url: `${REVIEW_LIST_URL}#review_${externalId}`,
    });
  }

  return reviews;
}

function getAdminKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new SyncError("Supabaseの管理用鍵がありません");
  const parsed = JSON.parse(raw) as Record<string, string>;
  const key = parsed.default || Object.values(parsed)[0];
  if (!key) throw new SyncError("Supabaseの管理用鍵を取得できません");
  return key;
}

async function fetchReviews(): Promise<ParsedReview[]> {
  const response = await fetch(REVIEW_LIST_URL, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
    },
  });
  if (!response.ok) throw new SyncError(`エスたまの口コミを取得できませんでした（${response.status}）`, 502);

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_HTML_BYTES) throw new SyncError("口コミページのサイズが大きすぎます", 413);

  const html = await response.text();
  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
    throw new SyncError("口コミページのサイズが大きすぎます", 413);
  }
  if (/Site Unavailable|Unable to access this site/i.test(html)) {
    throw new SyncError("現在エスたまへ接続できません", 502);
  }

  return parseEstamaReviews(html);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "POSTのみ利用できます" }, 405);

  try {
    const payload = await request.json().catch(() => ({})) as { dry_run?: unknown };
    const reviews = await fetchReviews();

    if (payload.dry_run === true) {
      return json({ success: true, dry_run: true, fetched: reviews.length, reviews });
    }

    if (reviews.length === 0) return json({ success: true, fetched: 0, upserted: 0, review_ids: [] });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
      ?? "https://imrxzkivwrkqbhqfbbes.supabase.co";
    const admin = createClient(supabaseUrl, getAdminKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const syncedAt = new Date().toISOString();
    const rows = reviews.map((review) => ({
      store_id: STORE_ID,
      rating: review.rating,
      therapist_name: review.therapist_name,
      review_text: review.review_text,
      reviewer_name: review.reviewer_name,
      review_title: review.review_title,
      reviewed_at: review.reviewed_at,
      source_provider: "estama",
      source_external_id: review.source_external_id,
      source_url: review.source_url,
      source_details: {
        category_scores: review.category_scores,
        visit_frequency: review.visit_frequency,
        amount: review.amount,
        therapist_external_id: review.therapist_external_id,
        therapist_profile_url: review.therapist_profile_url,
      },
      synced_at: syncedAt,
      created_at: `${review.reviewed_at}T03:00:00.000Z`,
      allow_publish: true,
      is_published: true,
    }));

    const { data, error } = await admin
      .from("customer_reviews")
      .upsert(rows, { onConflict: "store_id,source_provider,source_external_id" })
      .select("id, source_external_id");
    if (error) throw new SyncError(`口コミの保存に失敗しました: ${error.message}`);

    return json({
      success: true,
      fetched: reviews.length,
      upserted: data?.length ?? 0,
      review_ids: reviews.map((review) => review.source_external_id),
    });
  } catch (error) {
    const status = error instanceof SyncError ? error.status : 500;
    const message = error instanceof Error ? error.message : "口コミの同期に失敗しました";
    console.error("sync-estama-reviews:", message);
    return json({ success: false, error: message }, status);
  }
});
