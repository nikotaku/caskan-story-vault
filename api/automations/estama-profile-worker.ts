import {
  getAdminClient,
  processAvailableJobs,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = { method?: string; body?: Record<string, unknown> };
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function claimToken(admin: ReturnType<typeof getAdminClient>, token: string) {
  if (token.length < 48) return false;
  const { data, error } = await admin.rpc("claim_estama_profile_worker_token", { p_token: token });
  if (error) throw new Error(`プロフィール同期トークンを確認できませんでした: ${error.message}`);
  return data === true;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const admin = getAdminClient();
    const token = stringValue(req.body?.token);
    if (!await claimToken(admin, token)) {
      res.status(401).json({ error: "プロフィール同期トークンが無効または使用済みです" });
      return;
    }

    const results = await processAvailableJobs(admin, {
      jobType: "estama_register_cast",
      limit: 10,
    });
    res.status(200).json({ ok: true, processed: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
