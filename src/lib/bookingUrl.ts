const BOOKING_KEY_LENGTH = 8;
const BOOKING_KEY_PATTERN = /^[0-9a-f]{8}$/i;

export const getBookingKey = (castId: string) =>
  castId.replace(/-/g, "").slice(0, BOOKING_KEY_LENGTH).toLowerCase();

export const isBookingKey = (value: string) =>
  BOOKING_KEY_PATTERN.test(value);

export const normalizePublicBaseUrl = (baseUrl: string) =>
  baseUrl.trim().replace(/\/+$/, "");

export const getCastBookingUrl = (baseUrl: string, castId: string) =>
  `${normalizePublicBaseUrl(baseUrl)}/r/${getBookingKey(castId)}`;

export const getCustomDomainBaseUrl = (customDomain?: string | null) => {
  const domain = customDomain
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");

  return domain ? `https://${domain}` : null;
};
