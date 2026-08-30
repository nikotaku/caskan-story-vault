export const CAST_POST_REVIEW_REQUIRED_PREFIX = "【要確認・再送停止】";

export const isCastPostReviewRequired = (error: string | null | undefined) =>
  Boolean(error?.startsWith(CAST_POST_REVIEW_REQUIRED_PREFIX));
