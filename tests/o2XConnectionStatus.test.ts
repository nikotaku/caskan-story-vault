import assert from "node:assert/strict";
import test from "node:test";

import { hasSavedXId, normalizeXId } from "../src/lib/sns-connection-status.ts";

test("XはパスワードなしでもIDがあれば設定済みになる", () => {
  assert.equal(hasSavedXId({ loginId: "enka_asami" }), true);
});

test("旧データのXプロフィールURLだけでも設定済みになる", () => {
  assert.equal(hasSavedXId({ profileUrl: "https://x.com/enka_asami" }), true);
});

test("XのIDがない場合は未設定になる", () => {
  assert.equal(hasSavedXId({ loginId: "  ", profileUrl: null }), false);
  assert.equal(hasSavedXId({ profileUrl: "https://example.com/enka_asami" }), false);
});

test("XのURLと@付きIDを同じIDへ正規化する", () => {
  assert.equal(normalizeXId("https://twitter.com/enka_asami/status/1"), "enka_asami");
  assert.equal(normalizeXId("@enka_asami"), "enka_asami");
});
