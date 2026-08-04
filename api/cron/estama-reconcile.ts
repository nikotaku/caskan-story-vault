import {
  enqueueReconcileJobs,
  getAdminClient,
  processAvailableJobs,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = { method?: string; headers?: Record<string, string | string[] | undefined> };
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  const header = req.headers?.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  const cronSecret = process.env.CRON_SECRET;
  if (req.method !== "GET" || !cronSecret || authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const admin = getAdminClient();
    const reconciliations = await enqueueReconcileJobs(admin);
    const results = await processAvailableJobs(admin, { limit: 60 });
    res.status(200).json({ ok: true, reconciliations, processed: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
