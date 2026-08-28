import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_RESERVATION_INTERVAL_MINUTES,
  findNextAvailableStart,
  formatAvailabilityTime,
  isAvailabilitySlotOpen,
} from "../src/lib/availability.ts";

test("一ノ瀬ひなたの22:30開始・110分予約後は20分空けて00:40から案内する", () => {
  const result = findNextAvailableStart({
    shiftStart: 13 * 60 + 30,
    shiftEnd: 26 * 60,
    currentTime: 21 * 60,
    reservations: [
      { start: 20 * 60 + 30, duration: 80 },
      { start: 22 * 60 + 30, duration: 110 },
    ],
    intervalMinutes: DEFAULT_RESERVATION_INTERVAL_MINUTES,
  });

  assert.equal(result, 24 * 60 + 40);
  assert.equal(formatAvailabilityTime(result!), "00:40");
});

test("深夜00:40の枠を30分単位へ丸めず、予約後20分から空ける", () => {
  const reservations = [{ start: 22 * 60 + 30, duration: 110 }];

  assert.equal(
    isAvailabilitySlotOpen({
      slotStart: 24 * 60 + 30,
      duration: 60,
      shiftStart: 13 * 60 + 30,
      shiftEnd: 26 * 60,
      reservations,
      intervalMinutes: 20,
    }),
    false,
  );
  assert.equal(
    isAvailabilitySlotOpen({
      slotStart: 24 * 60 + 40,
      duration: 60,
      shiftStart: 13 * 60 + 30,
      shiftEnd: 26 * 60,
      reservations,
      intervalMinutes: 20,
    }),
    true,
  );
});

test("公開ページは店舗別インターバルを読み、30分固定計算を使わない", async () => {
  for (const path of [
    "../src/pages/public/EnkaHome.tsx",
    "../src/pages/public/Schedule.tsx",
    "../src/pages/public/BookingReservation.tsx",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /eq\(["']store_id["'], storeId\)/);
    assert.doesNotMatch(source, /duration\s*\+\s*30/);
  }
});

test("店舗設定画面はログイン中の店舗設定だけを取得する", async () => {
  const source = await readFile(
    new URL("../src/pages/Settings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /eq\('store_id', adminStore!\.id\)/);
});

test("管理画面の最短案内と空き枠も共通の20分計算を使う", async () => {
  const schedule = await readFile(
    new URL("../src/pages/Schedule.tsx", import.meta.url),
    "utf8",
  );
  const slots = await readFile(
    new URL("../src/pages/AvailableSlots.tsx", import.meta.url),
    "utf8",
  );
  assert.match(schedule, /findNextAvailableStart/);
  assert.match(slots, /isAvailabilitySlotOpen/);
  assert.match(slots, /intervalMinutes/);
});
