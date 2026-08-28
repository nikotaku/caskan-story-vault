import assert from "node:assert/strict";
import test from "node:test";

import { canDeleteFailedCastPost } from "../src/lib/cast-post-deletion.ts";
import { castPostImagePaths } from "../server/cast-post-image-paths.ts";

const basePost = {
  status: "pending",
  o2_status: "posted",
  esutama_status: "pending",
  o2_error: null,
  esutama_error: null,
  estamaReviewRequired: false,
};

test("O2投稿済みでも魂側に通常エラーがあれば履歴を削除できる", () => {
  assert.equal(canDeleteFailedCastPost({
    ...basePost,
    esutama_error: "ログイン情報を確認してください",
  }), true);
});

test("HP掲載済み相当の投稿でも外部媒体エラーがあれば履歴を削除できる", () => {
  assert.equal(canDeleteFailedCastPost({
    ...basePost,
    status: "failed",
    esutama_status: "failed",
  }), true);
});

test("結果不明または送信中の投稿は履歴を削除できない", () => {
  assert.equal(canDeleteFailedCastPost({
    ...basePost,
    esutama_error: "【要確認・再送停止】掲載状態を確認できません",
    estamaReviewRequired: true,
  }), false);
  assert.equal(canDeleteFailedCastPost({
    ...basePost,
    esutama_status: "posting",
    esutama_error: "一時エラー",
  }), false);
});

test("エラーのない投稿には削除操作を表示しない", () => {
  assert.equal(canDeleteFailedCastPost({
    ...basePost,
    status: "posted",
    esutama_status: "posted",
  }), false);
});

test("対象投稿専用の保存画像パスだけを抽出する", () => {
  const origin = "https://project.supabase.co";
  const storeId = "store-1";
  const castId = "cast-1";
  const result = castPostImagePaths([
    `${origin}/storage/v1/object/public/cast-photos/admin-posts/${storeId}/${castId}/admin.jpg`,
    `${origin}/storage/v1/object/public/cast-photos/posts/${castId}/therapist.jpg`,
    `${origin}/storage/v1/object/public/cast-photos/posts/${castId}/therapist.jpg`,
    `${origin}/storage/v1/object/public/cast-photos/admin-posts/other-store/${castId}/other.jpg`,
    `${origin}/storage/v1/object/public/cast-photos/posts/other-cast/other.jpg`,
    `${origin}/storage/v1/object/public/cast-photos/estama-diary/${castId}/0.jpg`,
    "https://example.com/external.jpg",
  ], origin, storeId, castId);

  assert.deepEqual(result, [
    `admin-posts/${storeId}/${castId}/admin.jpg`,
    `posts/${castId}/therapist.jpg`,
  ]);
});

test("パストラバーサルを含む保存先URLは削除対象にしない", () => {
  const origin = "https://project.supabase.co";
  assert.deepEqual(castPostImagePaths([
    `${origin}/storage/v1/object/public/cast-photos/posts/cast-1/%2E%2E/profile.jpg`,
  ], origin, "store-1", "cast-1"), []);
});
