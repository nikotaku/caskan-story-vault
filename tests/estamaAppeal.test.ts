import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEstamaAppealTargets,
  estamaAppealScheduledIso,
  estamaAppealBusinessDate,
  isConfirmedEstamaAppeal,
  isEstamaAppealShiftActive,
  jstAppealBusinessMinutes,
  nextDueEstamaAppealSlot,
  parseEstamaAppealRemaining,
  parseEstamaLastAppeal,
} from "../server/estama-appeal.ts";

test("営業日はJSTの06:00に切り替わる", () => {
  assert.equal(estamaAppealBusinessDate(new Date("2026-08-27T20:59:00.000Z")), "2026-08-27");
  assert.equal(estamaAppealBusinessDate(new Date("2026-08-27T21:00:00.000Z")), "2026-08-28");
  assert.equal(estamaAppealBusinessDate(new Date("2026-01-01T18:30:00.000Z")), "2026-01-01");
});

test("JSTの06:00前は前営業日の24時以降として扱う", () => {
  assert.equal(jstAppealBusinessMinutes(new Date("2026-08-27T20:59:00.000Z")), 29 * 60 + 59);
  assert.equal(jstAppealBusinessMinutes(new Date("2026-08-27T21:00:00.000Z")), 6 * 60);
});

test("連続勤務の三等分区間の中央に3回を配置する", () => {
  assert.deepEqual(buildEstamaAppealTargets([
    { startTime: "12:00", endTime: "18:00" },
  ]), [13 * 60, 15 * 60, 17 * 60]);
});

test("重複シフトを統合し、空白時間を飛ばして勤務中にだけ配置する", () => {
  const shifts = [
    { startTime: "12:00:00", endTime: "14:00:00" },
    { startTime: "13:00", endTime: "14:00" },
    { startTime: "16:00", endTime: "20:00" },
  ];

  assert.deepEqual(buildEstamaAppealTargets(shifts), [13 * 60, 17 * 60, 19 * 60]);
  for (const target of buildEstamaAppealTargets(shifts)) {
    assert.equal(shifts.some((shift) => isEstamaAppealShiftActive(shift, target)), true);
  }
});

test("日付をまたぐ勤務も06:00基準の同じ営業日に正規化する", () => {
  const shifts = [
    { startTime: "22:00", endTime: "2:00" },
    { startTime: "25:00", endTime: "27:00" },
  ];

  assert.deepEqual(buildEstamaAppealTargets(shifts), [22 * 60 + 50, 24 * 60 + 30, 26 * 60 + 10]);
  assert.equal(isEstamaAppealShiftActive(shifts[0], 25 * 60 + 59), true);
  assert.equal(isEstamaAppealShiftActive(shifts[0], 26 * 60), false);
  assert.equal(isEstamaAppealShiftActive(shifts[1], 26 * 60), true);
});

test("不正なシフトは対象外にし、1分勤務でも対象時刻は勤務内に保つ", () => {
  assert.deepEqual(buildEstamaAppealTargets([
    { startTime: "不明", endTime: "18:00" },
    { startTime: "12:00", endTime: "12:01" },
  ]), [12 * 60, 12 * 60, 12 * 60]);
});

test("残り回数と最終・最新アピール日時を画面文言から読む", () => {
  assert.equal(parseEstamaAppealRemaining("本日の残り回数 2回"), 2);
  assert.equal(parseEstamaAppealRemaining("本日の残り回数：３回"), 3);
  assert.equal(parseEstamaAppealRemaining("残りは2回です"), null);

  assert.equal(parseEstamaLastAppeal("最終アピール 8/27 9:05"), "08/27 09:05");
  assert.equal(parseEstamaLastAppeal("最新アピール：０８/２７ ２１:１８"), "08/27 21:18");
  assert.equal(parseEstamaLastAppeal("最新アピール 13/27 21:18"), null);
});

test("残り回数が1減り、最終日時も変化した場合だけ成功とする", () => {
  const before = {
    beforeRemaining: 3,
    beforeLastAppeal: "08/27 12:00",
  };

  assert.equal(isConfirmedEstamaAppeal({
    ...before,
    afterRemaining: 2,
    afterLastAppeal: "08/27 15:00",
  }), true);
  assert.equal(isConfirmedEstamaAppeal({
    ...before,
    afterRemaining: 2,
    afterLastAppeal: "08/27 12:00",
  }), false);
  assert.equal(isConfirmedEstamaAppeal({
    ...before,
    afterRemaining: 3,
    afterLastAppeal: "08/27 15:00",
  }), false);
  assert.equal(isConfirmedEstamaAppeal({
    beforeRemaining: null,
    afterRemaining: 2,
    beforeLastAppeal: null,
    afterLastAppeal: "08/27 15:00",
  }), false);
});

test("当日の出勤枠から、開始前は待機し到来済みの最初の枠を返す", () => {
  const shifts = [{ startTime: "12:00", endTime: "18:00" }];
  assert.equal(nextDueEstamaAppealSlot({
    shifts,
    slots: [],
    businessDate: "2026-08-27",
    now: new Date("2026-08-27T03:59:00.000Z"),
  }), null);
  assert.deepEqual(nextDueEstamaAppealSlot({
    shifts,
    slots: [],
    businessDate: "2026-08-27",
    now: new Date("2026-08-27T04:01:00.000Z"),
  }), {
    slot: 1,
    scheduledFor: "2026-08-27T04:00:00.000Z",
  });
});

test("成功済み枠を飛ばし、クリック前エラーは同じ枠を再試行する", () => {
  const input = {
    shifts: [{ startTime: "12:00", endTime: "18:00" }],
    businessDate: "2026-08-27",
    now: new Date("2026-08-27T08:30:00.000Z"),
  };
  assert.equal(nextDueEstamaAppealSlot({
    ...input,
    slots: [{ slot: 1, status: "success" }],
  })?.slot, 2);
  assert.equal(nextDueEstamaAppealSlot({
    ...input,
    slots: [{ slot: 1, status: "error" }],
  })?.slot, 1);
});

test("残数終了またはクリック結果不明なら、その営業日の後続を止める", () => {
  const input = {
    shifts: [{ startTime: "12:00", endTime: "18:00" }],
    businessDate: "2026-08-27",
    now: new Date("2026-08-27T10:00:00.000Z"),
  };
  assert.equal(nextDueEstamaAppealSlot({
    ...input,
    slots: [{ slot: 1, status: "skipped" }],
  }), null);
  assert.equal(nextDueEstamaAppealSlot({
    ...input,
    slots: [{ slot: 1, status: "uncertain" }],
  }), null);
  assert.equal(nextDueEstamaAppealSlot({
    ...input,
    slots: [{ slot: 1, status: "error", attemptCount: 3 }],
  }), null);
});

test("24時を超える予定時刻を翌日の正しいJST日時へ変換する", () => {
  assert.equal(
    estamaAppealScheduledIso("2026-08-27", 25 * 60 + 10),
    "2026-08-27T16:10:00.000Z",
  );
  assert.throws(() => estamaAppealScheduledIso("2026-02-30", 25 * 60));
});
