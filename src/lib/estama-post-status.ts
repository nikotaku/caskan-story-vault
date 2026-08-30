import {
  CAST_POST_REVIEW_REQUIRED_PREFIX,
  isCastPostReviewRequired,
} from "./cast-post-status.ts";

export const ESTAMA_REVIEW_REQUIRED_PREFIX = CAST_POST_REVIEW_REQUIRED_PREFIX;

export const isEstamaReviewRequired = (error: string | null | undefined) =>
  isCastPostReviewRequired(error);
