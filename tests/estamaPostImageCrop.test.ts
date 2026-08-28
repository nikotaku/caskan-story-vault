import assert from "node:assert/strict";
import test from "node:test";

import { getCenteredSquareCrop, POST_IMAGE_SIZE } from "../src/lib/post-image.ts";

test("投稿画像の出力サイズは600px固定", () => {
  assert.equal(POST_IMAGE_SIZE, 600);
});

test("横長画像は左右を同じ幅だけ中央トリミングする", () => {
  assert.deepEqual(getCenteredSquareCrop(1200, 800), {
    sourceX: 200,
    sourceY: 0,
    sourceSize: 800,
  });
});

test("縦長画像は上下を同じ高さだけ中央トリミングする", () => {
  assert.deepEqual(getCenteredSquareCrop(800, 1200), {
    sourceX: 0,
    sourceY: 200,
    sourceSize: 800,
  });
});

test("正方形画像は全体を使用する", () => {
  assert.deepEqual(getCenteredSquareCrop(900, 900), {
    sourceX: 0,
    sourceY: 0,
    sourceSize: 900,
  });
});

for (const [width, height] of [[0, 600], [600, 0], [-1, 600], [Number.NaN, 600]]) {
  test(`不正な元画像サイズ ${width}x${height} を拒否する`, () => {
    assert.throws(() => getCenteredSquareCrop(width, height), /縦横サイズを確認できません/);
  });
}
