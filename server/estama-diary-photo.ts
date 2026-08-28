import type { Locator, Page } from "playwright-core";

export type EstamaDiaryPhotoState = {
  selectedFiles: number;
  photoDataLength: number;
  photoDataIsImage: boolean;
  previewHasSource: boolean;
  previewVisible: boolean;
  previewComplete: boolean;
  previewWidth: number;
  previewHeight: number;
};

type CropState = {
  containerCount: number;
  cropBoxReady: boolean;
  imageReady: boolean;
};

type CompleteCropOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

const sleep = (page: Page, milliseconds: number) => page.waitForTimeout(milliseconds);

export async function inspectEstamaDiaryPhotoState(form: Locator): Promise<EstamaDiaryPhotoState> {
  return form.evaluate((element) => {
    const input = element.querySelector<HTMLInputElement>('input[type="file"]#photo-input');
    const photoData = element.querySelector<HTMLInputElement>('input[type="hidden"]#photo_data');
    const preview = element.querySelector<HTMLImageElement>('img#photo-preview');
    const rawPhotoData = photoData?.value.trim() || "";
    const rawPreviewSource = preview?.getAttribute("src")?.trim() || "";
    const selectedFiles = Array.from(input?.files || []).filter((file) => file.size > 0
      && (file.type.startsWith("image/") || /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file.name))).length;
    return {
      selectedFiles,
      photoDataLength: rawPhotoData.length,
      photoDataIsImage: /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i.test(rawPhotoData),
      previewHasSource: Boolean(rawPreviewSource),
      previewVisible: Boolean(preview && preview.getClientRects().length > 0),
      previewComplete: Boolean(preview?.complete),
      previewWidth: preview?.naturalWidth || 0,
      previewHeight: preview?.naturalHeight || 0,
    };
  });
}

export function isEstamaDiaryPhotoReady(state: EstamaDiaryPhotoState) {
  return state.photoDataLength > 0
    && state.photoDataIsImage
    && state.previewHasSource
    && state.previewVisible
    && state.previewComplete
    && state.previewWidth === 600
    && state.previewHeight === 600;
}

const safeStateForLog = (state: EstamaDiaryPhotoState) => ({
  selectedFiles: state.selectedFiles,
  photoDataLength: state.photoDataLength,
  photoDataIsImage: state.photoDataIsImage,
  previewHasSource: state.previewHasSource,
  previewVisible: state.previewVisible,
  previewComplete: state.previewComplete,
  previewWidth: state.previewWidth,
  previewHeight: state.previewHeight,
});

async function inspectCropState(page: Page): Promise<CropState> {
  const containers = page.locator(".cropper-container:visible");
  const state = await containers.evaluateAll((elements) => {
    const visible = elements.filter((element) => element.getClientRects().length > 0);
    const cropBox = visible[0]?.querySelector<HTMLElement>(".cropper-crop-box");
    const image = visible[0]?.querySelector<HTMLImageElement>(".cropper-canvas img, img");
    const rect = cropBox?.getBoundingClientRect();
    return {
      containerCount: visible.length,
      cropBoxReady: Boolean(rect && rect.width > 0 && rect.height > 0),
      imageReady: Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
    };
  });
  return state;
}

async function waitForCropReady(page: Page, timeoutMs: number, pollIntervalMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastState: CropState = { containerCount: 0, cropBoxReady: false, imageReady: false };
  let shouldContinue = true;
  while (shouldContinue) {
    lastState = await inspectCropState(page);
    if (lastState.containerCount === 1 && lastState.cropBoxReady && lastState.imageReady) return lastState;
    shouldContinue = Date.now() < deadline;
    if (shouldContinue) await sleep(page, pollIntervalMs);
  }
  throw new Error(`魂セラピストの画像切り取り画面を準備できません（表示${lastState.containerCount}件）`);
}

export async function assertEstamaDiaryPhotoReady(form: Locator) {
  const state = await inspectEstamaDiaryPhotoState(form);
  console.log(JSON.stringify({ event: "estama_diary_photo_ready", ...safeStateForLog(state) }));
  if (!isEstamaDiaryPhotoReady(state)) {
    throw new Error("魂セラピストの送信用画像を準備できません");
  }
  return state;
}

export async function completeEstamaDiaryPhotoCrop(
  page: Page,
  form: Locator,
  options: CompleteCropOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const initial = await inspectEstamaDiaryPhotoState(form);
  if (isEstamaDiaryPhotoReady(initial)) return initial;
  if (initial.selectedFiles !== 1) {
    throw new Error(`魂セラピストの切り取り対象画像が一致しません（指定1枚 / 選択${initial.selectedFiles}枚）`);
  }

  await waitForCropReady(page, timeoutMs, pollIntervalMs);
  const done = page.locator('button#crop-done-btn[type="button"]:visible');
  const doneCount = await done.count();
  if (doneCount !== 1) {
    throw new Error(`魂セラピストの画像切り取り完了ボタンを特定できません（${doneCount}件）`);
  }
  const control = await done.evaluate((element) => ({
    tag: element.tagName,
    id: element.id,
    type: element instanceof HTMLButtonElement ? element.type : "",
    text: (element.textContent || "").replace(/\s+/g, " ").trim(),
  }));
  if (control.tag !== "BUTTON" || control.id !== "crop-done-btn" || control.type !== "button" || control.text !== "完了") {
    throw new Error("魂セラピストの画像切り取り完了ボタンが想定と異なります");
  }
  await done.click({ timeout: timeoutMs });

  const deadline = Date.now() + timeoutMs;
  let finalState = await inspectEstamaDiaryPhotoState(form);
  let shouldContinue = true;
  while (shouldContinue) {
    const cropperVisible = await page.locator(".cropper-container:visible").count();
    if (cropperVisible === 0 && isEstamaDiaryPhotoReady(finalState)) break;
    shouldContinue = Date.now() < deadline;
    if (!shouldContinue) {
      console.log(JSON.stringify({
        event: "estama_diary_photo_crop_incomplete",
        cropperVisible,
        ...safeStateForLog(finalState),
      }));
      throw new Error("魂セラピストの画像切り取りを完了できません");
    }
    await sleep(page, pollIntervalMs);
    finalState = await inspectEstamaDiaryPhotoState(form);
  }

  console.log(JSON.stringify({ event: "estama_diary_photo_crop_completed", ...safeStateForLog(finalState) }));
  return finalState;
}
