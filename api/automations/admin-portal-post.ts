import {
  assertStoreManager,
  authenticateUser,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

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

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const postId = stringValue(req.body?.postId);
    const target = stringValue(req.body?.target);
    if (!postId) throw new Error("投稿IDが必要です");
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
      msg: "admin_portal_post_failed",
      postId: stringValue(req.body?.postId),
      target: stringValue(req.body?.target),
      error: message,
    }));
    res.status(/認証|ログイン|権限/.test(message) ? 401 : 400).json({ error: message });
  }
}

