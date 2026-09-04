export interface DailySalesSubmission {
  cast_id: string | null;
  status: string;
}

export type TimelineSettlementIndicator =
  | "completed"
  | "submitted"
  | "action"
  | "hidden";

const SUBMITTED_SALES_STATUSES = new Set(["pending", "confirmed"]);

export function getSubmittedCastIds(
  submissions: DailySalesSubmission[],
): Set<string> {
  return new Set(
    submissions
      .filter(
        (submission): submission is DailySalesSubmission & { cast_id: string } =>
          Boolean(submission.cast_id)
          && SUBMITTED_SALES_STATUSES.has(submission.status),
      )
      .map((submission) => submission.cast_id),
  );
}

export function getTimelineSettlementIndicator(
  reservationStatus: string,
  settlementSubmitted: boolean,
): TimelineSettlementIndicator {
  if (reservationStatus === "completed") return "completed";
  if (reservationStatus === "cancelled") return "hidden";
  if (reservationStatus === "confirmed" && settlementSubmitted) return "submitted";
  return "action";
}
