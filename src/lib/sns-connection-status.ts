type XConnectionStatus = {
  credentialConfigured?: boolean | null;
  loginId?: string | null;
  profileUrl?: string | null;
};

export const normalizeXId = (value: string) => value
  .trim()
  .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "")
  .replace(/^@/, "")
  .split(/[/?#]/, 1)[0];

const isValidXId = (value: string | null | undefined) =>
  /^[A-Za-z0-9_]+$/.test(normalizeXId(value || ""));

export const hasSavedXId = ({
  credentialConfigured,
  loginId,
  profileUrl,
}: XConnectionStatus) => Boolean(
  credentialConfigured
  || isValidXId(loginId)
  || isValidXId(profileUrl)
);
