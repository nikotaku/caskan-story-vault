export type ImportedDiaryCandidate = {
  external_url: string;
  title: string;
  body: string;
  datetime: string | null;
};

export type SourceDiaryCandidate = {
  id: string;
  title: string | null;
  body: string;
  posted_at: string;
  external_url: string | null;
};

export function allowedEstamaUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    const hostname = url.hostname.toLowerCase();
    const allowedHost = hostname === "estama.jp" || hostname.endsWith(".estama.jp");
    if (
      url.protocol !== "https:"
      || !allowedHost
      || url.username
      || url.password
      || (url.port && url.port !== "443")
    ) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

const normalizeText = (value: string | null | undefined) => (value || "")
  .normalize("NFKC")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const bodyKey = (value: string) => normalizeText(value)
  .replace(/[.…・]+$/u, "")
  .trim();

const bodiesMatch = (left: string, right: string) => {
  const a = bodyKey(left);
  const b = bodyKey(right);
  if (!a || !b) return a === b;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.startsWith(shorter);
};

const comparableBodyLength = (left: string, right: string) =>
  Math.min(bodyKey(left).length, bodyKey(right).length);

const timeDistance = (left: string | null, right: string) => {
  const leftMs = Date.parse(left || "");
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs)
    ? Math.abs(leftMs - rightMs)
    : Number.POSITIVE_INFINITY;
};

export function findSourceDiaryMatch(
  imported: ImportedDiaryCandidate,
  sources: SourceDiaryCandidate[],
) {
  const exactUrl = sources.find((source) =>
    Boolean(source.external_url) && source.external_url === imported.external_url
  );
  if (exactUrl) return exactUrl;

  // 長い本文の一致は十分に固有なので投稿時刻に依存させない。
  // 短文は同文の再利用があり得るため、魂側の遅延再送を含む24時間以内に限定する。
  const shortBodyTimeDistanceMs = 24 * 60 * 60 * 1000;
  return sources
    .filter((source) =>
      normalizeText(source.title || "写メ日記") === normalizeText(imported.title)
      && bodiesMatch(source.body, imported.body)
      && (
        comparableBodyLength(source.body, imported.body) >= 24
        || timeDistance(imported.datetime, source.posted_at) <= shortBodyTimeDistanceMs
      )
    )
    .sort((left, right) =>
      timeDistance(imported.datetime, left.posted_at)
      - timeDistance(imported.datetime, right.posted_at)
    )[0] || null;
}
