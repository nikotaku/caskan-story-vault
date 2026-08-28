import assert from "node:assert/strict";
import test from "node:test";

import { workerFailureSafety, workerPhotoCount } from "../supabase/functions/post-to-sites/photo-count.ts";

const urls = ["one", "two", "three"];

test("worker報告が指定1枚と一致する場合だけ成功にする", () => {
  assert.deepEqual(workerPhotoCount([urls[0]], { posted: true, uploadedPhotos: 1 }), {
    expected: 1,
    uploaded: 1,
    posted: true,
    matches: true,
  });
});

for (const count of [0, 2, 3]) {
  test(`worker報告が${count}枚でも同時投稿の成功にしない`, () => {
    assert.deepEqual(workerPhotoCount(count ? urls.slice(0, count) : null, { posted: true, uploadedPhotos: count }), {
      expected: count,
      uploaded: count,
      posted: true,
      matches: false,
    });
  });
}

test("3枚指定に対してworkerが1枚なら失敗にする", () => {
  assert.deepEqual(workerPhotoCount(urls, { posted: true, uploadedPhotos: 1 }), {
    expected: 3,
    uploaded: 1,
    posted: true,
    matches: false,
  });
});

test("workerの枚数報告が欠けていれば画像なし投稿でも失敗にする", () => {
  assert.deepEqual(workerPhotoCount(null, {}), {
    expected: 0,
    uploaded: null,
    posted: false,
    matches: false,
  });
});

test("枚数が一致してもworkerの投稿完了報告がなければ失敗にする", () => {
  assert.deepEqual(workerPhotoCount([urls[0]], { uploadedPhotos: 1 }), {
    expected: 1,
    uploaded: 1,
    posted: false,
    matches: false,
  });
});

test("workerへの接続が切れた場合は送信結果不明として再送を止める", () => {
  assert.deepEqual(workerFailureSafety(null, {}), {
    waitingForLogin: false,
    submissionUncertain: true,
  });
});

test("504やHTML応答など詳細不明のworker失敗は再送を止める", () => {
  assert.deepEqual(workerFailureSafety(false, {}), {
    waitingForLogin: false,
    submissionUncertain: true,
  });
});

test("送信前と明示されたworker失敗だけは再送可能にする", () => {
  assert.deepEqual(workerFailureSafety(false, { safeToRetry: true }), {
    waitingForLogin: false,
    submissionUncertain: false,
  });
});

test("送信後不明フラグはsafeToRetryより優先する", () => {
  assert.deepEqual(workerFailureSafety(false, { safeToRetry: true, submissionUncertain: true }), {
    waitingForLogin: false,
    submissionUncertain: true,
  });
});

test("ログイン待ちは再送不明ではなく設定待ちとして扱う", () => {
  assert.deepEqual(workerFailureSafety(false, { loginRequired: true }), {
    waitingForLogin: true,
    submissionUncertain: false,
  });
});
