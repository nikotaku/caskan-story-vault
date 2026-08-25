import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSplitCardPaymentSmsLines,
  getSplitCardPaymentSummary,
  snapshotPaymentDetailFees,
  type PaymentSetting,
} from "../src/lib/paymentFee.ts";

const settings: PaymentSetting[] = [
  {
    id: "card",
    payment_method: "クレジットカード",
    payment_link: "https://pay.example/card",
    fee_percentage: 10,
  },
  {
    id: "paypay",
    payment_method: "PayPay",
    payment_link: "https://pay.example/paypay",
    fee_percentage: 5,
  },
];

test("現金とカードの分割では保存済み手数料をカード決済額へ加える", () => {
  assert.deepEqual(
    getSplitCardPaymentSummary([
      { method: "cash", amount: 19_000 },
      { method: "card", amount: 10_000 },
    ], settings, 1_000),
    { chargeAmount: 11_000, paymentLink: "https://pay.example/card" },
  );
});

test("カードとPayPayの併用では保存したカード行の手数料だけを使う", () => {
  assert.deepEqual(
    getSplitCardPaymentSummary([
      { method: "card", amount: 10_000, fee: 1_000 },
      { method: "paypay", amount: 10_000, fee: 500 },
    ], settings, 1_500),
    { chargeAmount: 11_000, paymentLink: "https://pay.example/card" },
  );
});

test("保存時スナップショットから設定変更後もカード決済額を復元する", () => {
  const savedDetails = snapshotPaymentDetailFees([
    { method: "card", amount: 10_000 },
    { method: "paypay", amount: 10_000 },
  ], settings);
  const changedSettings = settings.map((setting) => ({ ...setting, fee_percentage: 20 }));

  assert.deepEqual(
    getSplitCardPaymentSummary(savedDetails, changedSettings, 1_500),
    { chargeAmount: 11_000, paymentLink: "https://pay.example/card" },
  );
});

test("保存前に支払い行ごとの手数料を固定する", () => {
  assert.deepEqual(
    snapshotPaymentDetailFees([
      { method: "cash", amount: 19_000 },
      { method: "card", amount: 10_000 },
    ], settings),
    [
      { method: "cash", amount: 19_000, fee: 0 },
      { method: "card", amount: 10_000, fee: 1_000 },
    ],
  );
});

test("決済設定が未登録でも新規の支払い行は手数料0円として固定する", () => {
  assert.deepEqual(
    snapshotPaymentDetailFees([{ method: "card", amount: 10_000 }], []),
    [{ method: "card", amount: 10_000, fee: 0 }],
  );
});

test("手数料内訳のない旧カード・PayPay併用予約は金額を推測しない", () => {
  assert.deepEqual(
    getSplitCardPaymentSummary([
      { method: "card", amount: 10_000 },
      { method: "paypay", amount: 10_000 },
    ], settings, 1_500),
    { chargeAmount: null, paymentLink: "https://pay.example/card" },
  );
});

test("複数のカード行を一つの決済額へ集約する", () => {
  assert.deepEqual(
    getSplitCardPaymentSummary([
      { method: "cash", amount: 15_000 },
      { method: "card", amount: 5_000 },
      { method: "card", amount: 10_000 },
    ], settings, 1_500),
    { chargeAmount: 16_500, paymentLink: "https://pay.example/card" },
  );
});

test("カード行がなければカード決済情報を返さない", () => {
  assert.equal(
    getSplitCardPaymentSummary([{ method: "cash", amount: 30_000 }], settings, 0),
    null,
  );
});

test("リンク未設定を呼び出し側で検知できる", () => {
  assert.deepEqual(
    getSplitCardPaymentSummary(
      [{ method: "card", amount: 10_000, fee: 1_000 }],
      [{ ...settings[0], payment_link: null }],
      1_000,
    ),
    { chargeAmount: 11_000, paymentLink: null },
  );
});

test("SMSへカード決済額と決済リンクの2行を追加する", () => {
  assert.deepEqual(
    buildSplitCardPaymentSmsLines({
      chargeAmount: 11_000,
      paymentLink: "https://pay.example/card",
    }),
    [
      "",
      "カード決済金額（手数料込）：11,000円",
      "カード決済リンク：https://pay.example/card",
    ],
  );
});
