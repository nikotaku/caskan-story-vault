import { getCustomerRank } from "@/lib/customerRank";

export interface CustomerInsightInput {
  name: string;
  visit_count: number | null;
  total_spent: number | null;
  last_visited: string | null;
  is_banned: boolean | null;
  tags: string[] | null;
  last_therapist?: string | null;
  favorite_course?: string | null;
  median_visit_interval_days?: number | null;
  future_booking_date?: string | null;
  cancellation_rate?: number | null;
  latest_followup_date?: string | null;
  next_action_date?: string | null;
  /** True when more than one visible customer shares the normalized phone. */
  identity_conflict?: boolean;
  /** True when the booking/CRM metric RPC failed and suppression checks are incomplete. */
  data_unavailable?: boolean;
}

export type CustomerStage =
  | "連絡停止"
  | "判定不可"
  | "本人確認"
  | "次回予約済み"
  | "来店前"
  | "初回来店後"
  | "周期前"
  | "再来店時期"
  | "失客注意"
  | "休眠"
  | "高価値休眠";

export type ContactStatus = "停止" | "営業不要" | "連投回避" | "予定日待ち" | "保留" | "対応候補";

export type SalesPriority = "連絡停止" | "営業不要" | "保留" | "低" | "中" | "高" | "要確認";

export interface CustomerInsight {
  averageSpend: number | null;
  daysSinceLastVisit: number | null;
  predictedNextVisitDate: string | null;
  /** 経過日数 ÷ 中央来店間隔。1.0が予測来店日。 */
  visitCycleRatio: number | null;
  /** 予測来店日を超えた割合。予測日前は0、25%超過は0.25。 */
  overdueRate: number | null;
  stage: CustomerStage;
  contactStatus: ContactStatus;
  salesPriority: SalesPriority;
  salesPriorityScore: number;
  approachTitle: string;
  reasons: string[];
  staffAction: string;
  messageDraft: string;
  shouldContact: boolean;
  nextRecommendedContactDate: string | null;
}

type LocalDateInput = string | Date;

const DAY_MS = 86_400_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date-only values are deliberately constructed in local time. This avoids the
 * one-day shift caused by parsing a database `yyyy-MM-dd` value as UTC.
 */
function toLocalCalendarDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const dateOnly = value.match(DATE_ONLY);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const result = new Date(year, month - 1, day);
    if (
      result.getFullYear() !== year ||
      result.getMonth() !== month - 1 ||
      result.getDate() !== day
    ) {
      return null;
    }
    return result;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function differenceInCalendarDays(later: Date, earlier: Date): number {
  return Math.round(calendarDayNumber(later) - calendarDayNumber(earlier));
}

function addCalendarDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function asCount(value: number | null): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

function asMoney(value: number | null): number | null {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : null;
}

function asPositiveNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Accepts either 0..1 or a percentage such as 25. */
function normalizedRate(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(1, value > 1 ? value / 100 : value);
}

function yen(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function priorityFromScore(score: number): SalesPriority {
  if (score >= 90) return "要確認";
  if (score >= 65) return "高";
  if (score >= 40) return "中";
  return "低";
}

function stageBasePriority(stage: CustomerStage, daysSinceLastVisit: number | null): number {
  switch (stage) {
    case "来店前":
      return 10;
    case "初回来店後":
      return daysSinceLastVisit !== null && daysSinceLastVisit <= 7 ? 78 : 65;
    case "周期前":
      return 20;
    case "再来店時期":
      return 70;
    case "失客注意":
      return 85;
    case "休眠":
      return 75;
    case "高価値休眠":
      return 100;
    default:
      return 0;
  }
}

function getLifecycleStage(
  input: CustomerInsightInput,
  visits: number,
  daysSinceLastVisit: number | null,
  visitCycleRatio: number | null,
): CustomerStage {
  if (input.is_banned || input.tags?.includes("営業NG")) return "連絡停止";
  if (visits <= 0 || daysSinceLastVisit === null) return "来店前";
  if (visits === 1) {
    if (daysSinceLastVisit <= 14) return "初回来店後";
    if (daysSinceLastVisit < 60) return "再来店時期";
    if (daysSinceLastVisit < 120) return "失客注意";
    return "休眠";
  }

  let stage: CustomerStage;
  if (visitCycleRatio !== null) {
    if (visitCycleRatio < 0.8) stage = "周期前";
    else if (visitCycleRatio <= 1.2) stage = "再来店時期";
    else if (visitCycleRatio < 2) stage = "失客注意";
    else stage = "休眠";
  } else {
    // Without a measured visit cycle, wait 30 days before recommending sales.
    // The wider 60/120-day boundaries avoid aggressive contact on sparse data.
    if (daysSinceLastVisit < 30) stage = "周期前";
    else if (daysSinceLastVisit < 60) stage = "再来店時期";
    else if (daysSinceLastVisit < 120) stage = "失客注意";
    else stage = "休眠";
  }

  if (stage === "休眠" && getCustomerRank(input).label === "VIP") return "高価値休眠";
  return stage;
}

function nextDateLaterOf(first: Date, second: Date | null): Date {
  if (!second) return first;
  return calendarDayNumber(second) > calendarDayNumber(first) ? second : first;
}

/**
 * Produces a deterministic CRM recommendation. `referenceDate` is required so
 * this function never reads the system clock and remains a pure function.
 */
export function getCustomerInsights(
  input: CustomerInsightInput,
  referenceDate: LocalDateInput,
): CustomerInsight {
  const today = toLocalCalendarDate(referenceDate);
  if (!today) throw new RangeError("referenceDate must be a valid local date");

  const visits = asCount(input.visit_count);
  const totalSpent = asMoney(input.total_spent);
  const averageSpend = visits > 0 && totalSpent !== null ? Math.round(totalSpent / visits) : null;
  const lastVisited = toLocalCalendarDate(input.last_visited);
  const rawDaysSinceLastVisit = lastVisited ? differenceInCalendarDays(today, lastVisited) : null;
  const daysSinceLastVisit = rawDaysSinceLastVisit === null ? null : Math.max(0, rawDaysSinceLastVisit);
  const visitInterval = asPositiveNumber(input.median_visit_interval_days);
  const predictedNextVisit = lastVisited && visitInterval
    ? addCalendarDays(lastVisited, Math.round(visitInterval))
    : null;
  const visitCycleRatio = daysSinceLastVisit !== null && visitInterval
    ? round(daysSinceLastVisit / visitInterval)
    : null;
  const overdueRate = visitCycleRatio === null ? null : round(Math.max(0, visitCycleRatio - 1));
  const futureBooking = toLocalCalendarDate(input.future_booking_date);
  const hasFutureBooking = Boolean(
    futureBooking && differenceInCalendarDays(futureBooking, today) >= 0,
  );
  const latestFollowup = toLocalCalendarDate(input.latest_followup_date);
  const daysSinceFollowup = latestFollowup ? differenceInCalendarDays(today, latestFollowup) : null;
  const followupIsFuture = daysSinceFollowup !== null && daysSinceFollowup < 0;
  const recentlyFollowedUp = daysSinceFollowup !== null && daysSinceFollowup >= 0 && daysSinceFollowup <= 7;
  const nextAction = toLocalCalendarDate(input.next_action_date);
  const nextActionDays = nextAction ? differenceInCalendarDays(nextAction, today) : null;
  const nextActionDue = nextActionDays !== null && nextActionDays <= 0;
  const nextActionInFuture = nextActionDays !== null && nextActionDays > 0;
  const cancellationRate = normalizedRate(input.cancellation_rate);
  const highCancellationRate = cancellationRate !== null && cancellationRate >= 0.3;
  const rawCustomerName = input.name.trim();
  const customerName = !rawCustomerName
    || /^(?:不明|unknown|未登録)$/i.test(rawCustomerName)
    || /^\+?[\d\s()-]{9,}$/.test(rawCustomerName)
    ? "お客様"
    : rawCustomerName;
  const customerSalutation = customerName === "お客様" ? customerName : `${customerName}様`;
  const therapist = input.last_therapist?.trim();
  const course = input.favorite_course?.trim();
  let stage = getLifecycleStage(input, visits, daysSinceLastVisit, visitCycleRatio);
  if (hasFutureBooking) stage = "次回予約済み";

  const reasons: string[] = [];
  if (visits > 0) reasons.push(`来店${visits}回、累計利用額${yen(totalSpent ?? 0)}`);
  else reasons.push("来店履歴がまだありません");
  if (averageSpend !== null) reasons.push(`平均客単価${yen(averageSpend)}`);
  if (daysSinceLastVisit !== null) reasons.push(`最終来店から${daysSinceLastVisit}日経過`);
  if (visitInterval && visitCycleRatio !== null) {
    reasons.push(`通常の来店間隔は約${round(visitInterval, 1)}日、現在は周期の${round(visitCycleRatio * 100)}%`);
  } else if (visits >= 2) {
    reasons.push("来店周期の確定に必要な履歴が不足しているため、控えめな基準で判定");
  }
  if (nextActionDue) reasons.push("登録済みの次回アクション日を迎えています");
  if (highCancellationRate) reasons.push(`キャンセル率が${round((cancellationRate ?? 0) * 100)}%`);

  if (input.is_banned || input.tags?.includes("営業NG")) {
    const stopReason = input.is_banned ? "出禁設定" : "営業NGタグ";
    return {
      averageSpend,
      daysSinceLastVisit,
      predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
      visitCycleRatio,
      overdueRate,
      stage: "連絡停止",
      contactStatus: "停止",
      salesPriority: "連絡停止",
      salesPriorityScore: 0,
      approachTitle: "営業連絡を停止",
      reasons: [`${stopReason}のため、すべての営業連絡から除外`, ...reasons],
      staffAction: input.is_banned
        ? "電話・SMS・LINE・メールを送らず、予約受付時も出禁メモを確認してください。"
        : "電話・SMS・LINE・メールで営業せず、お客様からの連絡にのみ対応してください。",
      messageDraft: "",
      shouldContact: false,
      nextRecommendedContactDate: null,
    };
  }

  if (input.data_unavailable) {
    return {
      averageSpend,
      daysSinceLastVisit,
      predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
      visitCycleRatio,
      overdueRate,
      stage: "判定不可",
      contactStatus: "保留",
      salesPriority: "保留",
      salesPriorityScore: 0,
      approachTitle: "判定データを再取得",
      reasons: ["予約・CRM指標を取得できず、将来予約などの抑止条件を確認できません", ...reasons],
      staffAction: "再読み込みして指標を取得できるまで、営業連絡をしないでください。",
      messageDraft: "",
      shouldContact: false,
      nextRecommendedContactDate: null,
    };
  }

  if (input.identity_conflict) {
    return {
      averageSpend,
      daysSinceLastVisit,
      predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
      visitCycleRatio,
      overdueRate,
      stage: "本人確認",
      contactStatus: "保留",
      salesPriority: "保留",
      salesPriorityScore: 0,
      approachTitle: "重複電話番号の本人確認",
      reasons: ["同じ正規化電話番号を持つ顧客が複数あり、履歴を一意に結び付けられません", ...reasons],
      staffAction: "顧客レコードを統合するか本人を識別できる情報を確認するまで、営業連絡をしないでください。",
      messageDraft: "",
      shouldContact: false,
      nextRecommendedContactDate: null,
    };
  }

  if (hasFutureBooking && futureBooking) {
    return {
      averageSpend,
      daysSinceLastVisit,
      predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
      visitCycleRatio,
      overdueRate,
      stage: "次回予約済み",
      contactStatus: "営業不要",
      salesPriority: "営業不要",
      salesPriorityScore: 0,
      approachTitle: "営業不要・予約準備を優先",
      reasons: [`${localDateKey(futureBooking)}に次回予約あり`, ...reasons],
      staffAction: "追加の営業はせず、予約内容と前回の好みを確認して来店準備をしてください。",
      messageDraft: "",
      shouldContact: false,
      nextRecommendedContactDate: null,
    };
  }

  if (followupIsFuture && latestFollowup) {
    return {
      averageSpend,
      daysSinceLastVisit,
      predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
      visitCycleRatio,
      overdueRate,
      stage: "判定不可",
      contactStatus: "保留",
      salesPriority: "保留",
      salesPriorityScore: 0,
      approachTitle: "フォロー履歴の日付を確認",
      reasons: [`最終フォロー日${localDateKey(latestFollowup)}が未来日です`, ...reasons],
      staffAction: "フォロー履歴の日付を修正するまで、営業連絡をしないでください。",
      messageDraft: "",
      shouldContact: false,
      nextRecommendedContactDate: null,
    };
  }

  if (recentlyFollowedUp && latestFollowup) {
    const followupCooldownEnd = addCalendarDays(latestFollowup, 8);
    const recommendedDate = nextDateLaterOf(followupCooldownEnd, nextActionInFuture ? nextAction : null);
    return {
      averageSpend,
      daysSinceLastVisit,
      predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
      visitCycleRatio,
      overdueRate,
      stage,
      contactStatus: "連投回避",
      salesPriority: "保留",
      salesPriorityScore: 10,
      approachTitle: "連投を避けて反応を待つ",
      reasons: [`最終営業から${daysSinceFollowup}日で、7日以内に連絡済み`, ...reasons],
      staffAction: `${localDateKey(recommendedDate)}までは再送せず、返信や予約の有無だけ確認してください。`,
      messageDraft: "",
      shouldContact: false,
      nextRecommendedContactDate: localDateKey(recommendedDate),
    };
  }

  if (nextActionInFuture && nextAction) {
    return {
      averageSpend,
      daysSinceLastVisit,
      predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
      visitCycleRatio,
      overdueRate,
      stage,
      contactStatus: "予定日待ち",
      salesPriority: "保留",
      salesPriorityScore: 15,
      approachTitle: "登録済みの対応日まで待つ",
      reasons: [`次回アクション日は${localDateKey(nextAction)}`, ...reasons],
      staffAction: `${localDateKey(nextAction)}までは営業せず、当日に前回の履歴を確認して対応してください。`,
      messageDraft: "",
      shouldContact: false,
      nextRecommendedContactDate: localDateKey(nextAction),
    };
  }

  let score = stageBasePriority(stage, daysSinceLastVisit);
  if (nextActionDue) score += 15;
  if (getCustomerRank(input).label === "VIP" && stage !== "高価値休眠") score += 8;
  if (highCancellationRate) score -= 10;
  score = Math.max(0, Math.min(100, score));

  let approachTitle: string;
  let staffAction: string;
  let messageDraft: string;

  switch (stage) {
    case "来店前":
      approachTitle = "来店・問い合わせ履歴を確認";
      staffAction = "来店・問い合わせの根拠が一覧だけでは確認できません。元データを確認してから対応してください。";
      messageDraft = "";
      break;
    case "初回来店後":
      approachTitle = "お礼と満足度の確認";
      staffAction = "売り込みを先にせず、施術・接客の満足点と改善点を確認してください。";
      messageDraft = `${customerSalutation}、先日はご来店いただきありがとうございました。施術や接客はいかがでしたでしょうか。気になった点や次回のご希望があれば、遠慮なくお聞かせください。`;
      break;
    case "周期前":
      approachTitle = "来店周期まで待つ";
      staffAction = predictedNextVisit
        ? `${localDateKey(predictedNextVisit)}前後まで営業を控え、空き枠を準備してください。`
        : "現時点では営業を控え、来店30日後を目安に再判定してください。";
      messageDraft = "";
      break;
    case "再来店時期":
      approachTitle = "希望に近い空き枠を具体的に案内";
      staffAction = `前回の${therapist ? `担当「${therapist}」` : "担当者"}${course ? `・${course}` : ""}を確認し、候補日時を2つに絞って案内してください。`;
      messageDraft = `${customerSalutation}、前回のご来店からそろそろお疲れがたまる頃かと思い、ご連絡しました。${therapist ? `${therapist}の` : ""}ご案内可能な日時は【空き日時①】または【空き日時②】です。ご都合はいかがでしょうか。`;
      break;
    case "失客注意":
      approachTitle = "好みに合わせた個別の再来店提案";
      staffAction = "一斉配信ではなく、前回の担当・コース・好みのどれかを入れた個別連絡をしてください。";
      messageDraft = `${customerSalutation}、ご無沙汰しております。${course ? `以前ご利用いただいた${course}で` : "お身体の状態に合わせて"}、ゆっくり過ごせるお時間をご案内できます。${therapist ? `${therapist}の出勤も確認できますので、` : ""}ご希望があればお気軽にご連絡ください。`;
      break;
    case "高価値休眠":
      approachTitle = "責任者から個別に再来店を提案";
      staffAction = "過去の利用内容と不満の有無を確認し、責任者または関係性のある担当者から一対一で連絡してください。";
      messageDraft = `${customerSalutation}、ご無沙汰しております。以前は何度もご利用いただき、ありがとうございました。${therapist ? `${therapist}を含め、` : ""}ご希望に合う日時を個別にお調べします。最近のお疲れやご要望がございましたら、お聞かせください。`;
      break;
    case "休眠":
      approachTitle = "理由を添えた一度だけの再接触";
      staffAction = "新しい出勤・コース・季節の案内など連絡理由を一つに絞り、反応がなければ連投しないでください。";
      messageDraft = `${customerSalutation}、ご無沙汰しております。${course ? `${course}をご希望の際に` : "またお疲れの際に"}ご案内できるよう、ご連絡しました。無理のないタイミングで、ご希望がございましたらお気軽にお知らせください。`;
      break;
    default:
      approachTitle = "営業連絡を停止";
      staffAction = "営業連絡をしないでください。";
      messageDraft = "";
  }

  if (highCancellationRate) {
    staffAction += " 予約確定前に来店意思と日時を再確認してください。";
  }

  return {
    averageSpend,
    daysSinceLastVisit,
    predictedNextVisitDate: predictedNextVisit ? localDateKey(predictedNextVisit) : null,
    visitCycleRatio,
    overdueRate,
    stage,
    contactStatus: "対応候補",
    salesPriority: priorityFromScore(score),
    salesPriorityScore: score,
    approachTitle,
    reasons,
    staffAction,
    messageDraft,
    shouldContact: stage !== "周期前" && stage !== "来店前",
    nextRecommendedContactDate: stage === "周期前" && predictedNextVisit
      ? localDateKey(predictedNextVisit)
      : null,
  };
}
