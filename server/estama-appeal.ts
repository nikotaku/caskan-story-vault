const JST_TIME_ZONE = "Asia/Tokyo";
const BUSINESS_DAY_START_MINUTES = 6 * 60;

export type EstamaAppealShift = {
  startTime: string;
  endTime: string;
};

export type EstamaAppealSlotState = {
  slot: number;
  status: string;
  attemptCount?: number | null;
};

type StaffedInterval = {
  startMinutes: number;
  endMinutes: number;
};

type EstamaAppealConfirmation = {
  beforeRemaining: number | null;
  afterRemaining: number | null;
  beforeLastAppeal: string | null;
  afterLastAppeal: string | null;
};

function jstDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const part = (type: Intl.DateTimeFormatPartTypes) => Number(
    parts.find((entry) => entry.type === type)?.value || 0,
  );

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
  };
}

function formatDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function estamaAppealBusinessDate(value = new Date()) {
  const { year, month, day, hour } = jstDateParts(value);
  if (hour >= 6) return formatDate(year, month, day);

  // Noon UTC is safely within the same calendar date in JST. Moving back one
  // UTC date therefore gives the previous JST calendar date without DST edge
  // cases (Japan does not currently observe DST).
  const previous = new Date(Date.UTC(year, month - 1, day - 1, 12));
  return formatDate(
    previous.getUTCFullYear(),
    previous.getUTCMonth() + 1,
    previous.getUTCDate(),
  );
}

export function jstAppealBusinessMinutes(value = new Date()) {
  const { hour, minute } = jstDateParts(value);
  const minutes = hour * 60 + minute;
  return minutes < BUSINESS_DAY_START_MINUTES ? minutes + 24 * 60 : minutes;
}

function parseClockMinutes(value: string) {
  const match = value.normalize("NFKC").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 47 || minute > 59) return null;
  return hour * 60 + minute;
}

function normalizeShift(shift: EstamaAppealShift): StaffedInterval | null {
  const parsedStart = parseClockMinutes(shift.startTime);
  const parsedEnd = parseClockMinutes(shift.endTime);
  if (parsedStart === null || parsedEnd === null) return null;

  let startMinutes = parsedStart;
  let endMinutes = parsedEnd;
  if (startMinutes < BUSINESS_DAY_START_MINUTES) startMinutes += 24 * 60;
  if (endMinutes < BUSINESS_DAY_START_MINUTES) endMinutes += 24 * 60;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;

  return { startMinutes, endMinutes };
}

function mergeStaffedIntervals(shifts: EstamaAppealShift[]) {
  const intervals = shifts
    .map(normalizeShift)
    .filter((interval): interval is StaffedInterval => interval !== null)
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes);

  const merged: StaffedInterval[] = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (!previous || interval.startMinutes > previous.endMinutes) {
      merged.push({ ...interval });
      continue;
    }
    previous.endMinutes = Math.max(previous.endMinutes, interval.endMinutes);
  }
  return merged;
}

function minuteAtStaffedOffset(intervals: StaffedInterval[], offset: number) {
  let elapsed = 0;
  for (const interval of intervals) {
    const duration = interval.endMinutes - interval.startMinutes;
    if (offset < elapsed + duration) {
      return Math.min(interval.endMinutes - 1, interval.startMinutes + Math.floor(offset - elapsed));
    }
    elapsed += duration;
  }

  const last = intervals.at(-1);
  return last ? last.endMinutes - 1 : null;
}

export function buildEstamaAppealTargets(shifts: EstamaAppealShift[]) {
  const intervals = mergeStaffedIntervals(shifts);
  const staffedMinutes = intervals.reduce(
    (total, interval) => total + interval.endMinutes - interval.startMinutes,
    0,
  );
  if (staffedMinutes <= 0) return [];

  return [1 / 6, 1 / 2, 5 / 6].map((fraction) => (
    minuteAtStaffedOffset(intervals, staffedMinutes * fraction)
  )).filter((minute): minute is number => minute !== null);
}

export function estamaAppealScheduledIso(businessDate: string, businessMinutes: number) {
  const match = businessDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(businessMinutes) || businessMinutes < 0) {
    throw new Error("アピール予定日時が不正です");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    calendarCheck.getUTCFullYear() !== year
    || calendarCheck.getUTCMonth() !== month - 1
    || calendarCheck.getUTCDate() !== day
  ) {
    throw new Error("アピール予定日が不正です");
  }

  const dayOffset = Math.floor(businessMinutes / (24 * 60));
  const minuteOfDay = businessMinutes % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return new Date(Date.UTC(
    year,
    month - 1,
    day + dayOffset,
    hour - 9,
    minute,
  )).toISOString();
}

export function nextDueEstamaAppealSlot(input: {
  shifts: EstamaAppealShift[];
  slots: EstamaAppealSlotState[];
  businessDate: string;
  now: Date;
}) {
  const targets = buildEstamaAppealTargets(input.shifts);
  if (targets.length !== 3) return null;

  // If Estama says the allowance is exhausted, or a prior click cannot be
  // confirmed, stop the rest of the business day rather than risk duplicates.
  if (input.slots.some((slot) => slot.status === "skipped" || slot.status === "uncertain")) {
    return null;
  }
  if (input.slots.some((slot) => (
    slot.status === "error" && Number(slot.attemptCount || 0) >= 3
  ))) return null;

  const currentMinutes = jstAppealBusinessMinutes(input.now);
  const slots = new Map(input.slots.map((slot) => [slot.slot, slot]));
  for (let index = 0; index < targets.length; index += 1) {
    const slot = index + 1;
    const previous = slots.get(slot);
    if (previous?.status === "success") continue;
    if (currentMinutes < targets[index]) return null;
    return {
      slot,
      scheduledFor: estamaAppealScheduledIso(input.businessDate, targets[index]),
    };
  }
  return null;
}

export function isEstamaAppealShiftActive(shift: EstamaAppealShift, currentMinutes: number) {
  const interval = normalizeShift(shift);
  return Boolean(
    interval
    && currentMinutes >= interval.startMinutes
    && currentMinutes < interval.endMinutes,
  );
}

export function parseEstamaAppealRemaining(value: string) {
  const normalized = value.normalize("NFKC");
  const match = normalized.match(/本日の残り回数\s*[:：]?\s*(\d+)\s*回/);
  return match ? Number(match[1]) : null;
}

export function parseEstamaLastAppeal(value: string) {
  const normalized = value.normalize("NFKC");
  const match = normalized.match(/(?:最終|最新)アピール\s*[:：]?\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const hour = Number(match[3]);
  const minute = Number(match[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isConfirmedEstamaAppeal({
  beforeRemaining,
  afterRemaining,
  beforeLastAppeal,
  afterLastAppeal,
}: EstamaAppealConfirmation) {
  return beforeRemaining !== null
    && afterRemaining !== null
    && beforeRemaining - afterRemaining === 1
    && afterLastAppeal !== null
    && beforeLastAppeal !== afterLastAppeal;
}
