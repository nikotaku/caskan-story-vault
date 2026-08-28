import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";
import { assertRequiredPostImageSize } from "../../supabase/functions/post-to-sites/image-size.js";

export const config = {
  maxDuration: 60,
  api: { bodyParser: false },
};

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_HEADER_BYTES = 8 * 1024;

type RequestLike = AsyncIterable<Uint8Array | string> & {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type MultipartPart = {
  name: string;
  filename: string | null;
  contentType: string | null;
  data: Buffer;
};

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

const getHeader = (headers: RequestLike["headers"], name: string) => {
  if (!headers) return "";
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : undefined;
  return Array.isArray(value) ? value[0] || "" : value || "";
};

const multipartBoundary = (contentType: string) => {
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "画像付きフォームの形式が正しくありません");
  }
  const match = contentType.match(/(?:^|;)\s*boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = (match?.[1] || match?.[2] || "").trim();
  if (!boundary || boundary.length > 70 || boundary.endsWith(" ")
    || !/^[0-9A-Za-z'()+_,\-./:=? ]+$/.test(boundary)) {
    throw new HttpError(400, "画像付きフォームの境界情報が不正です");
  }
  return boundary;
};

const readRawBody = async (req: RequestLike) => {
  const contentLength = Number(getHeader(req.headers, "content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "画像を含む送信データが大きすぎます");
  }

  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > MAX_REQUEST_BYTES) throw new HttpError(413, "画像を含む送信データが大きすぎます");
    return req.body;
  }
  if (req.body !== undefined && req.body !== null) {
    throw new HttpError(400, "画像付きフォームを読み取れませんでした");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_REQUEST_BYTES) throw new HttpError(413, "画像を含む送信データが大きすぎます");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
};

const parseHeaders = (headerBlock: string) => {
  const headers = new Map<string, string>();
  for (const line of headerBlock.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) throw new HttpError(400, "画像付きフォームのヘッダーが不正です");
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!name || headers.has(name)) throw new HttpError(400, "画像付きフォームのヘッダーが重複しています");
    headers.set(name, value);
  }
  return headers;
};

const parseMultipart = (body: Buffer, boundary: string): MultipartPart[] => {
  const delimiter = Buffer.from(`--${boundary}`);
  const separator = Buffer.from(`\r\n--${boundary}`);
  const headerEndMarker = Buffer.from("\r\n\r\n");
  if (!body.subarray(0, delimiter.length).equals(delimiter)) {
    throw new HttpError(400, "画像付きフォームの開始位置が不正です");
  }

  const parts: MultipartPart[] = [];
  let cursor = delimiter.length;
  while (true) {
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from("--"))) {
      cursor += 2;
      if (cursor === body.length) break;
      if (body.subarray(cursor, cursor + 2).equals(Buffer.from("\r\n")) && cursor + 2 === body.length) break;
      throw new HttpError(400, "画像付きフォームの終了位置が不正です");
    }
    if (!body.subarray(cursor, cursor + 2).equals(Buffer.from("\r\n"))) {
      throw new HttpError(400, "画像付きフォームの区切りが不正です");
    }
    cursor += 2;

    const headerEnd = body.indexOf(headerEndMarker, cursor);
    if (headerEnd < 0 || headerEnd - cursor > MAX_HEADER_BYTES) {
      throw new HttpError(400, "画像付きフォームのヘッダーが不正です");
    }
    const headers = parseHeaders(body.toString("latin1", cursor, headerEnd));
    const disposition = headers.get("content-disposition") || "";
    if (!/^form-data(?:;|$)/i.test(disposition)) {
      throw new HttpError(400, "画像付きフォームの項目情報が不正です");
    }
    const name = disposition.match(/(?:^|;)\s*name="([^"\r\n]{1,64})"/i)?.[1] || "";
    const filenameMatch = disposition.match(/(?:^|;)\s*filename="([^"\r\n]{1,255})"/i);
    if (!name) throw new HttpError(400, "画像付きフォームの項目名が不正です");

    const dataStart = headerEnd + headerEndMarker.length;
    const nextDelimiter = body.indexOf(separator, dataStart);
    if (nextDelimiter < 0) throw new HttpError(400, "画像付きフォームが途中で切れています");
    parts.push({
      name,
      filename: filenameMatch?.[1] || null,
      contentType: headers.get("content-type") || null,
      data: body.subarray(dataStart, nextDelimiter),
    });
    cursor = nextDelimiter + 2 + delimiter.length;
  }
  return parts;
};

const onlyPart = (parts: MultipartPart[], name: string) => {
  const matches = parts.filter((part) => part.name === name);
  if (matches.length !== 1) throw new HttpError(400, `${name}は1件だけ送信してください`);
  return matches[0];
};

const textPart = (part: MultipartPart, maxBytes: number) => {
  if (part.filename || part.contentType || part.data.length > maxBytes) {
    throw new HttpError(400, `${part.name}の形式が正しくありません`);
  }
  try {
    const value = new TextDecoder("utf-8", { fatal: true }).decode(part.data);
    if (value.includes("\u0000")) throw new Error("null byte");
    return value;
  } catch {
    throw new HttpError(400, `${part.name}の文字コードが正しくありません`);
  }
};

const adminClient = () => {
  const url = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || "https://imrxzkivwrkqbhqfbbes.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new HttpError(500, "投稿機能のサーバー設定が不足しています");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

const cleanupUploadedImage = async (admin: ReturnType<typeof adminClient>, path: string) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await admin.storage.from("cast-photos").remove([path]);
    if (!error) return true;
  }
  return false;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let uploadedPath: string | null = null;
  let admin: ReturnType<typeof adminClient> | null = null;
  try {
    const boundary = multipartBoundary(getHeader(req.headers, "content-type"));
    const rawBody = await readRawBody(req);
    const parts = parseMultipart(rawBody, boundary);
    const allowedNames = new Set(["token", "title", "body", "image"]);
    if (parts.length !== 4 || parts.some((part) => !allowedNames.has(part.name))) {
      throw new HttpError(400, "投稿フォームには画像を1枚だけ指定してください");
    }

    const token = textPart(onlyPart(parts, "token"), 512).trim();
    const title = textPart(onlyPart(parts, "title"), 1024).trim();
    const postBody = textPart(onlyPart(parts, "body"), 20_000).trim();
    const image = onlyPart(parts, "image");
    if (!token || token.length > 256) throw new HttpError(401, "ポータルトークンが無効です");
    if (!postBody) throw new HttpError(400, "本文を入力してください");
    if (title.length > 120 || postBody.length > 5000) {
      throw new HttpError(400, "タイトル120文字、本文5000文字以内で入力してください");
    }
    if (!image.filename || image.contentType?.toLowerCase() !== "image/jpeg") {
      throw new HttpError(415, "600×600のJPEG画像を1枚送信してください");
    }
    if (!image.data.length || image.data.length > MAX_IMAGE_BYTES) {
      throw new HttpError(413, "600×600のJPEG画像は1.5MB以内にしてください");
    }
    try {
      assertRequiredPostImageSize(new Uint8Array(image.data), image.contentType);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "画像を確認できませんでした");
    }

    admin = adminClient();
    const { data: cast, error: castError } = await admin.from("casts")
      .select("id,store_id,is_active")
      .eq("access_token", token)
      .eq("is_active", true)
      .maybeSingle();
    if (castError) throw new HttpError(500, "セラピスト情報を確認できませんでした");
    if (!cast?.id || !cast.store_id) throw new HttpError(401, "無効またはアーカイブ済みのリンクです");

    uploadedPath = `posts/${cast.id}/${randomUUID()}-600x600.jpg`;
    const { error: uploadError } = await admin.storage.from("cast-photos").upload(uploadedPath, image.data, {
      cacheControl: "3600",
      contentType: "image/jpeg",
      upsert: false,
    });
    if (uploadError) throw new HttpError(500, "画像をアップロードできませんでした");
    const imageUrl = admin.storage.from("cast-photos").getPublicUrl(uploadedPath).data.publicUrl;

    const { data: postId, error: postError } = await admin.rpc("create_therapist_post", {
      p_token: token,
      p_title: title || null,
      p_body: postBody,
      p_image_urls: [imageUrl],
    });
    if (postError || typeof postId !== "string") {
      throw new HttpError(500, "投稿を作成できませんでした");
    }

    uploadedPath = null;
    res.status(200).json({ postId });
  } catch (error) {
    let cleanupFailed = false;
    if (uploadedPath && admin) {
      const cleaned = await cleanupUploadedImage(admin, uploadedPath);
      cleanupFailed = !cleaned;
      if (cleanupFailed) console.error(JSON.stringify({ level: "error", msg: "therapist_post_image_cleanup_failed", path: uploadedPath }));
    }
    const status = error instanceof HttpError ? error.status : 500;
    const baseMessage = error instanceof Error ? error.message : "投稿を作成できませんでした";
    const message = cleanupFailed ? `${baseMessage}。途中画像の削除にも失敗しました` : baseMessage;
    console.warn(JSON.stringify({ level: "warn", msg: "therapist_post_create_failed", status, error: message }));
    res.status(status).json({ error: message });
  }
}
