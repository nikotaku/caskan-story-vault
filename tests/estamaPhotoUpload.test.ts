import assert from "node:assert/strict";
import test from "node:test";

import type { Page } from "playwright-core";

import { uploadPhotos } from "../server/estama-photo-upload.ts";

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
  maxDynamicInputs = 3,
}: {
  inputs: FakeInput[];
  addInputAfterSelection?: boolean;
  maxDynamicInputs?: number;
}) => {
  const inputs = [...initialInputs];
  const calls: SetInputFilesCall[] = [];

  const inputCollection = () => ({
    async count() {
      return inputs.length;
    },
    async evaluateAll(callback: (elements: Element[]) => unknown) {
      return callback(inputs as unknown as Element[]);
    },
    nth(index: number) {
      return {
        async setInputFiles(value: UploadedFile | UploadedFile[]) {
          const files = Array.isArray(value) ? value : [value];
          inputs[index].files = files;
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
      // Unit tests do not have asynchronous browser uploads.
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
