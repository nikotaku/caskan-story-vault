import {
  assertStoreManager,
  authenticateUser,
  getAdminClient,
} from "../../server/estama-automation.js";
import { castPostImagePaths } from "../../server/cast-post-image-paths.js";

export const config = { maxDuration: 300 };

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
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

const deleteFailedPost = async (req: RequestLike, postId: string) => {
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
  return {
    deleted: true,
    removedImageCount: imagesRemoved ? imagePaths.length : 0,
    imageCleanupFailed: !imagesRemoved,
  };
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const queryAction = Array.isArray(req.query?.action) ? req.query?.action[0] : req.query?.action;
  const action = stringValue(req.body?.action) || stringValue(queryAction);
  try {
    const postId = stringValue(req.body?.postId);
    if (!postId) throw new Error("投稿IDが必要です");
    if (action === "delete-failed-post") {
      res.status(200).json(await deleteFailedPost(req, postId));
      return;
    }

    const target = stringValue(req.body?.target);
    if (!["o2", "esutama"].includes(target)) throw new Error("送信先が正しくありません");

    const { admin, user } = await authenticateUser(req);
    const { data: post, error } = await admin.from("cast_posts")
      .select("id,cast_id,store_id,o2_status,esutama_status")
      .eq("id", postId)
      .maybeSingle();
    if (error) throw error;
    if (!post) {
      res.status(404).json({ error: "投稿が見つかりません" });
      return;
    }
    await assertStoreManager(admin, user.id, post.store_id);

    const currentStatus = target === "o2" ? post.o2_status : post.esutama_status;
    if (currentStatus === "posted") {
      res.status(200).json({ status: "posted", skipped: true });
      return;
    }

    const { data: castToken, error: tokenError } = await admin.from("cast_access_tokens")
      .select("access_token")
      .eq("cast_id", post.cast_id)
      .maybeSingle();
    if (tokenError) throw tokenError;
    const accessToken = stringValue(castToken?.access_token);
    if (!accessToken) throw new Error("セラピストの投稿トークンがありません");

    const baseUrl = process.env.SUPABASE_URL
      || process.env.VITE_SUPABASE_URL
      || "https://imrxzkivwrkqbhqfbbes.supabase.co";
    const response = await fetch(`${baseUrl}/functions/v1/post-to-sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, access_token: accessToken, target }),
      signal: AbortSignal.timeout(target === "esutama" ? 300_000 : 60_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(response.status).json(payload);
      return;
    }
    const status = target === "o2" ? payload?.results?.o2?.status : payload?.status;
    res.status(200).json({ status: status || "posted", result: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(JSON.stringify({
      level: "warn",
      msg: action === "delete-failed-post" ? "admin_post_delete_failed" : "admin_portal_post_failed",
      postId: stringValue(req.body?.postId),
      target: stringValue(req.body?.target),
      error: message,
    }));
    const status = /認証|ログイン|権限/.test(message)
      ? 401
      : action === "delete-failed-post" && /送信処理中|掲載有無/.test(message)
        ? 409
        : 400;
    res.status(status).json({ error: message });
  }
}
