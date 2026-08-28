import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rewardsPage = new URL("../src/pages/SystemReferralRewards.tsx", import.meta.url);
const staffPage = new URL("../src/pages/Staff.tsx", import.meta.url);
const sidebar = new URL("../src/components/Sidebar.tsx", import.meta.url);

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
