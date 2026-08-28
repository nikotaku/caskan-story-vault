import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  decodeRequiredPostImageBase64,
  MAX_POST_IMAGE_BYTES,
} from "../supabase/functions/post-to-sites/image-payload.ts";

const createJpeg = (width: number, height: number) => new Uint8Array([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x0b, 0x08,
  (height >>> 8) & 0xff, height & 0xff,
  (width >>> 8) & 0xff, width & 0xff,
  0x01, 0x01, 0x11, 0x00,
  0xff, 0xd9,
]);

const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

test("600×600 JPEGのBase64だけを投稿画像として復元する", () => {
  const jpeg = createJpeg(600, 600);
  assert.deepEqual(decodeRequiredPostImageBase64(encode(jpeg)), jpeg);
});

for (const [width, height] of [[599, 600], [600, 601], [800, 800]]) {
  test(`${width}×${height} JPEGのBase64を拒否する`, () => {
    assert.throws(
      () => decodeRequiredPostImageBase64(encode(createJpeg(width, height))),
      /画像は600×600のみ投稿できます/,
    );
  });
}

for (const value of [null, "", "not-base64", "AAAA=", "data:image/jpeg;base64,AAAA"] as const) {
  test("空・破損・Data URL付きの画像ペイロードを拒否する", () => {
    assert.throws(() => decodeRequiredPostImageBase64(value), /600×600のJPEG画像を1枚指定してください/);
  });
}

test("1.5MBを超える画像ペイロードを拒否する", () => {
  const oversized = new Uint8Array(MAX_POST_IMAGE_BYTES + 1);
  assert.throws(
    () => decodeRequiredPostImageBase64(encode(oversized)),
    /600×600のJPEG画像を1枚指定してください|1.5MB以内/,
  );
});
