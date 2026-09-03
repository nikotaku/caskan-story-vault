import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPromotionCastOptions,
  type PromotionCastRecord,
} from "../src/lib/promotionScheduleCasts.ts";

const makeCast = (
  id: string,
  name: string,
  storeId: string,
): PromotionCastRecord => ({
  id,
  store_id: storeId,
  name,
  photo: null,
  profile: null,
  message: null,
  tags: [],
  x_account: null,
  o2_url: null,
});

test("投稿対象には選択中の店舗の在籍者だけを残す", () => {
  const options = buildPromotionCastOptions([
    makeCast("hinata", "一ノ瀬ひなた", "enka"),
    makeCast("rina", "りな", "past"),
  ], "enka");

  assert.deepEqual(options.map((cast) => cast.name), ["一ノ瀬ひなた"]);
});

test("同じ店舗の同名レコードは投稿対象を1件にまとめる", () => {
  const options = buildPromotionCastOptions([
    makeCast("old", "一ノ瀬ひなた", "enka"),
    makeCast("current", "一ノ瀬ひなた", "enka"),
  ], "enka");

  assert.equal(options.length, 1);
  assert.deepEqual(options[0].linkedCastIds, ["old", "current"]);
});
