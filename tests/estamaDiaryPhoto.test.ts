import assert from "node:assert/strict";
import test from "node:test";

import type { Locator, Page } from "playwright-core";

import {
  assertEstamaDiaryPhotoReady,
  completeEstamaDiaryPhotoCrop,
  type EstamaDiaryPhotoState,
} from "../server/estama-diary-photo.ts";

const readyState: EstamaDiaryPhotoState = {
  selectedFiles: 1,
  photoDataLength: 128,
  photoDataIsImage: true,
  previewHasSource: true,
  previewVisible: true,
  previewComplete: true,
  previewWidth: 600,
  previewHeight: 600,
};

const waitingState: EstamaDiaryPhotoState = {
  ...readyState,
  photoDataLength: 0,
  photoDataIsImage: false,
  previewHasSource: false,
  previewVisible: false,
  previewComplete: false,
  previewWidth: 0,
  previewHeight: 0,
};

type CropState = {
  containerCount: number;
  cropBoxReady: boolean;
  imageReady: boolean;
};

type DoneControl = {
  tag: string;
  id: string;
  type: string;
  text: string;
};

const createHarness = ({
  initialState = waitingState,
  finalState = readyState,
  cropState = { containerCount: 1, cropBoxReady: true, imageReady: true },
  doneCount = 1,
  doneControl = { tag: "BUTTON", id: "crop-done-btn", type: "button", text: "完了" },
  cropperVisibleAfterClick = 0,
}: {
  initialState?: EstamaDiaryPhotoState;
  finalState?: EstamaDiaryPhotoState;
  cropState?: CropState;
  doneCount?: number;
  doneControl?: DoneControl;
  cropperVisibleAfterClick?: number;
} = {}) => {
  let clicked = false;
  let clickCount = 0;
  let cropInspectionCount = 0;

  const form = {
    async evaluate() {
      return clicked ? finalState : initialState;
    },
  } as unknown as Locator;

  const cropper = {
    async evaluateAll() {
      cropInspectionCount += 1;
      return cropState;
    },
    async count() {
      return clicked ? cropperVisibleAfterClick : cropState.containerCount;
    },
  };

  const done = {
    async count() {
      return doneCount;
    },
    async evaluate() {
      return doneControl;
    },
    async click() {
      clickCount += 1;
      clicked = true;
    },
  };

  const page = {
    locator(selector: string) {
      if (selector === ".cropper-container:visible") return cropper;
      if (selector === 'button#crop-done-btn[type="button"]:visible') return done;
      throw new Error(`Unexpected locator: ${selector}`);
    },
    async waitForTimeout() {
      // Polling is disabled in these focused unit tests.
    },
  } as unknown as Page;

  return {
    form,
    page,
    get clickCount() { return clickCount; },
    get cropInspectionCount() { return cropInspectionCount; },
  };
};

const immediate = { timeoutMs: 0, pollIntervalMs: 0 };

test("正確な完了ボタンを押すと切り取り済み画像が送信可能になる", async () => {
  const harness = createHarness();

  const state = await completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate);

  assert.deepEqual(state, readyState);
  assert.equal(harness.clickCount, 1);
});

for (const doneCount of [0, 2]) {
  test(`完了ボタンが${doneCount}件なら投稿せず停止する`, async () => {
    const harness = createHarness({ doneCount });

    await assert.rejects(
      completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
      new RegExp(`完了ボタンを特定できません（${doneCount}件）`),
    );
    assert.equal(harness.clickCount, 0);
  });
}

test("同じIDでもsubmitボタンは拒否しクリックしない", async () => {
  const harness = createHarness({
    doneControl: { tag: "BUTTON", id: "crop-done-btn", type: "submit", text: "完了" },
  });

  await assert.rejects(
    completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
    /画像切り取り完了ボタンが想定と異なります/,
  );
  assert.equal(harness.clickCount, 0);
});

for (const [label, cropState] of [
  ["切り取り枠", { containerCount: 1, cropBoxReady: false, imageReady: true }],
  ["切り取り画像", { containerCount: 1, cropBoxReady: true, imageReady: false }],
] as const) {
  test(`${label}の準備ができていなければ完了ボタンを押さない`, async () => {
    const harness = createHarness({ cropState });

    await assert.rejects(
      completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
      /画像切り取り画面を準備できません（表示1件）/,
    );
    assert.equal(harness.clickCount, 0);
  });
}

test("完了後もphoto_dataが空なら送信可能と判定しない", async () => {
  const harness = createHarness({
    finalState: { ...readyState, photoDataLength: 0, photoDataIsImage: false },
  });

  await assert.rejects(
    completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
    /画像切り取りを完了できません/,
  );
  assert.equal(harness.clickCount, 1);
});

test("完了後のphoto_dataが画像Data URLでなければ送信可能と判定しない", async () => {
  const harness = createHarness({
    finalState: { ...readyState, photoDataIsImage: false },
  });

  await assert.rejects(
    completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
    /画像切り取りを完了できません/,
  );
  assert.equal(harness.clickCount, 1);
});

for (const [label, finalState] of [
  ["非表示", { ...readyState, previewVisible: false }],
  ["未読込", { ...readyState, previewComplete: false, previewWidth: 0, previewHeight: 0 }],
] as const) {
  test(`完了後のプレビューが${label}なら送信可能と判定しない`, async () => {
    const harness = createHarness({ finalState });

    await assert.rejects(
      completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
      /画像切り取りを完了できません/,
    );
    assert.equal(harness.clickCount, 1);
  });
}

test("完了後のプレビューが600×600でなければ送信可能と判定しない", async () => {
  const harness = createHarness({
    finalState: { ...readyState, previewWidth: 601 },
  });

  await assert.rejects(
    completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
    /画像切り取りを完了できません/,
  );
  assert.equal(harness.clickCount, 1);
});

test("送信用画像の準備完了を確認できる", async () => {
  const harness = createHarness({ initialState: readyState });

  const state = await assertEstamaDiaryPhotoReady(harness.form);

  assert.deepEqual(state, readyState);
});

test("送信用画像が未準備なら確認に失敗する", async () => {
  const harness = createHarness({ initialState: waitingState });

  await assert.rejects(
    assertEstamaDiaryPhotoReady(harness.form),
    /送信用画像を準備できません/,
  );
});

for (const selectedFiles of [0, 2]) {
  test(`切り取り対象が${selectedFiles}枚なら画面操作前に停止する`, async () => {
    const harness = createHarness({
      initialState: { ...waitingState, selectedFiles },
    });

    await assert.rejects(
      completeEstamaDiaryPhotoCrop(harness.page, harness.form, immediate),
      new RegExp(`指定1枚 / 選択${selectedFiles}枚`),
    );
    assert.equal(harness.cropInspectionCount, 0);
    assert.equal(harness.clickCount, 0);
  });
}
