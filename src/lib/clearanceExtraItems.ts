export type ClearanceExtraItemKind = "deduction" | "salary_addition";

export interface ClearanceExtraItem {
  label: string;
  amount: number;
  kind: ClearanceExtraItemKind;
}

const toAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

/**
 * Legacy rows do not have a kind. They were always salary deductions, so they
 * must continue to be treated as deductions for backwards compatibility.
 */
export function splitClearanceExtraItems(value: unknown): {
  deductions: ClearanceExtraItem[];
  salaryAdditions: ClearanceExtraItem[];
} {
  const deductions: ClearanceExtraItem[] = [];
  const salaryAdditions: ClearanceExtraItem[] = [];

  if (!Array.isArray(value)) return { deductions, salaryAdditions };

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const kind: ClearanceExtraItemKind = item.kind === "salary_addition" ? "salary_addition" : "deduction";
    const normalized: ClearanceExtraItem = {
      label: typeof item.label === "string" ? item.label : "",
      amount: toAmount(item.amount),
      kind,
    };

    if (kind === "salary_addition") salaryAdditions.push(normalized);
    else deductions.push(normalized);
  }

  return { deductions, salaryAdditions };
}

export function combineClearanceExtraItems(
  deductions: ClearanceExtraItem[],
  salaryAdditions: ClearanceExtraItem[],
  options?: { keepZeroAmount?: boolean }
): ClearanceExtraItem[] {
  const normalize = (
    items: ClearanceExtraItem[],
    kind: ClearanceExtraItemKind,
    fallbackLabel: string
  ) => items
    .map((item) => ({
      label: item.label.trim() || fallbackLabel,
      amount: toAmount(item.amount),
      kind,
    }))
    // keepZeroAmount=true のときは金額未入力（0円）の入力途中項目も保持する
    .filter((item) => options?.keepZeroAmount || item.amount > 0);

  return [
    ...normalize(deductions, "deduction", "その他控除"),
    ...normalize(salaryAdditions, "salary_addition", "給与不足分"),
  ];
}

export const sumClearanceExtraItems = (items: ClearanceExtraItem[]): number =>
  items.reduce((sum, item) => sum + toAmount(item.amount), 0);
