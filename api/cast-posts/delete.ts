import {
  authenticateUser,
  getAdminClient,
} from "../../server/estama-automation.js";
import { castPostImagePaths } from "../../server/cast-post-image-paths.js";

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

const removeStoredImages = async (paths: string[]) => {
  if (!paths.length) return true;
  try {
    const service = getAdminClient();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await service.storage.from("cast-photos").remove(paths);
      if (!error) return true;
    }
  } catch {
    return false;
  }
  return false;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const postId = stringValue(req.body?.postId);
  try {
    if (!postId) throw new Error("投稿IDが必要です");

    const { admin } = await authenticateUser(req);
    const { data: deletedRows, error: deleteError } = await admin.rpc(
      "delete_admin_failed_cast_post_with_assets",
      { p_post_id: postId },
    );
    const deleted = Array.isArray(deletedRows) ? deletedRows[0] : null;
    if (deleteError || !deleted) {
      throw new Error(deleteError?.message || "投稿を削除できませんでした");
    }

    const supabaseUrl = process.env.SUPABASE_URL
      || process.env.VITE_SUPABASE_URL
      || "https://imrxzkivwrkqbhqfbbes.supabase.co";
    const service = getAdminClient();
    const returnedUrls = Array.isArray(deleted.image_urls)
      ? deleted.image_urls.filter((value): value is string => typeof value === "string")
      : [];
    let safeUrls = returnedUrls;
    if (returnedUrls.length) {
      const { data: references, error: referenceError } = await service
        .from("cast_posts")
        .select("image_urls")
        .overlaps("image_urls", returnedUrls);
      if (referenceError) {
        safeUrls = [];
      } else {
        const referenced = new Set((references || []).flatMap((row) => row.image_urls || []));
        safeUrls = returnedUrls.filter((url) => !referenced.has(url));
      }
    }
    const imagePaths = castPostImagePaths(
      safeUrls,
      supabaseUrl,
      deleted.store_id,
      deleted.cast_id,
    );

    const imagesRemoved = await removeStoredImages(imagePaths);
    if (!imagesRemoved) {
      console.warn(JSON.stringify({
        level: "warn",
        msg: "cast_post_image_cleanup_failed",
        postId,
        imageCount: imagePaths.length,
      }));
    }
    res.status(200).json({
      deleted: true,
      removedImageCount: imagesRemoved ? imagePaths.length : 0,
      imageCleanupFailed: !imagesRemoved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /認証|ログイン|権限/.test(message)
      ? 401
      : /送信処理中|掲載有無/.test(message)
        ? 409
        : 400;
    res.status(status).json({ error: message });
  }
}
