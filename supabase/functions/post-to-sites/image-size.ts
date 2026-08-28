export const REQUIRED_POST_IMAGE_SIZE = 600;

export type ImageDimensions = {
  width: number;
  height: number;
};

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

const readUint24LE = (bytes: Uint8Array, offset: number) =>
  bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);

const readUint32LE = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);

const jpegDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      if (segmentLength < 8) return null;
      const dimensions = {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
      return dimensions.width > 0 && dimensions.height > 0 ? dimensions : null;
    }
    offset += segmentLength;
  }
  return null;
};

const pngDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || ascii(bytes, 12, 4) !== "IHDR") return null;
  const dimensions = { width: view.getUint32(16), height: view.getUint32(20) };
  return dimensions.width > 0 && dimensions.height > 0 ? dimensions : null;
};

const webpDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const declaredLength = readUint32LE(bytes, 4) + 8;
  if (declaredLength < 20 || declaredLength > bytes.length) return null;
  let offset = 12;
  while (offset + 8 <= declaredLength) {
    const chunkType = ascii(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const payload = offset + 8;
    if (payload + chunkSize > declaredLength) return null;
    if (chunkType === "VP8X" && chunkSize >= 10) {
      const dimensions = {
        width: readUint24LE(bytes, payload + 4) + 1,
        height: readUint24LE(bytes, payload + 7) + 1,
      };
      return dimensions.width > 0 && dimensions.height > 0 ? dimensions : null;
    }
    if (chunkType === "VP8L" && chunkSize >= 5 && bytes[payload] === 0x2f) {
      const b1 = bytes[payload + 1];
      const b2 = bytes[payload + 2];
      const b3 = bytes[payload + 3];
      const b4 = bytes[payload + 4];
      const dimensions = {
        width: 1 + (b1 | ((b2 & 0x3f) << 8)),
        height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
      };
      return dimensions.width > 0 && dimensions.height > 0 ? dimensions : null;
    }
    if (chunkType === "VP8 " && chunkSize >= 10 &&
      bytes[payload + 3] === 0x9d && bytes[payload + 4] === 0x01 && bytes[payload + 5] === 0x2a) {
      const dimensions = {
        width: (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff,
        height: (bytes[payload + 8] | (bytes[payload + 9] << 8)) & 0x3fff,
      };
      return dimensions.width > 0 && dimensions.height > 0 ? dimensions : null;
    }
    offset = payload + chunkSize + (chunkSize % 2);
  }
  return null;
};

type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

const imageTypeFromBytes = (bytes: Uint8Array): SupportedImageType | null => {
  if (pngDimensions(bytes)) return "image/png";
  if (webpDimensions(bytes)) return "image/webp";
  if (jpegDimensions(bytes)) return "image/jpeg";
  return null;
};

export const readImageDimensions = (bytes: Uint8Array): ImageDimensions | null =>
  pngDimensions(bytes) || webpDimensions(bytes) || jpegDimensions(bytes);

const normalizedContentType = (contentType: string): SupportedImageType | null => {
  const type = contentType.split(";", 1)[0].trim().toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  return ["image/jpeg", "image/png", "image/webp"].includes(type) ? type as SupportedImageType : null;
};

export const assertImageSize = (
  bytes: Uint8Array,
  contentType: string,
  requiredWidth: number,
  requiredHeight: number,
) => {
  if (!Number.isInteger(requiredWidth) || requiredWidth <= 0
    || !Number.isInteger(requiredHeight) || requiredHeight <= 0) {
    throw new Error("画像サイズの指定が不正です");
  }
  const actualType = imageTypeFromBytes(bytes);
  const declaredType = normalizedContentType(contentType);
  if (!actualType || !declaredType || actualType !== declaredType) {
    throw new Error("画像形式を確認できません。JPEG・PNG・WebPを使用してください");
  }
  const dimensions = readImageDimensions(bytes);
  if (!dimensions) throw new Error("画像の縦横サイズを確認できません");
  if (dimensions.width !== requiredWidth || dimensions.height !== requiredHeight) {
    throw new Error(`画像は${requiredWidth}×${requiredHeight}のみ投稿できます（現在${dimensions.width}×${dimensions.height}）`);
  }
  return dimensions;
};

export const assertRequiredPostImageSize = (bytes: Uint8Array, contentType: string) =>
  assertImageSize(bytes, contentType, REQUIRED_POST_IMAGE_SIZE, REQUIRED_POST_IMAGE_SIZE);
