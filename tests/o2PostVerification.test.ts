import assert from "node:assert/strict";
import test from "node:test";

import {
  extractO2PostReferences,
  inspectO2PostDetail,
  newO2PostReferences,
  normalizeO2Text,
  o2PostReferenceFromUrl,
} from "../supabase/functions/post-to-sites/o2-verification.ts";

test("O2の公開投稿URLだけから投稿IDを抽出する", () => {
  assert.deepEqual(o2PostReferenceFromUrl("/post/?id=804504"), {
    id: "804504",
    url: "https://m-sns.net/post/?id=804504",
  });
  assert.equal(o2PostReferenceFromUrl("/cast/post/create/"), null);
  assert.equal(o2PostReferenceFromUrl("https://example.com/post/?id=804504"), null);
  assert.equal(o2PostReferenceFromUrl("/post/?id=not-a-number"), null);
});

test("投稿一覧の重複リンクを除き、表示順を保って抽出する", () => {
  const html = `
    <a href="/post/?id=300">詳細</a>
    <a href="https://m-sns.net/post/?id=300&amp;from=cast">同じ投稿</a>
    <a href="/post/?id=299">詳細</a>
  `;
  assert.deepEqual(extractO2PostReferences(html, "https://m-sns.net/cast/post/"), [
    { id: "300", url: "https://m-sns.net/post/?id=300" },
    { id: "299", url: "https://m-sns.net/post/?id=299" },
  ]);
});

test("投稿前になかったIDだけを送信後の候補にする", () => {
  const previous = new Set(["299", "298"]);
  assert.deepEqual(newO2PostReferences(previous, [[
    { id: "300", url: "https://m-sns.net/post/?id=300" },
    { id: "299", url: "https://m-sns.net/post/?id=299" },
  ], [
    { id: "301", url: "https://m-sns.net/post/?id=301" },
    { id: "300", url: "https://m-sns.net/post/?id=300" },
  ]]), [
    { id: "300", url: "https://m-sns.net/post/?id=300" },
    { id: "301", url: "https://m-sns.net/post/?id=301" },
  ]);
});

test("一覧で省略される長文も詳細ページの本文と投稿画像で確認できる", () => {
  const body = "長い本文です。\n予約をお待ちしています&#x1f496;";
  const detail = `
    <main><p>長い本文です。<br>予約をお待ちしています💖</p>
    <img src="/uploads/post/300.jpg" alt="投稿画像"></main>
  `;
  assert.deepEqual(inspectO2PostDetail(detail, body), { bodyMatched: true, imageMatched: true });
});

test("プロフィール画像しかない詳細ページは投稿画像確認にしない", () => {
  const detail = `<main><p>本文です</p><img src="/avatar.jpg" alt="プロフィール画像"></main>`;
  assert.deepEqual(inspectO2PostDetail(detail, "本文です"), { bodyMatched: true, imageMatched: false });
});

test("数値文字参照と不可視文字を正規化する", () => {
  assert.equal(normalizeO2Text("<p>A&#32;B&#x1f496;\u200B</p>"), "A B💖");
});
