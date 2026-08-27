import assert from "node:assert/strict";
import test from "node:test";

import {
  isEstamaAvailabilitySelect,
  isEstamaShiftActive,
  jstBusinessMinutes,
  parseEstamaShiftRange,
} from "../server/estama-availability.ts";

test("ご案内状況の選択肢だけを対象として認識する", () => {
  assert.equal(isEstamaAvailabilitySelect([
    "未設定",
    "今すぐ",
    "30分以内",
    "1時間以内",
    "完売",
  ]), true);
  assert.equal(isEstamaAvailabilitySelect(["未設定", "公開中", "非公開"]), false);
});

test("25時までの深夜シフトを勤務中として判定する", () => {
  const range = parseEstamaShiftRange("14:00〜25:00");
  assert.deepEqual(range, { startMinutes: 840, endMinutes: 1500 });
  assert.equal(isEstamaShiftActive(range!, 19 * 60 + 35), true);
  assert.equal(isEstamaShiftActive(range!, 24 * 60 + 30), true);
  assert.equal(isEstamaShiftActive(range!, 25 * 60), false);
});

test("日付をまたぐ通常表記も翌日側へ補正する", () => {
  const range = parseEstamaShiftRange("20:00 ～ 2:00");
  assert.deepEqual(range, { startMinutes: 1200, endMinutes: 1560 });
});

test("JSTの深夜は前営業日の分数として扱う", () => {
  assert.equal(jstBusinessMinutes(new Date("2026-08-27T10:35:00.000Z")), 19 * 60 + 35);
  assert.equal(jstBusinessMinutes(new Date("2026-08-27T15:30:00.000Z")), 24 * 60 + 30);
});
