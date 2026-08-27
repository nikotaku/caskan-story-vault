import assert from "node:assert/strict";
import test from "node:test";

import {
  ESTAMA_REVIEW_REQUIRED_PREFIX,
  isEstamaReviewRequired,
} from "../src/lib/estama-post-status.ts";

test("要確認マーカー付きの魂エラーだけを再送停止対象にする", () => {
  assert.equal(isEstamaReviewRequired(`${ESTAMA_REVIEW_REQUIRED_PREFIX}掲載状態を確認できません`), true);
  assert.equal(isEstamaReviewRequired("ログイン情報を確認してください"), false);
  assert.equal(isEstamaReviewRequired(null), false);
});
