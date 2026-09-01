import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  aggregateReferralFees,
  shouldIncludeAugustLegacy3rdSb,
} from "../src/lib/referralFeeAggregation.ts";

const rewardsPage = new URL("../src/pages/SystemReferralRewards.tsx", import.meta.url);
const staffPage = new URL("../src/pages/Staff.tsx", import.meta.url);
const sidebar = new URL("../src/components/Sidebar.tsx", import.meta.url);
const referralFeesPage = new URL("../src/pages/SalesReferralFees.tsx", import.meta.url);

test("広告費の一覧・登録・削除を現在の店舗に限定する", async () => {
  const source = await readFile(rewardsPage, "utf8");

  assert.match(source, /useAdminStore/);
  assert.match(source, /\.eq\("store_id", storeId\)/);
  assert.match(source, /store_id:\s*storeId/);
});

test("SB紐付け候補を現在の店舗から取得する", async () => {
  const source = await readFile(staffPage, "utf8");
  const fetchReferralRewards = source.slice(
    source.indexOf("const fetchReferralRewards"),
    source.indexOf("const getCastCategory"),
  );

  assert.match(fetchReferralRewards, /\.eq\('store_id', storeId\)/);
  assert.match(fetchReferralRewards, /\.eq\('is_active', true\)/);
});

test("サイドバーから動作しない店舗設定だけを除外する", async () => {
  const source = await readFile(sidebar, "utf8");

  assert.equal(source.includes('{ href: "/shop", label: "設定" }'), false);
  assert.equal(source.includes('{ href: "/system/page-content", label: "料金ページ文言" }'), true);
});

test("8月の艶華だけ旧全力の3rd SBを参照する", async () => {
  assert.equal(shouldIncludeAugustLegacy3rdSb("enka", "2026-08-01", "enka"), true);
  assert.equal(shouldIncludeAugustLegacy3rdSb("enka", "2026-09-01", "enka"), false);
  assert.equal(shouldIncludeAugustLegacy3rdSb("legacy", "2026-08-01", "enka"), false);

  const source = await readFile(referralFeesPage, "utf8");
  assert.match(source, /useAdminStore/);
  assert.match(source, /\.in\("store_id", reportStoreIds\)/);
});

test("旧名の3rd SB予約を現行名へ合算し、他ルールは旧店舗から持ち込まない", () => {
  const rows = aggregateReferralFees(
    [
      { id: "current-third", name: "橘まなみ", real_name: "原田奈実", store_id: "enka", referral_reward_id: "enka-third" },
      { id: "legacy-third", name: "橋本かなみ", real_name: "原田奈実", store_id: "legacy", referral_reward_id: "legacy-third" },
      { id: "current-other", name: "別キャスト", real_name: null, store_id: "enka", referral_reward_id: "enka-other" },
    ],
    [
      { id: "enka-third", name: "3rd SB", amount: 2000, store_id: "enka" },
      { id: "legacy-third", name: "3rd SB", amount: 2000, store_id: "legacy" },
      { id: "enka-other", name: "求人", amount: 0, store_id: "enka" },
    ],
    [
      { cast_id: "current-third", price: 28000, payment_fee: 0, status: "completed", store_id: "enka" },
      { cast_id: "legacy-third", price: 30000, payment_fee: 500, status: "completed", store_id: "legacy" },
      { cast_id: "current-other", price: 25000, payment_fee: 0, status: "completed", store_id: "legacy" },
    ],
    { currentStoreId: "enka", legacyStoreId: "legacy", legacyRuleName: "3rd SB" },
  );

  assert.deepEqual(rows, [
    {
      castId: "current-third",
      castName: "橘まなみ/原田奈実",
      ruleName: "3rd SB",
      unitAmount: 2000,
      count: 2,
      sales: 58500,
      fee: 4000,
    },
  ]);
});
