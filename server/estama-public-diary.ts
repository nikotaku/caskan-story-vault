export type PublicDiaryCandidate = {
  title: string;
  text: string;
  castHrefs: string[];
  photos: Array<{ alt: string; src: string }>;
  headingCount: number;
  publishedAt: string;
};

export type PublicDiaryMatch = {
  found: boolean;
  photoCount: number | null;
};

const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

const castIds = (candidate: PublicDiaryCandidate) => [...new Set(candidate.castHrefs.flatMap((href) => {
  try {
    return new URL(href, "https://estama.jp").pathname.match(/\/cast\/(\d+)\//i)?.[1] || [];
  } catch {
    return [];
  }
}))];

const diaryPhotoUrls = (candidate: PublicDiaryCandidate, expectedTitle: string) => [...new Set(
  candidate.photos.flatMap((photo) => {
    try {
      const url = new URL(photo.src, "https://estama.jp");
      if (url.hostname !== "img.estama.jp" || normalize(photo.alt) !== expectedTitle) return [];
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return [];
    }
  }),
)];

export function publicDiarySignature(candidate: PublicDiaryCandidate) {
  const expectedTitle = normalize(candidate.title);
  return [
    expectedTitle,
    candidate.publishedAt,
    castIds(candidate).sort().join(","),
    diaryPhotoUrls(candidate, expectedTitle).sort().join(","),
  ].join("|");
}

export function publicDiaryListUrl(publicProfileUrl?: string | null, shopId?: string | null) {
  let resolvedShopId = String(shopId || "").match(/^\d+$/)?.[0] || "";
  if (publicProfileUrl) {
    try {
      const url = new URL(publicProfileUrl);
      if (url.protocol !== "https:" || !/^(?:www\.)?estama\.jp$/i.test(url.hostname)) {
        throw new Error("エステ魂以外の公開プロフィールURLです");
      }
      resolvedShopId ||= url.pathname.match(/^\/shop\/(\d+)\/cast\/\d+\/?$/i)?.[1] || "";
    } catch (error) {
      if (!resolvedShopId) throw error;
    }
  }
  if (!resolvedShopId) throw new Error("エステ魂の店舗IDを確認できません");
  return `https://estama.jp/shop/${resolvedShopId}/bloglist/`;
}

const matchingEntries = (
  candidates: PublicDiaryCandidate[],
  input: { title: string; body: string; externalId?: string | null },
) => {
  const expectedTitle = normalize(input.title);
  const bodyKey = normalize(input.body).slice(0, 48);
  return candidates.filter((candidate) => {
    if (candidate.headingCount !== 1 || !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(candidate.publishedAt)) return false;
    if (normalize(candidate.title) !== expectedTitle) return false;
    if (bodyKey && !normalize(candidate.text).includes(bodyKey)) return false;
    const ids = castIds(candidate);
    return ids.length === 1 && (!input.externalId || ids[0] === input.externalId);
  }).sort((left, right) => normalize(left.text).length - normalize(right.text).length);
};

export function findPublicDiaryPhotoCount(
  candidates: PublicDiaryCandidate[],
  input: { title: string; body: string; externalId?: string | null },
  baselineSignatures: string[] = [],
): PublicDiaryMatch {
  const expectedTitle = normalize(input.title);
  const matching = matchingEntries(candidates, input);
  const baselineCounts = baselineSignatures.reduce<Record<string, number>>((counts, signature) => {
    counts[signature] = (counts[signature] || 0) + 1;
    return counts;
  }, {});
  const observedCounts: Record<string, number> = {};
  const entry = matching.find((candidate) => {
    const signature = publicDiarySignature(candidate);
    observedCounts[signature] = (observedCounts[signature] || 0) + 1;
    return observedCounts[signature] > (baselineCounts[signature] || 0);
  });
  if (!entry) return { found: false, photoCount: null };
  const photoCount = diaryPhotoUrls(entry, expectedTitle).length;
  return { found: true, photoCount };
}

export function matchingPublicDiarySignatures(
  candidates: PublicDiaryCandidate[],
  input: { title: string; body: string; externalId?: string | null },
) {
  return matchingEntries(candidates, input).map(publicDiarySignature);
}

export function assertPublishedPhotoCount(expected: number, observed: number | null) {
  if (!Number.isInteger(expected) || expected < 0 || observed !== expected) {
    throw new Error(`エステ魂の公開日記の写真枚数が一致しません（指定${expected}枚 / 公開${observed ?? "不明"}枚）`);
  }
}
