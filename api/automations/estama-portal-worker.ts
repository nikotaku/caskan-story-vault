import {
  LoginRequiredError,
  runPreparedEstamaDiary,
  SoulActivationRequiredError,
  type PreparedEstamaDiary,
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
    const jobId = stringValue(req.body?.jobId);
    const workerToken = stringValue(req.body?.workerToken);
    if (!jobId || !workerToken) throw new Error("実行トークンがありません");

    const baseUrl = process.env.SUPABASE_URL
      || process.env.VITE_SUPABASE_URL
      || "https://imrxzkivwrkqbhqfbbes.supabase.co";
    const response = await fetch(`${baseUrl}/functions/v1/post-to-sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim-estama-worker", job_id: jobId, worker_token: workerToken }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      res.status(response.status).json({ error: typeof payload.error === "string" ? payload.error : "実行認証に失敗しました" });
      return;
    }

    const prepared = payload.work as PreparedEstamaDiary | undefined;
    if (!prepared?.browserbaseContextId || !prepared.cast?.name || !prepared.post?.body) {
      throw new Error("魂セラピスト投稿データが不足しています");
    }
    const result = await runPreparedEstamaDiary(prepared);
    res.status(200).json({ status: "posted", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const activationRequired = error instanceof SoulActivationRequiredError;
    res.status(error instanceof LoginRequiredError || activationRequired ? 409 : 422).json({
      error: message,
      loginRequired: error instanceof LoginRequiredError,
      activationRequired,
    });
  }
}
