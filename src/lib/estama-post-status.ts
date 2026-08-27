export const ESTAMA_REVIEW_REQUIRED_PREFIX = "【要確認・再送停止】";

export const isEstamaReviewRequired = (error: string | null | undefined) =>
  Boolean(error?.startsWith(ESTAMA_REVIEW_REQUIRED_PREFIX));
