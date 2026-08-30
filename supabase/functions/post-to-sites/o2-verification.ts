export type O2PostReference = {
  id: string;
  url: string;
};

export type O2PostDetailEvidence = {
  bodyMatched: boolean;
  imageMatched: boolean;
};

const O2_HOSTS = new Set(["m-sns.net", "www.m-sns.net"]);

const decodeCodePoint = (match: string, code: string, radix: number) => {
  const value = Number.parseInt(code, radix);
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : match;
};

export const decodeO2Html = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (match, code: string) => decodeCodePoint(match, code, 16))
  .replace(/&#([0-9]+);/g, (match, code: string) => decodeCodePoint(match, code, 10))
  .replaceAll("&nbsp;", " ")
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#039;", "'")
  .replaceAll("&apos;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

export const normalizeO2Text = (value: string) => decodeO2Html(value)
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .normalize("NFC")
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .replace(/\s+/g, " ")
  .trim();

export const o2PostReferenceFromUrl = (rawUrl: string, baseUrl = "https://m-sns.net/"): O2PostReference | null => {
  try {
    const url = new URL(decodeO2Html(rawUrl), baseUrl);
    if (!O2_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.pathname.replace(/\/+$/, "") !== "/post") return null;
    const id = (url.searchParams.get("id") || "").trim();
    if (!/^\d+$/.test(id)) return null;
    return { id, url: `https://m-sns.net/post/?id=${id}` };
  } catch {
    return null;
  }
};

export const extractO2PostReferences = (html: string, baseUrl: string): O2PostReference[] => {
  const references = new Map<string, O2PostReference>();
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const reference = o2PostReferenceFromUrl(match[1], baseUrl);
    if (reference && !references.has(reference.id)) references.set(reference.id, reference);
  }
  return [...references.values()];
};

export const newO2PostReferences = (
  previousIds: ReadonlySet<string>,
  groups: ReadonlyArray<ReadonlyArray<O2PostReference>>,
) => {
  const references = new Map<string, O2PostReference>();
  for (const group of groups) {
    for (const reference of group) {
      if (!previousIds.has(reference.id) && !references.has(reference.id)) {
        references.set(reference.id, reference);
      }
    }
  }
  return [...references.values()];
};

const hasPostImage = (html: string) => {
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = match[1];
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1] || "";
    const label = /\baria-label\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1] || "";
    if (/投稿画像/.test(decodeO2Html(`${alt} ${label}`))) return true;
  }
  return false;
};

export const inspectO2PostDetail = (html: string, expectedBody: string): O2PostDetailEvidence => {
  const actualText = normalizeO2Text(html);
  const normalizedBody = normalizeO2Text(expectedBody);
  return {
    bodyMatched: Boolean(normalizedBody) && actualText.includes(normalizedBody),
    imageMatched: hasPostImage(html),
  };
};
