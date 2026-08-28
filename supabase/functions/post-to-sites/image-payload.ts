import { assertRequiredPostImageSize } from "./image-size.ts";

export const MAX_POST_IMAGE_BYTES = 1_500_000;
const MAX_BASE64_LENGTH = Math.ceil(MAX_POST_IMAGE_BYTES / 3) * 4;

export function decodeRequiredPostImageBase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || !value || value.length > MAX_BASE64_LENGTH
    || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("600×600のJPEG画像を1枚指定してください");
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error("画像データを読み取れませんでした");
  }
  if (!binary.length || binary.length > MAX_POST_IMAGE_BYTES) {
    throw new Error("600×600のJPEG画像は1.5MB以内にしてください");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  assertRequiredPostImageSize(bytes, "image/jpeg");
  return bytes;
}
