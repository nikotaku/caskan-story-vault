import assert from "node:assert/strict";
import test from "node:test";
import {
  hasKayamaNoaBookingPromotion,
  KAYAMA_NOA_BOOKING_PROMOTION,
} from "../src/lib/castBookingPromotion.ts";

test("香山のあの専用予約フォームだけに限定特典を表示する", () => {
  assert.equal(hasKayamaNoaBookingPromotion("99ac7570-53ff-4366-9347-b7332837dd88"), true);
  assert.equal(hasKayamaNoaBookingPromotion("00000000-0000-0000-0000-000000000000"), false);
  assert.equal(hasKayamaNoaBookingPromotion(null), false);
});

test("限定特典の文面を保持する", () => {
  assert.deepEqual(KAYAMA_NOA_BOOKING_PROMOTION, {
    title: "【香山のあ限定】",
    benefits: [
      "事前予約で20分サービス",
      "さらに次回の予約を取ると5,000円分相当のオプション無料券が付いてくる！",
    ],
  });
});
