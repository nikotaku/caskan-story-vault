import assert from "node:assert/strict";
import test from "node:test";

import type { Page } from "playwright-core";

import { assertFormPhotoCount, uploadPhotos } from "../server/estama-photo-upload.ts";

type UploadedFile = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

type FakeInput = {
  accept: string;
  disabled: boolean;
  files: UploadedFile[];
  id: string;
  multiple: boolean;
  name: string;
  hasAttribute: (name: string) => boolean;
};

type SetInputFilesCall = {
  files: UploadedFile[];
  inputIndex: number;
};

const photoUrls = [
  "https://storage.googleapis.com/enka-test/photo-1.jpg",
  "https://storage.googleapis.com/enka-test/photo-2.jpg",
  "https://storage.googleapis.com/enka-test/photo-3.jpg",
];

const createInput = (multiple = false): FakeInput => ({
  accept: "image/*",
  disabled: false,
  files: [],
  id: "",
  multiple,
  name: "photo",
  hasAttribute(name) {
    return name === "multiple" && this.multiple;
  },
});

const createFakePage = ({
  inputs: initialInputs,
  addInputAfterSelection = false,
  clearFilesOnSettle = false,
  failFinalInspection = false,
  maxDynamicInputs = 3,
  retainedFilesPerInput,
}: {
  inputs: FakeInput[];
  addInputAfterSelection?: boolean;
  clearFilesOnSettle?: boolean;
  failFinalInspection?: boolean;
  maxDynamicInputs?: number;
  retainedFilesPerInput?: number;
}) => {
  const inputs = [...initialInputs];
  const calls: SetInputFilesCall[] = [];
  let inspectionCount = 0;

  const inputCollection = () => ({
    async count() {
      return inputs.length;
    },
    async evaluateAll(callback: (elements: Element[]) => unknown) {
      inspectionCount += 1;
      if (failFinalInspection && inspectionCount > 1) {
        throw new Error("DOM inspection failed");
      }
      return callback(inputs as unknown as Element[]);
    },
    nth(index: number) {
      return {
        async setInputFiles(value: UploadedFile | UploadedFile[]) {
          const files = Array.isArray(value) ? value : [value];
          inputs[index].files = retainedFilesPerInput === undefined
            ? files
            : files.slice(0, retainedFilesPerInput);
          calls.push({ inputIndex: index, files });
          if (addInputAfterSelection && inputs.length < maxDynamicInputs) {
            inputs.push(createInput());
          }
        },
      };
    },
  });

  const page = {
    locator() {
      return inputCollection();
    },
    async waitForTimeout() {
      // Unit tests do not need Playwright's UI-settling delay.
    },
    async waitForLoadState() {
      if (clearFilesOnSettle) inputs.forEach((input) => { input.files = []; });
    },
  } as unknown as Page;

  return { calls, inputs, page };
};

const imageResponse = (contentType = "image/jpeg", body = "image-data") =>
  new Response(body, {
    headers: {
      "content-length": String(Buffer.byteLength(body)),
      "content-type": contentType,
    },
  });

const successfulFetch = (async () => imageResponse()) as typeof fetch;

test("画像なしは写真欄を操作せず0枚で完了する", async () => {
  const { calls, page } = createFakePage({ inputs: [createInput(true)] });

  const uploaded = await uploadPhotos(page, [], {
    maxPhotos: 3,
    strict: true,
    fetchPhoto: successfulFetch,
  });

  assert.equal(uploaded, 0);
  assert.equal(calls.length, 0);
});

for (const count of [0, 1, 2, 3]) {
  test(`送信フォームへ指定${count}枚が直列化されることを確認する`, async () => {
    const form = {
      async evaluate() { return count; },
    };

    assert.equal(await assertFormPhotoCount(form as never, count), count);
  });
}

test("入力欄に3枚あっても送信フォームが1枚しか含まなければ中断する", async () => {
  const form = {
    async evaluate() { return 1; },
  };

  await assert.rejects(
    assertFormPhotoCount(form as never, 3),
    /送信フォーム内の写真枚数が一致しません（指定3枚 \/ 送信1枚）/,
  );
});

test("送信フォームの写真枚数を取得できなければ中断する", async () => {
  const form = {
    async evaluate() { throw new Error("serialization failed"); },
  };

  await assert.rejects(
    assertFormPhotoCount(form as never, 1),
    /送信フォーム内の写真枚数を確認できません/,
  );
});

test("画像0枚指定でも写真欄に残存ファイルがあれば投稿前に中断する", async () => {
  const staleInput = createInput(true);
  staleInput.files = [{ name: "stale.jpg", mimeType: "image/jpeg", buffer: Buffer.from("stale") }];
  const { page } = createFakePage({ inputs: [staleInput] });

  await assert.rejects(
    uploadPhotos(page, [], {
      maxPhotos: 3,
      strict: true,
      fetchPhoto: successfulFetch,
    }),
    /送信直前の写真枚数が一致しません（指定0枚 \/ 選択1枚）/,
  );
});

for (const count of [1, 2, 3]) {
  test(`multiple対応の入力欄へ指定${count}枚を過不足なく設定する`, async () => {
    const { page } = createFakePage({ inputs: [createInput(true)] });

    const uploaded = await uploadPhotos(page, photoUrls.slice(0, count), {
      maxPhotos: 3,
      strict: true,
      fetchPhoto: successfulFetch,
    });

    assert.equal(uploaded, count);
  });

  test(`指定${count}枚がページ側処理で消えた場合は投稿前に中断する`, async () => {
    const { page } = createFakePage({
      inputs: [createInput(true)],
      clearFilesOnSettle: true,
    });

    await assert.rejects(
      uploadPhotos(page, photoUrls.slice(0, count), {
        maxPhotos: 3,
        strict: true,
        fetchPhoto: successfulFetch,
      }),
      new RegExp(`送信直前の写真枚数が一致しません（指定${count}枚 \\/ 選択0枚）`),
    );
  });
}

test("送信直前の写真枚数を取得できなければ安全側で中断する", async () => {
  const { page } = createFakePage({
    inputs: [createInput(true)],
    failFinalInspection: true,
  });

  await assert.rejects(
    uploadPhotos(page, [photoUrls[0]], {
      maxPhotos: 3,
      strict: true,
      fetchPhoto: successfulFetch,
    }),
    /送信直前の写真枚数を確認できません/,
  );
});

test("multiple対応の入力欄1個へ3枚をまとめて設定する", async () => {
  const { calls, page } = createFakePage({ inputs: [createInput(true)] });

  const uploaded = await uploadPhotos(page, photoUrls, {
    maxPhotos: 3,
    strict: true,
    fetchPhoto: successfulFetch,
  });

  assert.equal(uploaded, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].inputIndex, 0);
  assert.deepEqual(calls[0].files.map((file) => file.name), [
    "photo-1.jpg",
    "photo-2.jpg",
    "photo-3.jpg",
  ]);
});

test("固定のsingle入力欄3個へ1枚ずつ設定する", async () => {
  const { calls, page } = createFakePage({
    inputs: [createInput(), createInput(), createInput()],
  });

  const uploaded = await uploadPhotos(page, photoUrls, {
    maxPhotos: 3,
    strict: true,
    fetchPhoto: successfulFetch,
  });

  assert.equal(uploaded, 3);
  assert.deepEqual(calls.map((call) => call.inputIndex), [0, 1, 2]);
  assert.deepEqual(calls.map((call) => call.files.map((file) => file.name)), [
    ["photo-1.jpg"],
    ["photo-2.jpg"],
    ["photo-3.jpg"],
  ]);
});

test("画像選択後に追加されるsingle入力欄も順番に使用する", async () => {
  const { calls, inputs, page } = createFakePage({
    inputs: [createInput()],
    addInputAfterSelection: true,
  });

  const uploaded = await uploadPhotos(page, photoUrls, {
    maxPhotos: 3,
    strict: true,
    fetchPhoto: successfulFetch,
  });

  assert.equal(uploaded, 3);
  assert.equal(inputs.length, 3);
  assert.deepEqual(calls.map((call) => call.inputIndex), [0, 1, 2]);
});

test("3枚設定後に写真欄へ1枚しか残らなければ投稿前に中断する", async () => {
  const { page } = createFakePage({
    inputs: [createInput(true)],
    retainedFilesPerInput: 1,
  });

  await assert.rejects(
    uploadPhotos(page, photoUrls, {
      maxPhotos: 3,
      strict: true,
      fetchPhoto: successfulFetch,
    }),
    /送信直前の写真枚数が一致しません（指定3枚 \/ 選択1枚）/,
  );
});

test("strict時は画像取得失敗を対象の枚数付きで通知して設定を中断する", async () => {
  const { calls, page } = createFakePage({ inputs: [createInput(true)] });
  const fetchWithFailure = (async (input: RequestInfo | URL) => {
    if (String(input).includes("photo-2.jpg")) {
      return new Response("failed", { status: 500 });
    }
    return imageResponse();
  }) as typeof fetch;

  await assert.rejects(
    uploadPhotos(page, photoUrls, {
      maxPhotos: 3,
      strict: true,
      fetchPhoto: fetchWithFailure,
    }),
    /2枚目: 写真取得HTTP 500/,
  );

  assert.equal(calls.length, 0);
});

test("WebP画像は拡張子とMIMEタイプを一致させる", async () => {
  const { calls, page } = createFakePage({ inputs: [createInput(true)] });
  const webpFetch = (async () => imageResponse("image/webp")) as typeof fetch;

  const uploaded = await uploadPhotos(page, [photoUrls[0]], {
    strict: true,
    fetchPhoto: webpFetch,
  });

  assert.equal(uploaded, 1);
  assert.equal(calls[0].files[0].name, "photo-1.webp");
  assert.equal(calls[0].files[0].mimeType, "image/webp");
});

test("strictでなければ取得できた画像だけをmultiple入力欄へ設定する", async () => {
  const { calls, page } = createFakePage({ inputs: [createInput(true)] });
  const fetchWithFailure = (async (input: RequestInfo | URL) => {
    if (String(input).includes("photo-2.jpg")) {
      return new Response("failed", { status: 404 });
    }
    return imageResponse();
  }) as typeof fetch;

  const uploaded = await uploadPhotos(page, photoUrls, {
    maxPhotos: 3,
    strict: false,
    fetchPhoto: fetchWithFailure,
  });

  assert.equal(uploaded, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].files.map((file) => file.name), [
    "photo-1.jpg",
    "photo-3.jpg",
  ]);
});
