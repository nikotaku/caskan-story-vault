import assert from "node:assert/strict";
import test from "node:test";

import {
  isPastBookingSlot,
  reconcileBookingStartTime,
} from "../src/lib/bookingSlotTime.ts";

test("当日18:00ちょうどには17:50以前を隠し、18:00を残す", () => {
  const now = new Date("2026-09-01T09:00:00Z"); // 18:00 JST

  assert.equal(isPastBookingSlot({ businessDateKey: "2026-09-01", time: "17:50", now }), true);
  assert.equal(isPastBookingSlot({ businessDateKey: "2026-09-01", time: "18:00", now }), false);
});

test("当日18:07には18:00を隠し、次の18:10を残す", () => {
  const now = new Date("2026-09-01T09:07:00Z"); // 18:07 JST

  assert.equal(isPastBookingSlot({ businessDateKey: "2026-09-01", time: "18:00", now }), true);
  assert.equal(isPastBookingSlot({ businessDateKey: "2026-09-01", time: "18:10", now }), false);
});

test("翌日以降の予約枠は時刻に関係なく残す", () => {
  const now = new Date("2026-09-01T09:07:00Z"); // 18:07 JST

  assert.equal(isPastBookingSlot({ businessDateKey: "2026-09-02", time: "14:00", now }), false);
});

test("過去の営業日の枠はすべて過去として扱う", () => {
  const now = new Date("2026-09-01T09:07:00Z"); // 18:07 JST

  assert.equal(isPastBookingSlot({ businessDateKey: "2026-08-31", time: "23:50", now }), true);
  assert.equal(isPastBookingSlot({ businessDateKey: "2026-08-31", time: "01:00", now }), true);
});

test("深夜枠は前営業日の翌暦日として判定する", () => {
  assert.equal(
    isPastBookingSlot({
      businessDateKey: "2026-09-01",
      time: "00:20",
      now: new Date("2026-09-01T15:10:00Z"), // 9/2 00:10 JST
    }),
    false,
  );
  assert.equal(
    isPastBookingSlot({
      businessDateKey: "2026-09-01",
      time: "00:20",
      now: new Date("2026-09-01T15:30:00Z"), // 9/2 00:30 JST
    }),
    true,
  );
});

test("選択中の枠を過ぎても次の時間へ無断で変更しない", () => {
  const result = reconcileBookingStartTime({
    availableSlots: ["18:10", "18:20"],
    businessDateKey: "2026-09-01",
    startTime: "18:00",
    now: new Date("2026-09-01T09:07:00Z"), // 18:07 JST
  });

  assert.deepEqual(result, { nextStartTime: "", reason: "expired" });
});

test("コース変更などで選べなくなった枠を別の時間へ無断で変更しない", () => {
  const result = reconcileBookingStartTime({
    availableSlots: ["19:00", "19:10"],
    businessDateKey: "2026-09-02",
    startTime: "18:30",
    now: new Date("2026-09-01T09:07:00Z"), // 18:07 JST
  });

  assert.deepEqual(result, { nextStartTime: "", reason: "unavailable" });
});
