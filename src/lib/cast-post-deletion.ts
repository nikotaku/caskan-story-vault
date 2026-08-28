export type CastPostDeletionCandidate = {
  status: string | null;
  o2_status: string | null;
  esutama_status: string | null;
  o2_error: string | null;
  esutama_error: string | null;
  estamaReviewRequired: boolean;
};

export const canDeleteFailedCastPost = (post: CastPostDeletionCandidate) => {
  if (post.estamaReviewRequired) return false;
  if ([post.o2_status, post.esutama_status].includes("posting")) return false;

  return post.status === "failed"
    || [post.o2_status, post.esutama_status].some((status) => ["failed", "skipped"].includes(status || ""))
    || Boolean(post.o2_error || post.esutama_error);
};
