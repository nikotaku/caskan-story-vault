const TOKYO_CLOCK_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const addDaysToDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const dateKeyToEpochMinutes = (dateKey: string) =>
  Date.parse(`${dateKey}T00:00:00Z`) / 60_000;

const getTokyoClock = (now: Date) => {
  const parts = Object.fromEntries(
    TOKYO_CLOCK_FORMATTER.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour) % 24;

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
  };
};

export const getTokyoMinutesOfDay = (now: Date = new Date()) =>
  getTokyoClock(now).minutes;

/**
 * 営業日と表示時刻から実際の暦日時を求め、東京の現在時刻より前かを判定する。
 * 00:00〜05:59は前営業日の深夜枠として翌暦日に置き換える。
 */
export const isPastBookingSlot = ({
  businessDateKey,
  time,
  now = new Date(),
}: {
  businessDateKey: string;
  time: string;
  now?: Date;
}) => {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  const slotDateKey = hour < 6 ? addDaysToDateKey(businessDateKey, 1) : businessDateKey;
  const slotEpochMinutes = dateKeyToEpochMinutes(slotDateKey) + hour * 60 + minute;
  const tokyoNow = getTokyoClock(now);
  const nowEpochMinutes = dateKeyToEpochMinutes(tokyoNow.dateKey) + tokyoNow.minutes;

  return slotEpochMinutes < nowEpochMinutes;
};

export const reconcileBookingStartTime = ({
  availableSlots,
  businessDateKey,
  startTime,
  now = new Date(),
}: {
  availableSlots: string[];
  businessDateKey: string;
  startTime: string;
  now?: Date;
}) => {
  const expired = Boolean(startTime) && isPastBookingSlot({ businessDateKey, time: startTime, now });
  if (expired) return { nextStartTime: "", reason: "expired" as const };
  if (startTime && !availableSlots.includes(startTime)) {
    return { nextStartTime: "", reason: "unavailable" as const };
  }
  if (startTime) return { nextStartTime: startTime, reason: null };
  return { nextStartTime: availableSlots[0] ?? "", reason: null };
};
