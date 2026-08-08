/**
 * 深夜またぎシフト対応の時刻表示。
 * 06:00 未満の時刻は翌日扱い（24時間超）として表示する。
 * 例: "00:10" → "24:10"、"01:30" → "25:30"、"13:00" → "13:00"
 */
export const toExtTime = (timeStr: string): string => {
  const s = timeStr.slice(0, 5);
  const [h, m] = s.split(":").map(Number);
  if (h < 6) return `${24 + h}:${String(m).padStart(2, "0")}`;
  return s;
};

/**
 * 24:00 以降の営業日時を、DBに保存できる暦日＋24時間未満の時刻へ変換する。
 * 例: 8/8 24:40 → 8/9 00:40
 */
export const toStoredTime = (timeStr: string): { dayOffset: number; time: string } => {
  const [rawHour, rawMinute] = timeStr.slice(0, 5).split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? Math.max(0, rawHour) : 0;
  const minute = Number.isFinite(rawMinute) ? Math.min(59, Math.max(0, rawMinute)) : 0;

  return {
    dayOffset: Math.floor(hour / 24),
    time: `${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
};
