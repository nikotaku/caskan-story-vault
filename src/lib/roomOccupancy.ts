const MINUTES_PER_DAY = 24 * 60;
const EARLY_MORNING_CUTOFF_HOUR = 6;

export const ROOM_OPERATING_START_MINUTE = 11 * 60;
export const ROOM_OPERATING_END_MINUTE = (24 + 2) * 60;

export interface RoomOccupancyShift {
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  approval_status: string;
  status?: string;
}

export interface MonthlyRoomOccupancy {
  percentage: number;
  occupiedMinutes: number;
  capacityMinutes: number;
  daysInMonth: number;
}

type Interval = [start: number, end: number];

const parseOperationalMinute = (time: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 47 || minute < 0 || minute > 59) {
    return null;
  }

  const extendedHour = hour < EARLY_MORNING_CUTOFF_HOUR ? hour + 24 : hour;
  return extendedHour * 60 + minute;
};

const mergeIntervals = (intervals: Interval[]): Interval[] => {
  if (intervals.length < 2) return intervals;

  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [[sorted[0][0], sorted[0][1]]];

  for (const [start, end] of sorted.slice(1)) {
    const latest = merged[merged.length - 1];
    if (start <= latest[1]) {
      latest[1] = Math.max(latest[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
};

/**
 * 月間のルーム稼働率を、11:00〜翌2:00の営業時間を上限として計算する。
 * 同じ日・同じルームで重複するシフトは、重なった時間を二重計上しない。
 */
export const calculateMonthlyRoomOccupancy = (
  shifts: RoomOccupancyShift[],
  month: Date,
  rooms: readonly string[],
): MonthlyRoomOccupancy => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const roomSet = new Set(rooms);
  const intervalsByRoomAndDate = new Map<string, Interval[]>();

  for (const shift of shifts) {
    if (
      !shift.shift_date.startsWith(monthPrefix)
      || shift.approval_status !== "approved"
      || shift.status === "cancelled"
      || !shift.room
      || !roomSet.has(shift.room)
    ) {
      continue;
    }

    const start = parseOperationalMinute(shift.start_time);
    let end = parseOperationalMinute(shift.end_time);
    if (start === null || end === null || start === end) continue;
    if (end < start) end += MINUTES_PER_DAY;

    const clippedStart = Math.max(start, ROOM_OPERATING_START_MINUTE);
    const clippedEnd = Math.min(end, ROOM_OPERATING_END_MINUTE);
    if (clippedEnd <= clippedStart) continue;

    const key = `${shift.shift_date}:${shift.room}`;
    const intervals = intervalsByRoomAndDate.get(key) ?? [];
    intervals.push([clippedStart, clippedEnd]);
    intervalsByRoomAndDate.set(key, intervals);
  }

  let occupiedMinutes = 0;
  for (const intervals of intervalsByRoomAndDate.values()) {
    occupiedMinutes += mergeIntervals(intervals).reduce((total, [start, end]) => total + end - start, 0);
  }

  const dailyCapacityMinutes = ROOM_OPERATING_END_MINUTE - ROOM_OPERATING_START_MINUTE;
  const capacityMinutes = dailyCapacityMinutes * daysInMonth * rooms.length;
  const percentage = capacityMinutes > 0
    ? Math.min(100, (occupiedMinutes / capacityMinutes) * 100)
    : 0;

  return {
    percentage,
    occupiedMinutes,
    capacityMinutes,
    daysInMonth,
  };
};
