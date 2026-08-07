import {
  enqueueEstamaDiaryJob,
  getAdminClient,
  processAvailableJobs,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = {
  method?: string;
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
    const accessToken = stringValue(req.body?.accessToken);
    const target = stringValue(req.body?.target);
    if (!postId || !accessToken) throw new Error("投稿IDとポータルトークンが必要です");
    if (!['o2', 'esutama'].includes(target)) throw new Error("送信先が正しくありません");

    const admin = getAdminClient();
    const { data: post, error } = await admin.from("cast_posts")
      .select("id,cast_id,store_id,o2_status,esutama_status")
      .eq("id", postId)
      .maybeSingle();
    if (error) throw error;
    const { data: cast } = post
      ? await admin.from("casts").select("access_token").eq("id", post.cast_id).maybeSingle()
      : { data: null };
    if (!post || cast?.access_token !== accessToken) {
      res.status(401).json({ error: "ポータルの認証情報が正しくありません" });
      return;
    }
    if (target === "o2") {
      if (post.o2_status === "posted") {
        res.status(200).json({ status: "posted", skipped: true });
        return;
      }
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://imrxzkivwrkqbhqfbbes.supabase.co";
      if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY がVercelに設定されていません");
      const response = await fetch(`${baseUrl}/functions/v1/post-to-sites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({ post_id: post.id, access_token: accessToken }),
        signal: AbortSignal.timeout(60_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.status(response.status).json(payload);
        return;
      }
      res.status(200).json({ status: payload?.results?.o2?.status || "posted", result: payload });
      return;
    }

    if (post.esutama_status === "posted") {
      res.status(200).json({ status: "posted", skipped: true });
      return;
    }

    const jobId = await enqueueEstamaDiaryJob(admin, post.store_id, post.cast_id, post.id);
    const results = await processAvailableJobs(admin, {
      storeId: post.store_id,
      castId: post.cast_id,
      jobId,
      limit: 1,
    });
    const result = results[0];
    res.status(200).json({ jobId, status: result?.status || "queued", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(/認証|トークン/.test(message) ? 401 : 400).json({ error: message });
  }
}

