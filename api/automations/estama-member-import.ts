import Browserbase from "@browserbasehq/sdk";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

export const config = { maxDuration: 300 };

type RequestLike = { method?: string; body?: Record<string, unknown> };
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://imrxzkivwrkqbhqfbbes.supabase.co";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";
const STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function claimToken(token: string) {
  if (!token || token.length < 48) return false;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_estama_worker_token`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
  });
  if (!response.ok) throw new Error(`token validation failed: ${response.status}`);
  return await response.json() === true;
}

function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase admin key is not configured");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function openEstama() {
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
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID || undefined,
    timeout: 300,
    region: "ap-southeast-1",
    browserSettings: {
      context: { id: connection.browserbase_context_id, persist: true },
      allowedDomains: ["estama.jp"],
      viewport: { width: 1440, height: 1000 },
      solveCaptchas: true,
    },
    userMetadata: { integration: "newkyasukan-estama", action: "member-import", storeId: STORE_ID },
  });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  return { admin, bb, session, browser, page };
}

async function closeEstama(resources: Awaited<ReturnType<typeof openEstama>>) {
  try { await resources.browser.close(); } catch {}
  try {
    await resources.bb.sessions.update(resources.session.id, {
      status: "REQUEST_RELEASE",
      projectId: process.env.BROWSERBASE_PROJECT_ID || undefined,
    });
  } catch {}
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!await claimToken(token)) return res.status(401).json({ error: "invalid token" });

  const action = req.body?.action === "import" ? "import" : "discover";
  const resources = await openEstama();
  try {
    await resources.page.goto("https://estama.jp/admin/cast_edit/", { waitUntil: "domcontentloaded" });
    if (await resources.page.locator("#Name").count() === 0) throw new Error("Estama login expired");

    const links = await resources.page.locator("a[href]").evaluateAll((nodes) => nodes.map((node) => ({
      text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
      href: (node as HTMLAnchorElement).href,
    })).catch(() => [] as Array<{ text: string; href: string }>);
    const candidates = links.filter((item) =>
      /会員|顧客|ユーザー|customer|member|user/i.test(`${item.text} ${item.href}`)
      && item.href.startsWith("https://estama.jp/")
    );

    if (action === "discover") {
      return res.status(200).json({ ok: true, page: resources.page.url(), candidates: candidates.slice(0, 30) });
    }

    const explicitUrl = typeof req.body?.memberUrl === "string" ? req.body.memberUrl : "";
    const target = explicitUrl && explicitUrl.startsWith("https://estama.jp/") ? explicitUrl : candidates[0]?.href;
    if (!target) throw new Error("member page not found");
    await resources.page.goto(target, { waitUntil: "domcontentloaded" });

    // Do not return PII from this endpoint. Capture rows locally and merge directly into Supabase.
    const rawRows = await resources.page.locator("tr").evaluateAll((rows) => rows.map((tr) => {
      const text = (tr.textContent || "").replace(/\s+/g, " ").trim();
      const email = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i)?.[0] || "";
      const phone = text.match(/(?:\+?81[-\s]?(?:0)?|0)\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/)?.[0] || "";
      return { email, phone };
    })).catch(() => [] as Array<{ email: string; phone: string }>);

    const normalized = rawRows.map((row) => ({
      email: row.email.trim().toLowerCase().replace(/^mailto:/i, ""),
      phone: row.phone.replace(/\D/g, "").replace(/^81(?=\d{9,10}$)/, "0"),
    })).filter((row) => row.email && row.phone.length >= 10);

    const uniqueByPhone = new Map<string, { email: string; phone: string }>();
    for (const row of normalized) if (!uniqueByPhone.has(row.phone)) uniqueByPhone.set(row.phone, row);
    const members = [...uniqueByPhone.values()];

    let matched = 0;
    let updated = 0;
    let inserted = 0;
    let conflicts = 0;
    for (const member of members) {
      const { data: matches, error: matchError } = await resources.admin
        .from("customers")
        .select("id,email,phone,status,store_id")
        .in("store_id", [STORE_ID, "00000000-0000-0000-0000-000000000001"]);
      if (matchError) throw matchError;
      const samePhone = (matches || []).filter((row) => String(row.phone || "").replace(/\D/g, "") === member.phone);
      if (samePhone.length) {
        matched += 1;
        const canonical = samePhone.find((row) => row.store_id === STORE_ID && row.status !== "newsletter_only")
          || samePhone.find((row) => row.status !== "newsletter_only")
          || samePhone[0];
        const existingEmail = String(canonical.email || "").trim().toLowerCase();
        if (existingEmail && existingEmail !== member.email) conflicts += 1;
        if (!existingEmail) {
          const { error: updateError } = await resources.admin.from("customers")
            .update({ email: member.email, updated_at: new Date().toISOString() })
            .eq("id", canonical.id);
          if (updateError) throw updateError;
          updated += 1;
        }
        continue;
      }
      const { error: insertError } = await resources.admin.from("customers").insert({
        store_id: STORE_ID,
        name: "エステ魂会員",
        phone: member.phone,
        email: member.email,
        status: "active",
        newsletter_opt_in: false,
      });
      if (insertError) throw insertError;
      inserted += 1;
    }

    return res.status(200).json({
      ok: true,
      target,
      scannedRows: rawRows.length,
      validMembers: members.length,
      matched,
      updated,
      inserted,
      conflicts,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    await closeEstama(resources);
  }
}
