import assert from "node:assert/strict";
import test from "node:test";

import {
  CAST_POST_REVIEW_REQUIRED_PREFIX,
  isCastPostReviewRequired,
} from "../src/lib/cast-post-status.ts";

test("O2の要確認マーカー付きエラーだけを再送停止対象にする", () => {
  assert.equal(isCastPostReviewRequired(`${CAST_POST_REVIEW_REQUIRED_PREFIX}掲載結果を確認できません`), true);
  assert.equal(isCastPostReviewRequired("O2へログインできません"), false);
  assert.equal(isCastPostReviewRequired(null), false);
});
