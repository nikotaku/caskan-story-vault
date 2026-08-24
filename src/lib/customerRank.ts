// 顧客ランク自動判定（来店回数・累計売上・タグから算出）
export interface CustomerRankInput {
  visit_count: number | null;
  total_spent: number | null;
  tags: string[] | null;
}

export interface CustomerRank {
  label: string;
  className: string;
}

export const PRESSURE_OPTIONS = ["弱め", "やや弱め", "普通", "やや強め", "強め"];
export const AREA_OPTIONS = ["首・肩", "背中", "腰", "臀部", "脚", "足裏", "頭", "腕", "デコルテ"];
export const CONVERSATION_OPTIONS = ["会話多め", "普通", "会話少なめ", "施術中は静かに"];
export const FOLLOWUP_METHODS = ["電話", "SMS", "LINE", "メール", "その他"];

export function getCustomerRank(c: CustomerRankInput): CustomerRank {
  const visits = c.visit_count ?? 0;
  const spent = c.total_spent ?? 0;
  if (c.tags?.includes("VIP") || visits >= 10 || spent >= 300000) {
    return { label: "VIP", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" };
  }
  if (visits >= 5) {
    return { label: "常連", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
  }
  if (visits >= 2) {
    return { label: "リピーター", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" };
  }
  return { label: "新規", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" };
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const dateOnly = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const visitDay = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((todayDay - visitDay) / 86400000));
}
