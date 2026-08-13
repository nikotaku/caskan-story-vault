const GUIDE_PATH = "/therapist-option-sales-guide.png?v=20260813";
const GUIDE_FILE_NAME = "追加オプション入力マニュアル.png";

export type ReceptionEndShareResult =
  | { status: "shared" }
  | { status: "cancelled" }
  | { status: "fallback"; urlCopied: boolean };

export async function loadReceptionEndGuide(signal?: AbortSignal): Promise<File> {
  const response = await fetch(GUIDE_PATH, { signal });
  if (!response.ok) {
    throw new Error("追加オプション入力マニュアルを読み込めませんでした");
  }

  const blob = await response.blob();
  return new File([blob], GUIDE_FILE_NAME, { type: "image/png" });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function downloadGuide(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function shareReceptionEndContent(
  portalUrl: string,
  guideFile: File,
): Promise<ReceptionEndShareResult> {
  const files = [guideFile];

  if (
    typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files })
  ) {
    try {
      // 共有内容は、担当セラピストのポータルURLと画像マニュアルの2点だけ。
      await navigator.share({ text: portalUrl, files });
      return { status: "shared" };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { status: "cancelled" };
      }
      console.warn("共有画面を開けませんでした。代替処理へ切り替えます:", error);
    }
  }

  const urlCopied = await copyText(portalUrl);
  downloadGuide(guideFile);
  return { status: "fallback", urlCopied };
}
