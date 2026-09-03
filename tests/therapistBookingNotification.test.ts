import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildReservationLineMessage,
  formatBusinessDateLabel,
  formatReservationTimeRange,
  type ReservationLineContext,
} from "../supabase/functions/notify-line-therapist/reservationLineNotification.ts";

const BASE_CONTEXT: ReservationLineContext = {
  reservation_id: "10000000-0000-0000-0000-000000000001",
  cast_id: "20000000-0000-0000-0000-000000000002",
  cast_name: "花宮みれい",
  line_group_id: "line-group-id",
  customer_name: "川上",
  reservation_date: "2026-09-04",
  start_time: "13:00:00",
  duration: 80,
  extension_minutes: 0,
  course_name: "艶華 80分",
  room: "艶月",
  options: [],
  notes: null,
  price: 22_000,
  payment_fee: 0,
  nomination_type: "none",
  store_visit_count: 0,
  cast_visit_count: 0,
  cast_history: [],
};

test("店新規の金額・終了時刻・フリー区分を読みやすい順で表示する", () => {
  assert.equal(
    buildReservationLineMessage(BASE_CONTEXT),
    [
      "🔔 新規予約のご案内",
      "",
      "📅 9月4日(金)",
      "⏰ 13:00〜14:20",
      "💆 艶華 80分",
      "👤 担当：花宮みれい",
      "💴 金額：22,000円",
      "🆕 来店区分：店新規",
      "⭐ 指名区分：フリー",
      "🏠 ルーム：艶月",
      "お客様：川上 様",
    ].join("\n"),
  );
});

test("本指名では決済手数料込み総額と担当履歴を直近3件だけ表示する", () => {
  const context: ReservationLineContext = {
    ...BASE_CONTEXT,
    payment_fee: 660,
    nomination_type: "本指名",
    store_visit_count: 7,
    cast_visit_count: 5,
    options: ["極液", "延長20分"],
    notes: "入口でお電話ください",
    cast_history: [
      { reservation_date: "2026-08-20", start_time: "14:00:00", course_name: "艶華", duration: 80 },
      { reservation_date: "2026-07-15", start_time: "00:30:00", course_name: "艶華 100分", duration: 100 },
      { reservation_date: "2026-06-01", start_time: "18:00:00", course_name: "艶華", duration: 120 },
      { reservation_date: "2026-05-01", start_time: "18:00:00", course_name: "艶華", duration: 80 },
    ],
  };

  assert.equal(
    buildReservationLineMessage(context),
    [
      "🔔 新規予約のご案内",
      "",
      "📅 9月4日(金)",
      "⏰ 13:00〜14:20",
      "💆 艶華 80分",
      "👤 担当：花宮みれい",
      "💴 金額：22,660円（決済手数料660円込み）",
      "🔁 来店区分：店リピーター（過去7回来店）",
      "⭐ 指名区分：本指名",
      "➕ オプション：極液、延長20分",
      "🏠 ルーム：艶月",
      "お客様：川上 様",
      "",
      "📖 担当利用履歴：過去5回",
      "・8月20日 艶華 80分",
      "・7月14日 艶華 100分",
      "・6月1日 艶華 120分",
      "・ほか2件",
      "",
      "📝 入口でお電話ください",
    ].join("\n"),
  );
});

test("延長込み終了時刻と深夜の前営業日・24時超表記を計算する", () => {
  assert.equal(formatBusinessDateLabel("2026-09-05", "00:40:00"), "9月4日(金)");
  assert.equal(formatReservationTimeRange("00:40:00", 80, 20), "24:40〜26:20");
  assert.equal(formatReservationTimeRange("23:50:00", 90, 0), "23:50〜25:20");
});

test("履歴を照合できない場合は店新規と誤表示しない", () => {
  const context: ReservationLineContext = {
    ...BASE_CONTEXT,
    nomination_type: "本指名",
    store_visit_count: null,
    cast_visit_count: null,
    cast_history: null,
  };
  const message = buildReservationLineMessage(context);

  assert.match(message, /⚪ 来店区分：判定できず/);
  assert.match(message, /📖 担当利用履歴：確認できず/);
  assert.doesNotMatch(message, /店新規/);
});

test("本指名以外では担当履歴を通知へ載せない", () => {
  const message = buildReservationLineMessage({
    ...BASE_CONTEXT,
    nomination_type: "写真指名",
    store_visit_count: 2,
    cast_visit_count: 2,
    cast_history: [
      { reservation_date: "2026-08-20", course_name: "艶華", duration: 80 },
    ],
  });

  assert.match(message, /⭐ 指名区分：写真指名/);
  assert.doesNotMatch(message, /担当利用履歴/);
});

test("呼出元は予約IDを渡し、Edge FunctionはDBの確定値を取得する", async () => {
  const [scheduleSource, functionSource, migrationSource] = await Promise.all([
    readFile(new URL("../src/pages/Schedule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/notify-line-therapist/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260901124500_reservation_line_notification_cast_identity.sql", import.meta.url), "utf8"),
  ]);

  assert.match(scheduleSource, /reservation_id:\s*d\.id/);
  assert.match(functionSource, /sb\.rpc\("get_reservation_line_context"/);
  assert.match(functionSource, /authClient\.auth\.getUser\(jwt\)/);
  assert.match(functionSource, /authClient\.rpc\("can_manage_store"/);
  assert.match(migrationSource, /history\.status = 'completed'/);
  assert.match(migrationSource, /history\.id <> target\.id/);
  assert.match(migrationSource, /00000000-0000-0000-0000-000000000001/);
  assert.match(migrationSource, /404499ab-5350-490f-9608-5814faffda6f/);
  assert.match(migrationSource, /history_cast\.real_name/);
  assert.match(migrationSource, /history_cast\.name/);
  assert.match(migrationSource, /grant execute[\s\S]*to service_role/);
});
