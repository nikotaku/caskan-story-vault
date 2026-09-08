import assert from "node:assert/strict";
import test from "node:test";

import {
  estamaIndividualShiftAdminUrl,
  estamaScheduleExpectation,
} from "../server/estama-shift-schedule.ts";

test("エスたま登録IDがあれば本人の出勤設定画面へ直接移動する", () => {
  assert.equal(
    estamaIndividualShiftAdminUrl("925606"),
    "https://estama.jp/admin/schedule/925606/",
  );
});

test("エスたま登録IDがなければ一覧画面の処理へ戻せる", () => {
  assert.equal(estamaIndividualShiftAdminUrl(null), null);
  assert.equal(estamaIndividualShiftAdminUrl("  "), null);
});

test("通常シフトと深夜シフトをエスたまの選択値へ変換する", () => {
  assert.deepEqual(estamaScheduleExpectation("upsert", "14:00:00", "22:00:00"), {
    start: "14:00",
    end: "22:00",
  });
  assert.deepEqual(estamaScheduleExpectation("upsert", "15:00:00", "02:00:00"), {
    start: "15:00",
    end: "25:00",
  });
});

test("削除同期では開始・終了を未出勤へ戻す", () => {
  assert.deepEqual(estamaScheduleExpectation("delete", "18:00:00", "23:00:00"), {
    start: "",
    end: "",
  });
});
