import type { Locator, Page } from "playwright-core";

type PhotoFile = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

type PreparedPhoto = {
  index: number;
  file: PhotoFile;
};

type UploadPhotoOptions = {
  maxPhotos?: number;
  strict?: boolean;
  root?: Locator;
  fetchPhoto?: typeof fetch;
};

function normalizePhotoUrl(raw: string) {
  const value = raw.trim();
  const driveId = value.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|thumbnail\?id=)([\w-]+)/)?.[1]
    || value.match(/[?&]id=([\w-]+)/)?.[1]
    || (/^[\w-]{10,}$/.test(value) ? value : null);
  const normalized = driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : value;
  const url = new URL(normalized);
  if (url.protocol !== "https:") throw new Error("写真URLはHTTPSのみ利用できます");
  const supabaseHost = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const allowedHosts = new Set([
    "drive.google.com", "storage.googleapis.com", "img.estama.jp", "cdn2-caskan.com",
    ...(supabaseHost ? [new URL(supabaseHost).hostname] : []),
  ]);
  if (!allowedHosts.has(url.hostname) && !url.hostname.endsWith(".supabase.co")) {
    throw new Error(`未許可の写真ホストです: ${url.hostname}`);
  }
  return url.toString();
}

function photoExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

export function assertUploadedPhotoCount(requested: number, uploaded: number) {
  if (!Number.isInteger(requested) || !Number.isInteger(uploaded) || requested < 0 || uploaded !== requested) {
    throw new Error(`エステ魂の写真枚数が一致しません（指定${requested}枚 / 設定${uploaded}枚）`);
  }
}

export async function assertFormPhotoCount(form: Locator, requested: number) {
  let serialized: number;
  try {
    serialized = await form.evaluate((element) => {
      if (!(element instanceof HTMLFormElement)) throw new Error("投稿フォームではありません");
      const data = new FormData(element);
      return Array.from(data.values()).filter((value) => value instanceof File
        && value.size > 0
        && (value.type.startsWith("image/") || /\.(?:avif|gif|jpe?g|png|webp)$/i.test(value.name))).length;
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`エステ魂の送信フォーム内の写真枚数を確認できません（${detail}）`);
  }
  if (serialized !== requested) {
    throw new Error(`エステ魂の送信フォーム内の写真枚数が一致しません（指定${requested}枚 / 送信${serialized}枚）`);
  }
  return serialized;
}

export async function uploadPhotos(
  page: Page,
  urls: string[],
  options: UploadPhotoOptions = {},
) {
  const {
    maxPhotos = 6,
    strict = false,
    root,
    fetchPhoto = fetch,
  } = options;
  const requestedUrls = urls.slice(0, maxPhotos);

  const inputRoot = root || page;
  const inputs = inputRoot.locator('input[type="file"]');
  const inputInfo = await inputs.evaluateAll((elements) => elements.map((element) => {
    const input = element as HTMLInputElement;
    const accept = String(input.accept || "").toLowerCase();
    const identity = `${input.name || ""} ${input.id || ""}`.toLowerCase();
    const acceptsImages = !accept
      || accept === "*/*"
      || accept.split(",").some((value) => /image\/|\.(?:avif|gif|jpe?g|png|webp)/.test(value.trim()));
    const otherMedia = /(?:^|[_-])(audio|document|movie|pdf|video)(?:$|[_-])/.test(identity);
    return {
      candidate: !input.disabled && acceptsImages && !otherMedia,
      multiple: input.hasAttribute("multiple"),
    };
  }));
  const multipleInputIndex = inputInfo.findIndex((input) => input.candidate && input.multiple);
  const errors: string[] = [];

  const prepared: PreparedPhoto[] = [];
  for (let index = 0; index < requestedUrls.length; index += 1) {
    try {
      const response = await fetchPhoto(normalizePhotoUrl(requestedUrls[index]), {
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`写真取得HTTP ${response.status}`);
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > 15 * 1024 * 1024) throw new Error("写真が15MBを超えています");
      const contentType = response.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) throw new Error("写真URLが画像を返しませんでした");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > 15 * 1024 * 1024) throw new Error("写真が15MBを超えています");
      prepared.push({
        index,
        file: {
          name: `photo-${index + 1}.${photoExtension(contentType)}`,
          mimeType: contentType,
          buffer,
        },
      });
    } catch (error) {
      errors.push(`${index + 1}枚目: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (strict && errors.length) {
    throw new Error(`エステ魂の写真同期に失敗しました（${errors.join(" / ")}）`);
  }

  let uploaded = 0;
  if (multipleInputIndex >= 0 && prepared.length) {
    try {
      await inputs.nth(multipleInputIndex).setInputFiles(prepared.map(({ file }) => file));
      uploaded = prepared.length;
    } catch (error) {
      errors.push(`写真欄への設定: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    for (const photo of prepared) {
      let target: Locator | null = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const currentInputs = inputRoot.locator('input[type="file"]');
        const emptyInputIndex = await currentInputs.evaluateAll((elements) => elements.findIndex((element) => {
          const input = element as HTMLInputElement;
          const accept = String(input.accept || "").toLowerCase();
          const identity = `${input.name || ""} ${input.id || ""}`.toLowerCase();
          const acceptsImages = !accept
            || accept === "*/*"
            || accept.split(",").some((value) => /image\/|\.(?:avif|gif|jpe?g|png|webp)/.test(value.trim()));
          const otherMedia = /(?:^|[_-])(audio|document|movie|pdf|video)(?:$|[_-])/.test(identity);
          return !input.disabled && acceptsImages && !otherMedia
            && !input.multiple && (input.files?.length || 0) === 0;
        }));
        if (emptyInputIndex >= 0) {
          target = currentInputs.nth(emptyInputIndex);
          break;
        }
        await page.waitForTimeout(300);
      }
      if (!target) {
        errors.push(`${photo.index + 1}枚目: 空いている写真入力欄が見つかりません`);
        continue;
      }
      try {
        await target.setInputFiles(photo.file);
        uploaded += 1;
        await page.waitForTimeout(300);
      } catch (error) {
        errors.push(`${photo.index + 1}枚目の写真欄: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (uploaded > 0) {
    // Some Estama forms upload or generate previews in a change handler.  Let that
    // work finish before the caller submits the form, while tolerating pages with
    // long-lived background requests.
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
  }
  const finalInputs = inputRoot.locator('input[type="file"]');
  const inspectSelectedFiles = () => finalInputs.evaluateAll((elements) => elements.reduce((total, element) => {
    const input = element as HTMLInputElement;
    const accept = String(input.accept || "").toLowerCase();
    const identity = `${input.name || ""} ${input.id || ""}`.toLowerCase();
    const acceptsImages = !accept
      || accept === "*/*"
      || accept.split(",").some((value) => /image\/|\.(?:avif|gif|jpe?g|png|webp)/.test(value.trim()));
    const otherMedia = /(?:^|[_-])(audio|document|movie|pdf|video)(?:$|[_-])/.test(identity);
    return !input.disabled && acceptsImages && !otherMedia
      ? total + (input.files?.length || 0)
      : total;
  }, 0)).catch(() => null);
  let selectedFiles: number | null = null;
  let stableChecks = 0;
  const requiredStableChecks = strict ? 3 : 1;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    selectedFiles = await inspectSelectedFiles();
    stableChecks = selectedFiles === requestedUrls.length ? stableChecks + 1 : 0;
    if (stableChecks >= requiredStableChecks) break;
    if (attempt < 4) await page.waitForTimeout(500);
  }

  if (strict) {
    try {
      assertUploadedPhotoCount(requestedUrls.length, uploaded);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    if (selectedFiles === null) {
      errors.push("送信直前の写真枚数を確認できません");
    } else if (selectedFiles !== requestedUrls.length) {
      errors.push(`送信直前の写真枚数が一致しません（指定${requestedUrls.length}枚 / 選択${selectedFiles}枚）`);
    } else if (stableChecks < requiredStableChecks) {
      errors.push(`送信直前の写真枚数が安定しません（指定${requestedUrls.length}枚 / 選択${selectedFiles}枚）`);
    }
  }
  console.log(JSON.stringify({
    event: "estama_photo_upload",
    requested: requestedUrls.length,
    initialInputCount: inputInfo.length,
    finalInputCount: await finalInputs.count(),
    multipleInput: multipleInputIndex >= 0,
    uploaded,
    selectedFiles,
    stableChecks,
    errorCount: errors.length,
  }));

  if (errors.length) {
    console.warn(`Estama photo upload: ${errors.join(" / ")}`);
  }
  if (strict && errors.length) {
    throw new Error(`エステ魂の写真同期に失敗しました（${errors.join(" / ")}）`);
  }
  return uploaded;
}
