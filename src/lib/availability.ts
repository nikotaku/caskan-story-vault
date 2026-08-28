export const DEFAULT_RESERVATION_INTERVAL_MINUTES = 20;
export const AVAILABILITY_STEP_MINUTES = 10;
export const MINIMUM_BOOKABLE_DURATION_MINUTES = 60;

export interface AvailabilityReservation {
  start: number;
  duration: number;
}

interface FindNextAvailableStartInput {
  shiftStart: number;
  shiftEnd: number;
  reservations: AvailabilityReservation[];
  intervalMinutes?: number;
  currentTime?: number;
  minimumDuration?: number;
  stepMinutes?: number;
}

interface IsAvailabilitySlotOpenInput {
  slotStart: number;
  duration: number;
  shiftStart: number;
  shiftEnd: number;
  reservations: AvailabilityReservation[];
  intervalMinutes?: number;
}

export const ceilToMinutes = (minutes: number, stepMinutes: number) =>
  Math.ceil(minutes / stepMinutes) * stepMinutes;

export function isAvailabilitySlotOpen({
  slotStart,
  duration,
  shiftStart,
  shiftEnd,
  reservations,
  intervalMinutes = DEFAULT_RESERVATION_INTERVAL_MINUTES,
}: IsAvailabilitySlotOpenInput): boolean {
  if (slotStart < shiftStart || slotStart + duration > shiftEnd) return false;

  return !reservations.some((reservation) => {
    const reservedEnd = reservation.start + reservation.duration + intervalMinutes;
    return slotStart < reservedEnd && slotStart + duration > reservation.start;
  });
}

/**
 * Returns the first start time that fits inside a shift after reservations and
 * the configured preparation interval. Times may exceed 24:00 for overnight
 * shifts (for example, 00:40 is represented as 1480).
 */
export function findNextAvailableStart({
  shiftStart,
  shiftEnd,
  reservations,
  intervalMinutes = DEFAULT_RESERVATION_INTERVAL_MINUTES,
  currentTime = shiftStart,
  minimumDuration = MINIMUM_BOOKABLE_DURATION_MINUTES,
  stepMinutes = AVAILABILITY_STEP_MINUTES,
}: FindNextAvailableStartInput): number | null {
  let cursor = ceilToMinutes(Math.max(shiftStart, currentTime), stepMinutes);
  const reservedBlocks = reservations
    .map((reservation) => ({
      start: reservation.start,
      end: reservation.start + reservation.duration + intervalMinutes,
    }))
    .sort((a, b) => a.start - b.start);

  while (cursor + minimumDuration <= shiftEnd) {
    const conflict = reservedBlocks.find(
      (block) => cursor < block.end && cursor + minimumDuration > block.start,
    );

    if (!conflict) return cursor;
    cursor = ceilToMinutes(conflict.end, stepMinutes);
  }

  return null;
}

export function formatAvailabilityTime(minutes: number): string {
  const normalized = minutes % (24 * 60);
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}
