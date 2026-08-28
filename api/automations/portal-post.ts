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
    const action = stringValue(req.body?.action);
    const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://imrxzkivwrkqbhqfbbes.supabase.co";
    if (action === "create-therapist-post") {
      const accessToken = stringValue(req.body?.accessToken);
      const title = typeof req.body?.title === "string" ? req.body.title : "";
      const postBody = typeof req.body?.postBody === "string" ? req.body.postBody : "";
      const imageBase64 = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
      if (!accessToken || !postBody.trim() || !imageBase64) {
        throw new Error("投稿本文と600×600の画像1枚が必要です");
      }
      if (accessToken.length > 256 || title.length > 120 || postBody.length > 5000 || imageBase64.length > 2_000_000) {
        throw new Error("投稿データが上限を超えています");
      }
      const response = await fetch(`${baseUrl}/functions/v1/post-to-sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          access_token: accessToken,
          title,
          post_body: postBody,
          image_base64: imageBase64,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      res.status(response.status).json(payload);
      return;
    }

    const postId = stringValue(req.body?.postId);
    const accessToken = stringValue(req.body?.accessToken);
    const target = stringValue(req.body?.target);
    if (!postId || !accessToken) throw new Error("投稿IDとポータルトークンが必要です");
    if (!['o2', 'esutama'].includes(target)) throw new Error("送信先が正しくありません");

    const response = await fetch(`${baseUrl}/functions/v1/post-to-sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, access_token: accessToken, target }),
      signal: AbortSignal.timeout(target === "o2" ? 60_000 : 290_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      res.status(response.status).json(payload);
      return;
    }
    const results = payload.results && typeof payload.results === "object"
      ? payload.results as Record<string, unknown>
      : {};
    const o2 = results.o2 && typeof results.o2 === "object"
      ? results.o2 as Record<string, unknown>
      : {};
    const status = target === "o2" ? o2.status : payload.status;
    res.status(200).json({ ...payload, status: status || "posted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(/認証|トークン/.test(message) ? 401 : 400).json({ error: message });
  }
}
