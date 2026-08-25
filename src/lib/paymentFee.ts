export interface PaymentSetting {
  id: string;
  payment_method: string;
  payment_link: string | null;
  fee_percentage: number;
}

export interface PaymentDetail {
  method: string;
  amount: number;
  fee?: number;
}

export interface SplitCardPaymentSummary {
  chargeAmount: number | null;
  paymentLink: string | null;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  card: "カード",
  paypay: "PayPay",
};

export function findPaymentSetting(
  settings: PaymentSetting[],
  methodCode: string
): PaymentSetting | null {
  if (methodCode === "card") {
    return settings.find((s) => /クレジット|カード|card/i.test(s.payment_method)) ?? null;
  }
  if (methodCode === "paypay") {
    return settings.find((s) => /paypay/i.test(s.payment_method)) ?? null;
  }
  return null;
}

export function calcPaymentFee(
  baseAmount: number,
  settings: PaymentSetting[],
  methodCode: string
): number {
  const setting = findPaymentSetting(settings, methodCode);
  if (!setting) return 0;
  return Math.round((baseAmount * (Number(setting.fee_percentage) || 0)) / 100);
}

export function snapshotPaymentDetailFees(
  details: PaymentDetail[] | null | undefined,
  settings: PaymentSetting[],
): PaymentDetail[] | null {
  if (!details) return null;

  return details.map((detail) => {
    if (detail.method === "cash") return { ...detail, fee: 0 };
    const setting = findPaymentSetting(settings, detail.method);
    if (!setting) return { ...detail, fee: detail.fee ?? 0 };
    return { ...detail, fee: calcPaymentFee(detail.amount, settings, detail.method) };
  });
}

/**
 * 分割払いのカード分について、顧客が決済リンクで支払う金額を返す。
 * 現金＋カードのみの分割では、予約時に保存した手数料を優先して
 * 料金設定変更後も予約総額とSMSの決済額がずれないようにする。
 */
export function getSplitCardPaymentSummary(
  details: PaymentDetail[] | null | undefined,
  settings: PaymentSetting[],
  savedPaymentFee?: number | null,
): SplitCardPaymentSummary | null {
  if (!details?.length) return null;

  const positiveDetails = details.filter((detail) => Number(detail.amount) > 0);
  const cardDetails = positiveDetails.filter((detail) => detail.method === "card");
  if (cardDetails.length === 0) return null;

  const cardSubtotal = cardDetails.reduce(
    (sum, detail) => sum + Math.max(0, Number(detail.amount) || 0),
    0,
  );
  const hasOtherFeeBearingMethod = positiveDetails.some((detail) => detail.method === "paypay");
  const hasSavedCardFees = cardDetails.every(
    (detail) => detail.fee != null && Number.isFinite(Number(detail.fee)),
  );

  let cardFee: number | null;
  if (hasSavedCardFees) {
    cardFee = cardDetails.reduce(
      (sum, detail) => sum + Math.max(0, Number(detail.fee) || 0),
      0,
    );
  } else if (!hasOtherFeeBearingMethod) {
    cardFee = savedPaymentFee != null
      ? Math.max(0, Number(savedPaymentFee) || 0)
      : cardDetails.reduce(
          (sum, detail) => sum + calcPaymentFee(detail.amount, settings, "card"),
          0,
        );
  } else {
    // 旧データでカードとPayPayを併用している場合、合計手数料から
    // カード分だけを正確に復元できないため、推測した金額は返さない。
    cardFee = null;
  }

  return {
    chargeAmount: cardFee == null ? null : cardSubtotal + cardFee,
    paymentLink: findPaymentSetting(settings, "card")?.payment_link ?? null,
  };
}

export function buildSplitCardPaymentSmsLines(
  summary: SplitCardPaymentSummary | null,
): string[] {
  if (summary?.chargeAmount == null || !summary.paymentLink) return [];

  return [
    "",
    `カード決済金額（手数料込）：${summary.chargeAmount.toLocaleString()}円`,
    `カード決済リンク：${summary.paymentLink}`,
  ];
}
