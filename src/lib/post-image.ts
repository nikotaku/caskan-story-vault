export const POST_IMAGE_SIZE = 600;
export const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const POST_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type SquareCrop = {
  sourceX: number;
  sourceY: number;
  sourceSize: number;
};

export const getCenteredSquareCrop = (width: number, height: number): SquareCrop => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("画像の縦横サイズを確認できません");
  }
  const sourceSize = Math.min(width, height);
  return {
    sourceX: (width - sourceSize) / 2,
    sourceY: (height - sourceSize) / 2,
    sourceSize,
  };
};

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
    reject(new Error("画像を読み込めませんでした"));
  };
  image.src = objectUrl;
});

const decodeImage = async (file: File): Promise<DecodedImage> => {
  if (typeof createImageBitmap === "function") {
    try {
      // iPhone写真などのEXIF回転を適用してから、表示どおりの向きで切り抜く。
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // createImageBitmap未対応の画像はHTMLImageElementで読み込む。
    }
  }
  return loadHtmlImage(file);
};

const canvasToJpeg = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error("画像を600×600へ変換できませんでした"));
      return;
    }
    resolve(blob);
  }, "image/jpeg", 0.92);
});

export async function prepareSquarePostImage(file: File): Promise<File> {
  if (!POST_IMAGE_ALLOWED_TYPES.has(file.type)) {
    throw new Error("画像はJPEG・PNG・WebPのみ対応しています。HEICは投稿先が非対応です");
  }
  if (file.size > POST_IMAGE_MAX_BYTES) {
    throw new Error("画像は10MB以内にしてください");
  }
  if (file.size === 0) throw new Error("空の画像ファイルは選択できません");

  const image = await decodeImage(file);
  try {
    const crop = getCenteredSquareCrop(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = POST_IMAGE_SIZE;
    canvas.height = POST_IMAGE_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像の変換機能を利用できません");

    // PNGの透明部分が黒くならないよう、JPEG化する前に白で埋める。
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, POST_IMAGE_SIZE, POST_IMAGE_SIZE);
    context.drawImage(
      image.source,
      crop.sourceX,
      crop.sourceY,
      crop.sourceSize,
      crop.sourceSize,
      0,
      0,
      POST_IMAGE_SIZE,
      POST_IMAGE_SIZE,
    );

    const blob = await canvasToJpeg(canvas);
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "post-image";
    return new File([blob], `${baseName}-600x600.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    image.dispose();
  }
}
