import Browserbase from "@browserbasehq/sdk";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://imrxzkivwrkqbhqfbbes.supabase.co";
const STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase admin key is not configured");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function discoverEstamaMemberPages() {
  const admin = adminClient();
  const { data: connection, error } = await admin
    .from("automation_connections")
    .select("browserbase_context_id,status")
    .eq("store_id", STORE_ID)
    .eq("provider", "estama")
    .maybeSingle();
  if (error) throw error;
  if (!connection?.browserbase_context_id || connection.status !== "ready") {
    throw new Error("Estama connection is not ready");
  }

  const bb = new Browserbase({ apiKey: requiredEnv("BROWSERBASE_API_KEY"), maxRetries: 2, timeout: 60_000 });
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
    if (await page.locator("#Name").count() === 0) throw new Error("Estama login expired");

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
