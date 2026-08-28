import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRequiredPostImageSize,
  readImageDimensions,
} from "../supabase/functions/post-to-sites/image-size.ts";

type ImageFixture = {
  label: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  create: (width: number, height: number) => Uint8Array;
};

const writeAscii = (bytes: Uint8Array, offset: number, value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
};

const createJpeg = (width: number, height: number) => new Uint8Array([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x0b, 0x08,
  (height >>> 8) & 0xff, height & 0xff,
  (width >>> 8) & 0xff, width & 0xff,
  0x01, 0x01, 0x11, 0x00,
  0xff, 0xd9,
]);

const createPng = (width: number, height: number) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  writeAscii(bytes, 12, "IHDR");
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([0x08, 0x02, 0x00, 0x00, 0x00], 24);
  return bytes;
};

const createWebpVp8x = (width: number, height: number) => {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(bytes, 8, "WEBP");
  writeAscii(bytes, 12, "VP8X");
  view.setUint32(16, 10, true);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes.set([
    encodedWidth & 0xff,
    (encodedWidth >>> 8) & 0xff,
    (encodedWidth >>> 16) & 0xff,
  ], 24);
  bytes.set([
    encodedHeight & 0xff,
    (encodedHeight >>> 8) & 0xff,
    (encodedHeight >>> 16) & 0xff,
  ], 27);
  return bytes;
};

const createWebpVp8 = (width: number, height: number) => {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(bytes, 8, "WEBP");
  writeAscii(bytes, 12, "VP8 ");
  view.setUint32(16, 10, true);
  bytes.set([0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a], 20);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
};

const createWebpVp8l = (width: number, height: number) => {
  const bytes = new Uint8Array(26);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(bytes, 8, "WEBP");
  writeAscii(bytes, 12, "VP8L");
  view.setUint32(16, 5, true);
  bytes[20] = 0x2f;
  const sizeBits = (width - 1) + ((height - 1) * 0x4000);
  view.setUint32(21, sizeBits, true);
  return bytes;
};

const fixtures: ImageFixture[] = [
  { label: "JPEG", contentType: "image/jpeg", create: createJpeg },
  { label: "PNG", contentType: "image/png", create: createPng },
  { label: "WebP VP8X", contentType: "image/webp", create: createWebpVp8x },
  { label: "WebP VP8", contentType: "image/webp", create: createWebpVp8 },
  { label: "WebP VP8L", contentType: "image/webp", create: createWebpVp8l },
];

for (const fixture of fixtures) {
  test(`${fixture.label}の600×600だけを投稿画像として受理する`, () => {
    const bytes = fixture.create(600, 600);

    assert.deepEqual(readImageDimensions(bytes), { width: 600, height: 600 });
    assert.deepEqual(assertRequiredPostImageSize(bytes, fixture.contentType), {
      width: 600,
      height: 600,
    });
  });

  for (const [width, height] of [
    [599, 599],
    [601, 601],
    [599, 600],
    [600, 601],
  ] as const) {
    test(`${fixture.label}の${width}×${height}を拒否する`, () => {
      assert.throws(
        () => assertRequiredPostImageSize(fixture.create(width, height), fixture.contentType),
        new RegExp(`600×600.*現在${width}×${height}`),
      );
    });
  }
}

test("宣言MIMEと実画像形式が違う画像を拒否する", () => {
  assert.throws(
    () => assertRequiredPostImageSize(createJpeg(600, 600), "image/png"),
    /画像形式を確認できません/,
  );
  assert.throws(
    () => assertRequiredPostImageSize(createPng(600, 600), "image/webp"),
    /画像形式を確認できません/,
  );
  assert.throws(
    () => assertRequiredPostImageSize(createWebpVp8x(600, 600), "image/jpeg"),
    /画像形式を確認できません/,
  );
});

test("JPEG・PNG・WebPを装った破損画像を拒否する", () => {
  const truncatedJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b]);
  const invalidPng = createPng(600, 600);
  invalidPng[12] = "B".charCodeAt(0);
  const truncatedWebp = createWebpVp8x(600, 600);
  new DataView(truncatedWebp.buffer).setUint32(4, truncatedWebp.length + 100, true);

  assert.throws(() => assertRequiredPostImageSize(truncatedJpeg, "image/jpeg"), /画像形式を確認できません/);
  assert.throws(() => assertRequiredPostImageSize(invalidPng, "image/png"), /画像形式を確認できません/);
  assert.throws(() => assertRequiredPostImageSize(truncatedWebp, "image/webp"), /画像形式を確認できません/);
  assert.throws(
    () => assertRequiredPostImageSize(new Uint8Array([0x00, 0x01, 0x02]), "image/jpeg"),
    /画像形式を確認できません/,
  );
});

test("切り出し元がオフセット付きUint8Arrayでも600×600を検証する", () => {
  const jpeg = createJpeg(600, 600);
  const container = new Uint8Array(jpeg.length + 8);
  container.set(jpeg, 4);
  const slice = container.subarray(4, 4 + jpeg.length);

  assert.deepEqual(assertRequiredPostImageSize(slice, "image/jpeg; charset=binary"), {
    width: 600,
    height: 600,
  });
});
