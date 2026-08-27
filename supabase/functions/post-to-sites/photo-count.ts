export type WorkerPhotoCount = {
  expected: number;
  uploaded: number | null;
  posted: boolean;
  matches: boolean;
};

export type WorkerFailureSafety = {
  submissionUncertain: boolean;
  waitingForLogin: boolean;
};

export function workerPhotoCount(imageUrls: string[] | null, result: Record<string, unknown>): WorkerPhotoCount {
  const expected = Array.isArray(imageUrls) ? imageUrls.length : 0;
  const rawUploaded = result.uploadedPhotos;
  const uploaded = typeof rawUploaded === "number" && Number.isInteger(rawUploaded) && rawUploaded >= 0
    ? rawUploaded
    : null;
  const posted = result.posted === true;
  return { expected, uploaded, posted, matches: posted && uploaded === expected };
}

export function workerFailureSafety(
  responseOk: boolean | null,
  payload: Record<string, unknown>,
): WorkerFailureSafety {
  const waitingForLogin = payload.loginRequired === true
    || payload.soulLoginRequired === true
    || payload.activationRequired === true;
  const opaqueWorkerFailure = responseOk === false
    && !waitingForLogin
    && payload.safeToRetry !== true;
  return {
    waitingForLogin,
    submissionUncertain: payload.submissionUncertain === true
      || responseOk === null
      || opaqueWorkerFailure,
  };
}
