export interface ReservationLineHistoryEntry {
  reservation_date: string;
  start_time?: string | null;
  course_name?: string | null;
  duration?: number | null;
}

export interface ReservationLineContext {
  reservation_id: string;
  cast_id?: string | null;
  cast_name?: string | null;
  line_group_id?: string | null;
  customer_name: string;
  reservation_date: string;
  start_time: string;
  duration: number;
  extension_minutes?: number | null;
  course_name: string;
  room?: string | null;
  options?: string[] | null;
  notes?: string | null;
  price: number;
  payment_fee?: number | null;
  nomination_type?: string | null;
  store_visit_count?: number | null;
  cast_visit_count?: number | null;
  cast_history?: ReservationLineHistoryEntry[] | null;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  return { year, month, day };
}

function parseClockParts(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function formatClock(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function nonNegativeInteger(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value ?? 0)) : 0;
}

function nullableCount(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : null;
}

export function formatBusinessDateLabel(reservationDate: string, startTime: string): string {
  const date = parseDateParts(reservationDate);
  if (!date) return reservationDate;

  const clock = parseClockParts(startTime);
  const displayDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (clock && clock.hour < 6) displayDate.setUTCDate(displayDate.getUTCDate() - 1);

  return `${displayDate.getUTCMonth() + 1}月${displayDate.getUTCDate()}日(${WEEKDAYS[displayDate.getUTCDay()]})`;
}

export function formatReservationTimeRange(
  startTime: string,
  duration: number,
  extensionMinutes: number | null | undefined,
): string {
  const clock = parseClockParts(startTime);
  if (!clock) return `${startTime}〜`;

  const displayHour = clock.hour < 6 ? clock.hour + 24 : clock.hour;
  const startMinutes = displayHour * 60 + clock.minute;
  const endMinutes = startMinutes + nonNegativeInteger(duration) + nonNegativeInteger(extensionMinutes);
  return `${formatClock(startMinutes)}〜${formatClock(endMinutes)}`;
}

function formatCourse(courseName: string | null | undefined, duration: number | null | undefined): string {
  const name = courseName?.trim() || "コース未設定";
  const safeDuration = nonNegativeInteger(duration);
  if (safeDuration === 0 || name.includes(`${safeDuration}分`)) return name;
  return `${name} ${safeDuration}分`;
}

function formatHistoryDate(entry: ReservationLineHistoryEntry): string {
  return formatBusinessDateLabel(entry.reservation_date, entry.start_time ?? "12:00").replace(/\([日月火水木金土]\)$/, "");
}

function formatNomination(value: string | null | undefined): string {
  const nomination = value?.trim();
  return !nomination || nomination === "none" ? "フリー" : nomination;
}

export function buildReservationLineMessage(context: ReservationLineContext): string {
  const paymentFee = nonNegativeInteger(context.payment_fee);
  const totalAmount = nonNegativeInteger(context.price) + paymentFee;
  const nomination = formatNomination(context.nomination_type);
  const storeVisitCount = nullableCount(context.store_visit_count);

  const lines = [
    "🔔 新規予約のご案内",
    "",
    `📅 ${formatBusinessDateLabel(context.reservation_date, context.start_time)}`,
    `⏰ ${formatReservationTimeRange(context.start_time, context.duration, context.extension_minutes)}`,
    `💆 ${formatCourse(context.course_name, context.duration)}`,
    `👤 担当：${context.cast_name?.trim() || "未設定"}`,
    `💴 金額：${totalAmount.toLocaleString("ja-JP")}円${paymentFee > 0 ? `（決済手数料${paymentFee.toLocaleString("ja-JP")}円込み）` : ""}`,
  ];

  if (storeVisitCount === null) {
    lines.push("⚪ 来店区分：判定できず");
  } else if (storeVisitCount === 0) {
    lines.push("🆕 来店区分：店新規");
  } else {
    lines.push(`🔁 来店区分：店リピーター（過去${storeVisitCount}回来店）`);
  }

  lines.push(`⭐ 指名区分：${nomination}`);
  if (context.options && context.options.length > 0) {
    lines.push(`➕ オプション：${context.options.join("、")}`);
  }
  if (context.room?.trim()) lines.push(`🏠 ルーム：${context.room.trim()}`);
  lines.push(`お客様：${context.customer_name} 様`);

  if (nomination === "本指名") {
    const castVisitCount = nullableCount(context.cast_visit_count);
    lines.push("");

    if (castVisitCount === null) {
      lines.push("📖 担当利用履歴：確認できず");
    } else if (castVisitCount === 0) {
      lines.push("📖 担当利用履歴：過去の担当利用なし");
    } else {
      const history = (context.cast_history ?? []).slice(0, 3);
      lines.push(`📖 担当利用履歴：過去${castVisitCount}回`);
      for (const entry of history) {
        lines.push(`・${formatHistoryDate(entry)} ${formatCourse(entry.course_name, entry.duration)}`);
      }
      if (castVisitCount > history.length) lines.push(`・ほか${castVisitCount - history.length}件`);
    }
  }

  if (context.notes?.trim()) {
    lines.push("");
    lines.push(`📝 ${context.notes.trim()}`);
  }

  return lines.join("\n");
}
