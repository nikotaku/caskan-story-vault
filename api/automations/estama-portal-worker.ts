import { chromium } from "playwright-core";
import {
  EstamaSubmissionUncertainError,
  getAdminClient,
  getBrowserbase,
  getConnection,
  LoginRequiredError,
  requireSingleDiaryImageUrls,
  runPreparedEstamaDiary,
  SoulActivationRequiredError,
  SoulLoginRequiredError,
  type PreparedEstamaDiary,
} from "../../server/estama-automation.js";
import { assertUploadedPhotoCount } from "../../server/estama-photo-upload.js";

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

const STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";
const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function claimMemberWorkerToken(token: string) {
  if (!token || token.length < 48) return false;
  const baseUrl = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || "https://imrxzkivwrkqbhqfbbes.supabase.co";
  const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";
  const response = await fetch(`${baseUrl}/rest/v1/rpc/claim_estama_worker_token`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return false;
  return await response.json() === true;
}

async function discoverMemberPages() {
  const admin = getAdminClient();
  const connection = await getConnection(admin, STORE_ID);
  if (!connection?.browserbase_context_id || connection.status !== "ready") {
    throw new LoginRequiredError("エステ魂の接続が有効ではありません");
  }

  const bb = getBrowserbase();
  const projectId = process.env.BROWSERBASE_PROJECT_ID || undefined;
  const session = await bb.sessions.create({
    projectId,
    timeout: 300,
    region: "ap-southeast-1",
    browserSettings: {
      context: { id: connection.browserbase_context_id, persist: true },
      allowedDomains: ["estama.jp"],
      viewport: { width: 1440, height: 1000 },
      solveCaptchas: true,
    },
    userMetadata: { integration: "newkyasukan-estama", action: "member-discover", storeId: STORE_ID },
  });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    await page.goto("https://estama.jp/admin/cast_edit/", { waitUntil: "domcontentloaded" });
    if (await page.locator("#Name").count() === 0) throw new LoginRequiredError();

    const links = await page.locator("a[href]").evaluateAll((nodes) => nodes.map((node) => ({
      text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
      href: (node as HTMLAnchorElement).href,
    })));
    const candidates = links.filter((item) =>
      item.href.startsWith("https://estama.jp/")
      && /会員|顧客|ユーザー|customer|member|user/i.test(`${item.text} ${item.href}`)
    );
    return { currentUrl: page.url(), candidates: candidates.slice(0, 40) };
  } finally {
    try { await browser.close(); } catch {}
    try { await bb.sessions.update(session.id, { status: "REQUEST_RELEASE", projectId }); } catch {}
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    if (req.body?.action === "member-discover") {
      const token = stringValue(req.body?.token);
      if (!await claimMemberWorkerToken(token)) {
        res.status(401).json({ error: "実行トークンが無効または使用済みです" });
        return;
      }
      const result = await discoverMemberPages();
      res.status(200).json({ ok: true, ...result });
      return;
    }

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
      res.status(response.status).json({
        error: typeof payload.error === "string" ? payload.error : "実行認証に失敗しました",
        safeToRetry: true,
      });
      return;
    }

    const prepared = payload.work as PreparedEstamaDiary | undefined;
    if (!prepared?.browserbaseContextId || !prepared.cast?.name || !prepared.post?.body) {
      throw new Error("魂セラピスト投稿データが不足しています");
    }
    const imageUrls = requireSingleDiaryImageUrls(prepared.post.imageUrls);
    const result = await runPreparedEstamaDiary(prepared);
    const expectedPhotos = imageUrls.length;
    try {
      if (result.posted !== true) throw new Error("魂セラピストの投稿完了報告がありません");
      assertUploadedPhotoCount(expectedPhotos, result.uploadedPhotos);
    } catch (error) {
      throw new EstamaSubmissionUncertainError(error instanceof Error ? error.message : String(error));
    }
    res.status(200).json({ status: "posted", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const activationRequired = error instanceof SoulActivationRequiredError;
    const soulLoginRequired = error instanceof SoulLoginRequiredError;
    const submissionUncertain = error instanceof EstamaSubmissionUncertainError;
    res.status(error instanceof LoginRequiredError || activationRequired || soulLoginRequired ? 409 : 422).json({
      error: message,
      loginRequired: error instanceof LoginRequiredError,
      soulLoginRequired,
      activationRequired,
      submissionUncertain,
      safeToRetry: !submissionUncertain,
    });
  }
}
