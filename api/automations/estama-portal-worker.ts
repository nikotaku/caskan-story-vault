import { chromium } from "playwright-core";
import {
  EstamaSubmissionUncertainError,
  getBrowserbase,
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

type ScrapedRow = { text: string; hrefs: string[] };
type EstamaMember = { phone: string; email: string; name?: string };

const STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";
const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || "https://imrxzkivwrkqbhqfbbes.supabase.co";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";
const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function claimMemberWorkerToken(token: string) {
  if (!token || token.length < 48) return false;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_estama_worker_token`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return false;
  return await response.json() === true;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("81") && (digits.length === 11 || digits.length === 12)) return `0${digits.slice(2)}`;
  return digits;
}

function parseMember(row: ScrapedRow): EstamaMember | null {
  const mailHref = row.hrefs.find((href) => href.toLowerCase().startsWith("mailto:"));
  const telHref = row.hrefs.find((href) => href.toLowerCase().startsWith("tel:"));
  const email = (mailHref?.slice(7) || row.text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i)?.[0] || "")
    .trim().toLowerCase();
  const phoneRaw = telHref?.slice(4)
    || row.text.match(/(?:\+?81[-\s]?(?:0)?|0)\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/)?.[0]
    || row.text.match(/0\d{9,10}/)?.[0]
    || "";
  const phone = normalizePhone(phoneRaw);
  if (!email || phone.length < 10) return null;
  return { phone, email };
}

async function withEstamaPage<T>(contextId: string, action: string, fn: (page: import("playwright-core").Page) => Promise<T>) {
  if (!contextId) throw new LoginRequiredError("エステ魂のブラウザ接続情報がありません");
  const bb = getBrowserbase();
  const projectId = process.env.BROWSERBASE_PROJECT_ID || undefined;
  const session = await bb.sessions.create({
    projectId,
    timeout: 300,
    region: "ap-southeast-1",
    browserSettings: {
      context: { id: contextId, persist: true },
      allowedDomains: ["estama.jp"],
      viewport: { width: 1440, height: 1000 },
      solveCaptchas: true,
    },
    userMetadata: { integration: "newkyasukan-estama", action, storeId: STORE_ID },
  });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(30_000);
    return await fn(page);
  } finally {
    try { await browser.close(); } catch {}
    try { await bb.sessions.update(session.id, { status: "REQUEST_RELEASE", projectId }); } catch {}
  }
}

async function assertEstamaLogin(page: import("playwright-core").Page) {
  await page.goto("https://estama.jp/admin/cast_edit/", { waitUntil: "domcontentloaded" });
  if (await page.locator("#Name").count() === 0) throw new LoginRequiredError();
}

async function discoverMemberPages(contextId: string) {
  return await withEstamaPage(contextId, "member-discover", async (page) => {
    await assertEstamaLogin(page);
    const links = await page.locator("a[href]").evaluateAll((nodes) => nodes.map((node) => ({
      text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
      href: (node as HTMLAnchorElement).href,
    })));
    const candidates = links.filter((item) =>
      item.href.startsWith("https://estama.jp/")
      && /会員|顧客|ユーザー|customer|member|user/i.test(`${item.text} ${item.href}`)
    );
    return { currentUrl: page.url(), candidates: candidates.slice(0, 40) };
  });
}

async function scrapeMemberList(contextId: string) {
  return await withEstamaPage(contextId, "member-import", async (page) => {
    await assertEstamaLogin(page);

    const listQueue = ["https://estama.jp/admin/customer/"];
    const visitedLists = new Set<string>();
    const detailUrls = new Set<string>();
    const members = new Map<string, EstamaMember>();
    let scannedRows = 0;

    while (listQueue.length && visitedLists.size < 200) {
      const url = listQueue.shift()!;
      if (visitedLists.has(url)) continue;
      visitedLists.add(url);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      if (!page.url().includes("estama.jp/admin/")) throw new LoginRequiredError();

      const rows: ScrapedRow[] = await page.locator("tr").evaluateAll((nodes) => nodes.map((node) => ({
        text: (node.textContent || "").replace(/\s+/g, " ").trim(),
        hrefs: Array.from(node.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href),
      })));
      scannedRows += rows.length;
      for (const row of rows) {
        const member = parseMember(row);
        if (member) members.set(member.phone, member);
        if (!member) {
          for (const href of row.hrefs) {
            try {
              const parsed = new URL(href);
              if (parsed.origin !== "https://estama.jp") continue;
              if (!parsed.pathname.startsWith("/admin/customer/")) continue;
              if (parsed.pathname === "/admin/customer/") continue;
              if (/delete|remove|logout/i.test(`${parsed.pathname}${parsed.search}`)) continue;
              detailUrls.add(parsed.toString());
            } catch {}
          }
        }
      }

      const links: string[] = await page.locator('a[href*="/admin/customer/"]').evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLAnchorElement).href)
      );
      for (const href of links) {
        try {
          const parsed = new URL(href);
          if (parsed.origin !== "https://estama.jp" || parsed.pathname !== "/admin/customer/") continue;
          if (parsed.search && !visitedLists.has(parsed.toString())) listQueue.push(parsed.toString());
        } catch {}
      }
    }

    let scannedDetails = 0;
    for (const detailUrl of [...detailUrls].slice(0, 2000)) {
      if (members.size >= 5000) break;
      await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
      if (!page.url().includes("estama.jp/admin/")) throw new LoginRequiredError();
      const row: ScrapedRow = await page.locator("body").evaluate((node) => ({
        text: (node.textContent || "").replace(/\s+/g, " ").trim(),
        hrefs: Array.from(node.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href),
      }));
      scannedDetails += 1;
      const member = parseMember(row);
      if (member) members.set(member.phone, member);
    }

    return {
      members: [...members.values()],
      scannedRows,
      scannedListPages: visitedLists.size,
      scannedDetails,
      discoveredDetailUrls: detailUrls.size,
    };
  });
}

async function importMembers(contextId: string, importToken: string) {
  if (importToken.length < 48) throw new Error("取り込み用トークンがありません");
  const scraped = await scrapeMemberList(contextId);
  if (!scraped.members.length) {
    return { ok: false, reason: "no_members_found", ...scraped, members: undefined };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/import_estama_members`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: importToken, p_members: scraped.members }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`顧客DBへの取り込みに失敗しました (${response.status}): ${body.slice(0, 500)}`);
  const dbResult = body ? JSON.parse(body) : {};
  return {
    ok: true,
    foundMembers: scraped.members.length,
    scannedRows: scraped.scannedRows,
    scannedListPages: scraped.scannedListPages,
    scannedDetails: scraped.scannedDetails,
    discoveredDetailUrls: scraped.discoveredDetailUrls,
    dbResult,
  };
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    if (req.body?.action === "member-discover" || req.body?.action === "member-import") {
      const token = stringValue(req.body?.token);
      if (!await claimMemberWorkerToken(token)) {
        res.status(401).json({ error: "実行トークンが無効または使用済みです" });
        return;
      }
      const contextId = stringValue(req.body?.contextId);
      if (req.body?.action === "member-import") {
        const result = await importMembers(contextId, stringValue(req.body?.importToken));
        res.status(result.ok ? 200 : 422).json(result);
      } else {
        const result = await discoverMemberPages(contextId);
        res.status(200).json({ ok: true, ...result });
      }
      return;
    }

    const jobId = stringValue(req.body?.jobId);
    const workerToken = stringValue(req.body?.workerToken);
    if (!jobId || !workerToken) throw new Error("実行トークンがありません");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/post-to-sites`, {
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
