import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublishedPhotoCount,
  findPublicDiaryPhotoCount,
  findPublicDiaryPublication,
  matchingPublicDiarySignatures,
  publicDiaryListUrl,
  type PublicDiaryCandidate,
} from "../server/estama-public-diary.ts";

test("公開プロフィールURLから店舗の写メ日記一覧URLを作る", () => {
  assert.equal(
    publicDiaryListUrl("https://estama.jp/shop/51445/cast/928862/"),
    "https://estama.jp/shop/51445/bloglist/",
  );
  assert.equal(publicDiaryListUrl(null, "51445"), "https://estama.jp/shop/51445/bloglist/");
});

test("エステ魂の店舗IDを確認できなければ公開確認を開始しない", () => {
  assert.throws(
    () => publicDiaryListUrl("https://example.com/shop/51445/cast/928862/"),
    /エステ魂以外/,
  );
});

const candidate = (photoCount: number, overrides: Partial<PublicDiaryCandidate> = {}): PublicDiaryCandidate => ({
  title: "動作確認",
  text: "動作確認 画像1枚の公開確認をします",
  castHrefs: ["https://estama.jp/shop/51445/cast/928862/"],
  photos: [
    { alt: "星乃りか", src: "https://img.estama.jp/profile.jpg" },
    ...Array.from({ length: photoCount }, (_, index) => ({
      alt: "動作確認",
      src: `https://img.estama.jp/diary-${index + 1}.jpg`,
    })),
  ],
  headingCount: 1,
  publishedAt: "2026/08/27 20:15",
  ...overrides,
});

for (const count of [0, 1, 2, 3]) {
  test(`公開日記に指定${count}枚があることを照合する`, () => {
    const match = findPublicDiaryPhotoCount([candidate(count)], {
      title: "動作確認",
      body: "画像1枚の公開確認をします",
      externalId: "928862",
    });
    assert.deepEqual(match, { found: true, photoCount: count });
    assert.doesNotThrow(() => assertPublishedPhotoCount(count, match.photoCount));
  });
}

test("同名でも本文またはセラピストが違う日記は公開結果に使わない", () => {
  const input = { title: "動作確認", body: "画像1枚の公開確認をします", externalId: "928862" };
  assert.deepEqual(findPublicDiaryPhotoCount([
    candidate(1, { text: "動作確認 別の本文" }),
  ], input), { found: false, photoCount: null });
  assert.deepEqual(findPublicDiaryPhotoCount([
    candidate(1, { castHrefs: ["https://estama.jp/shop/51445/cast/111111/"] }),
  ], input), { found: false, photoCount: null });
});

test("複数の日記見出しや複数セラピストを含む広い祖先要素は使わない", () => {
  const input = { title: "動作確認", body: "画像1枚の公開確認をします", externalId: "928862" };
  assert.deepEqual(findPublicDiaryPhotoCount([
    candidate(1, { headingCount: 2 }),
  ], input), { found: false, photoCount: null });
  assert.deepEqual(findPublicDiaryPhotoCount([
    candidate(1, { castHrefs: [
      "https://estama.jp/shop/51445/cast/928862/",
      "https://estama.jp/shop/51445/cast/111111/",
    ] }),
  ], input), { found: false, photoCount: null });
});

test("投稿前から存在する同一日記だけでは新規投稿の成功扱いにしない", () => {
  const input = { title: "動作確認", body: "画像1枚の公開確認をします", externalId: "928862" };
  const existing = candidate(1);
  const baseline = matchingPublicDiarySignatures([existing], input);
  assert.deepEqual(findPublicDiaryPhotoCount([existing], input, baseline), { found: false, photoCount: null });
  assert.deepEqual(findPublicDiaryPhotoCount([existing, existing], input, baseline), { found: true, photoCount: 1 });
});

test("新しく公開された日記の個別URLを投稿結果として返す", () => {
  const externalUrl = "https://estama.jp/shop/51445/blog/12345/";
  const publication = findPublicDiaryPublication([candidate(1, { externalUrl })], {
    title: "動作確認",
    body: "画像1枚の公開確認をします",
    externalId: "928862",
  });
  assert.deepEqual(publication, { found: true, photoCount: 1, externalUrl });
});

test("プロフィール画像や別CDNの画像は日記写真に数えない", () => {
  const match = findPublicDiaryPhotoCount([candidate(1, {
    photos: [
      { alt: "星乃りか", src: "https://img.estama.jp/profile.jpg" },
      { alt: "動作確認", src: "https://static-v3.estama.jp/icon.png" },
      { alt: "動作確認", src: "https://img.estama.jp/diary.jpg" },
    ],
  })], {
    title: "動作確認",
    body: "画像1枚の公開確認をします",
    externalId: "928862",
  });
  assert.deepEqual(match, { found: true, photoCount: 1 });
});

test("同じ公開画像のresponsive用DOM重複は1枚として数える", () => {
  const match = findPublicDiaryPhotoCount([candidate(1, {
    photos: [
      { alt: "動作確認", src: "https://img.estama.jp/diary.jpg?w=480" },
      { alt: "動作確認", src: "https://img.estama.jp/diary.jpg?w=960" },
    ],
  })], {
    title: "動作確認",
    body: "画像1枚の公開確認をします",
    externalId: "928862",
  });
  assert.deepEqual(match, { found: true, photoCount: 1 });
});

test("公開枚数が指定と違えば成功扱いにしない", () => {
  assert.throws(() => assertPublishedPhotoCount(1, 0), /指定1枚 \/ 公開0枚/);
  assert.throws(() => assertPublishedPhotoCount(0, null), /公開不明/);
});
