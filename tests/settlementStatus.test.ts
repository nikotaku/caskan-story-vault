import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getSubmittedCastIds,
  getTimelineSettlementIndicator,
} from "../src/lib/settlementStatus.ts";

const schedulePage = new URL("../src/pages/Schedule.tsx", import.meta.url);
const dailySalesPage = new URL("../src/pages/SalesDailySales.tsx", import.meta.url);
const clearanceMigration = new URL(
  "../supabase/migrations/20260904083000_complete_reservations_from_daily_clearance.sql",
  import.meta.url,
);

test("未確認・確認済みの精算入力をセラピスト単位で検出する", () => {
  const submitted = getSubmittedCastIds([
    { cast_id: "cast-pending", status: "pending" },
    { cast_id: "cast-confirmed", status: "confirmed" },
    { cast_id: "cast-ignored", status: "cancelled" },
    { cast_id: null, status: "pending" },
  ]);

  assert.deepEqual([...submitted], ["cast-pending", "cast-confirmed"]);
});

test("精算入力後かつ確定予約の完了前は精算入力済み表示にする", () => {
  assert.equal(getTimelineSettlementIndicator("confirmed", true), "submitted");
  assert.equal(getTimelineSettlementIndicator("hold", true), "action");
});

test("日別精算後は完了表示を優先する", () => {
  assert.equal(getTimelineSettlementIndicator("completed", true), "completed");
  assert.equal(getTimelineSettlementIndicator("completed", false), "completed");
});

test("精算未入力の確定予約には従来の完了操作を残す", () => {
  assert.equal(getTimelineSettlementIndicator("confirmed", false), "action");
  assert.equal(getTimelineSettlementIndicator("cancelled", true), "hidden");
});

test("予約画面は日別の精算入力を読み、精算入力済みバッジを表示する", async () => {
  const source = await readFile(schedulePage, "utf8");

  assert.match(source, /\.from\("daily_sales_records"\)/);
  assert.match(source, /精算入力済み/);
  assert.match(source, /getTimelineSettlementIndicator/);
});

test("日別精算は清算保存と予約完了を一括処理する", async () => {
  const [pageSource, migrationSource] = await Promise.all([
    readFile(dailySalesPage, "utf8"),
    readFile(clearanceMigration, "utf8"),
  ]);

  assert.match(pageSource, /rpc\("complete_daily_clearance"/);
  assert.match(migrationSource, /set status = 'completed'/);
  assert.match(migrationSource, /insert into public\.daily_clearances/);
  assert.match(migrationSource, /set status = 'confirmed'/);
});
