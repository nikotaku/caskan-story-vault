import assert from "node:assert/strict";
import test from "node:test";

import {
  ESTAMA_CAST_PHOTO_HEIGHT,
  ESTAMA_CAST_PHOTO_STYLE,
  ESTAMA_CAST_PHOTO_WIDTH,
} from "../src/lib/publicCastPhoto.ts";

test("public therapist photos use Estama's 357 x 556 display ratio", () => {
  assert.equal(ESTAMA_CAST_PHOTO_WIDTH, 357);
  assert.equal(ESTAMA_CAST_PHOTO_HEIGHT, 556);
  assert.equal(ESTAMA_CAST_PHOTO_STYLE.aspectRatio, "357 / 556");
});
