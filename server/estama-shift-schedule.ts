export type EstamaShiftAction = "upsert" | "delete";

export const estamaIndividualShiftAdminUrl = (externalId: string | null | undefined) => {
  const normalized = typeof externalId === "string" ? externalId.trim() : "";
  return normalized
    ? `https://estama.jp/admin/schedule/${encodeURIComponent(normalized)}/`
    : null;
};

export const estamaScheduleEndTime = (startTime: string, endTime: string) => {
  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour > startHour) {
    return endTime.slice(0, 5);
  }
  const overnightHour = Math.min(endHour + 24, 25);
  return `${String(overnightHour).padStart(2, "0")}:${endTime.slice(3, 5)}`;
};

export const estamaScheduleExpectation = (
  action: EstamaShiftAction,
  startTime: string,
  endTime: string,
) => action === "delete"
  ? { start: "", end: "" }
  : {
    start: startTime.slice(0, 5),
    end: estamaScheduleEndTime(startTime, endTime),
  };
