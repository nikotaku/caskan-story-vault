const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;

const ALLOWED_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

const loadHtmlImage = (file: File) => new Promise<DecodedImage>((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => undefined,
    });
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("この画像を読み込めませんでした。カメラで撮り直してください"));
  };
  image.src = objectUrl;
});

const decodeImage = async (file: File): Promise<DecodedImage> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Safariなどで未対応の場合はHTMLImageElementへ切り替える。
    }
  }
  return loadHtmlImage(file);
};

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error("画像を変換できませんでした"));
      return;
    }
    resolve(blob);
  }, "image/jpeg", quality);
});

export async function prepareCleaningReportImage(file: File): Promise<File> {
  if (!file || file.size === 0) throw new Error("空の画像は選択できません");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("画像は20MB以内にしてください");
  if (file.type && !ALLOWED_SOURCE_TYPES.has(file.type)) {
    throw new Error("JPEG・PNG・WebP・HEIC画像を選択してください");
  }

  const image = await decodeImage(file);
  try {
    if (image.width <= 0 || image.height <= 0) throw new Error("画像サイズを確認できませんでした");

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像の変換機能を利用できません");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);

    let blob = await canvasToJpeg(canvas, 0.82);
    if (blob.size > MAX_OUTPUT_BYTES) blob = await canvasToJpeg(canvas, 0.7);
    if (blob.size > MAX_OUTPUT_BYTES) blob = await canvasToJpeg(canvas, 0.58);
    if (blob.size > MAX_OUTPUT_BYTES) throw new Error("画像を3MB以下にできませんでした。別の写真を選択してください");

    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "cleaning";
    return new File([blob], `${baseName}-cleaning.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    image.dispose();
  }
}
