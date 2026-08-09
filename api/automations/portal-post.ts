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

    const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://imrxzkivwrkqbhqfbbes.supabase.co";
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
