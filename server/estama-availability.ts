const REQUIRED_AVAILABILITY_OPTIONS = ["未設定", "今すぐ", "30分以内", "1時間以内"];

export type EstamaShiftRange = {
  startMinutes: number;
  endMinutes: number;
};

export const normalizeEstamaAvailabilityLabel = (value: string) => value
  .normalize("NFKC")
  .replace(/[\s\u3000]+/g, "")
  .trim();

export function isEstamaAvailabilitySelect(optionLabels: string[]) {
  const labels = new Set(optionLabels.map(normalizeEstamaAvailabilityLabel));
  return REQUIRED_AVAILABILITY_OPTIONS.every((label) => labels.has(label));
}

export function parseEstamaShiftRange(value: string): EstamaShiftRange | null {
  const normalized = value.normalize("NFKC");
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*[〜～~\-–—]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if (
    startHour > 47
    || endHour > 47
    || startMinute > 59
    || endMinute > 59
  ) return null;

  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return { startMinutes, endMinutes };
}

export function jstBusinessMinutes(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const minutes = hour * 60 + minute;
  return hour < 6 ? minutes + 24 * 60 : minutes;
}

export function isEstamaShiftActive(range: EstamaShiftRange, currentMinutes: number) {
  return currentMinutes >= range.startMinutes && currentMinutes < range.endMinutes;
}
