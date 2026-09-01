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

  let admin: ReturnType<typeof getAdminClient> | null = null;
  let token = "";
  let claimed = false;
  try {
    token = stringValue(req.body?.token);
    admin = getAdminClient();
    claimed = await claimToken(admin, token);
    if (!claimed) {
      res.status(401).json({ error: "プロフィール同期トークンが無効または使用済みです" });
      return;
    }

    const results = await processAvailableJobs(admin, {
      jobType: "estama_register_cast",
      limit: 10,
    });
    res.status(200).json({ ok: true, processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "estama_profile_worker_failed", error: message }));
    res.status(500).json({ error: message });
  } finally {
    if (admin && claimed && token) {
      try {
        const { error } = await admin.rpc("release_estama_profile_worker_lease", { p_token: token });
        if (error) {
          console.error(JSON.stringify({
            event: "estama_profile_worker_lease_release_failed",
            error: error.message,
          }));
        }
      } catch (error) {
        console.error(JSON.stringify({
          event: "estama_profile_worker_lease_release_failed",
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }
}
