import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedEstamaUrl,
  findSourceDiaryMatch,
  type SourceDiaryCandidate,
} from "../supabase/functions/import-estama-diary/dedupe.ts";

const source = (overrides: Partial<SourceDiaryCandidate> = {}): SourceDiaryCandidate => ({
  id: "diary-1",
  title: "載せ直し...！",
  body: "黒マイクロ...♥",
  posted_at: "2026-08-28T08:38:00.000Z",
  external_url: null,
  ...overrides,
});

test("魂側への再送が1時間遅れても短文の同時投稿を重複登録しない", () => {
  const match = findSourceDiaryMatch({
    external_url: "https://estama.jp/shop/51445/blog/123/",
    title: "載せ直し...！",
    body: "黒マイクロ...♥",
    datetime: "2026-08-28T09:45:00.000Z",
  }, [source()]);
  assert.equal(match?.id, "diary-1");
});

test("同じ短文でも投稿日が離れていれば別の日記として扱う", () => {
  const match = findSourceDiaryMatch({
    external_url: "https://estama.jp/shop/51445/blog/456/",
    title: "載せ直し...！",
    body: "黒マイクロ...♥",
    datetime: "2026-08-30T09:45:00.000Z",
  }, [source()]);
  assert.equal(match, null);
});

test("十分に長い同一本文は遅延日数に依存せず重複登録しない", () => {
  const longBody = "同時投稿した写メ日記の本文が十分に長く一致する場合は別経路から取り込まない";
  const match = findSourceDiaryMatch({
    external_url: "https://estama.jp/shop/51445/blog/789/",
    title: "長文日記",
    body: longBody,
    datetime: "2026-09-05T09:45:00.000Z",
  }, [source({ title: "長文日記", body: longBody })]);
  assert.equal(match?.id, "diary-1");
});

test("外部URLが紐付け済みなら本文や日時にかかわらず同じ日記と判断する", () => {
  const externalUrl = "https://estama.jp/shop/51445/blog/999/";
  const match = findSourceDiaryMatch({
    external_url: externalUrl,
    title: "表示変更後",
    body: "表示変更後",
    datetime: null,
  }, [source({ external_url: externalUrl })]);
  assert.equal(match?.id, "diary-1");
});

test("取得先はHTTPSのエステ魂ドメインだけを許可する", () => {
  assert.equal(allowedEstamaUrl("https://estama.jp/shop/51445/"), "https://estama.jp/shop/51445/");
  assert.equal(allowedEstamaUrl("https://img.estama.jp/photo.jpg"), "https://img.estama.jp/photo.jpg");
  assert.equal(allowedEstamaUrl("/shop/51445/blog/1/", "https://estama.jp/shop/51445/"), "https://estama.jp/shop/51445/blog/1/");
  assert.equal(allowedEstamaUrl("http://estama.jp/shop/51445/"), null);
  assert.equal(allowedEstamaUrl("https://estama.jp.evil.example/photo.jpg"), null);
  assert.equal(allowedEstamaUrl("https://127.0.0.1/photo.jpg"), null);
});
