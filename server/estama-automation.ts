import Browserbase from "@browserbasehq/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Locator, type Page } from "playwright-core";
import { createHash } from "node:crypto";

export const ESTAMA_CAST_EDIT_URL = "https://estama.jp/admin/cast_edit/";
export const ESTAMA_SOUL_URL = "https://estama.jp/admin/tamathera/therapist/";

type Json = Record<string, unknown>;
type AdminClient = SupabaseClient;

type CastRecord = {
  name: string;
  bust_size?: string | null;
  body_size?: string | null;
  features?: string[] | null;
  photos?: string[] | null;
  photo?: string | null;
  shop_comment?: string | null;
  therapist_comment?: string | null;
  profile?: string | null;
  therapist_years?: number | null;
  age?: number | null;
  height?: number | null;
  blood_type?: string | null;
  favorite_techniques?: string | null;
  favorite_food?: string | null;
  ideal_type?: string | null;
  celebrity_lookalike?: string | null;
  celebrity_like?: string | null;
  day_off_activities?: string | null;
  hobby?: string | null;
  hobbies?: string | null;
  blog_url?: string | null;
  x_account?: string | null;
  instagram_url?: string | null;
  estama_profile_url?: string | null;
};

type ShiftRecord = {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  approval_status?: string;
  status?: string;
};

type Connection = {
  id: string;
  store_id: string;
  status: string;
  browserbase_context_id: string | null;
  setup_session_id: string | null;
  shop_id: string | null;
  configuration: Json | null;
};

type AutomationJob = {
  id: string;
  store_id: string;
  job_type: "estama_register_cast" | "estama_sync_shift" | "estama_reconcile_shifts" | "estama_post_diary";
  status: string;
  cast_id: string | null;
  shift_id: string | null;
  payload: Json | null;
  attempts: number;
  max_attempts: number;
};

export type SoulCredentials = { email: string; password: string };

const ESTAMA_SHIFT_DAYS = 14;
const JST_OFFSET_MS = 9 * 60 * 60 * 1_000;

const jstDate = (value = new Date()) => new Date(value.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const estamaShiftWindow = () => {
  const startDate = jstDate();
  return { startDate, endDate: addDays(startDate, ESTAMA_SHIFT_DAYS - 1) };
};

export class LoginRequiredError extends Error {
  constructor(message = "エステ魂への再ログインが必要です") {
    super(message);
    this.name = "LoginRequiredError";
  }
}

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} がVercelに設定されていません`);
  return value;
};

const supabaseUrl = () =>
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://imrxzkivwrkqbhqfbbes.supabase.co";

const supabasePublishableKey = () =>
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";

export const createAdminClient = (serviceRoleKey: string) =>
  createClient(supabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const getAdminClient = () => createAdminClient(requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));

const getAuthenticatedClient = (token: string) =>
  createClient(supabaseUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const getBrowserbase = () => new Browserbase({
  apiKey: requiredEnv("BROWSERBASE_API_KEY"),
  maxRetries: 2,
  timeout: 60_000,
});

const projectId = () => process.env.BROWSERBASE_PROJECT_ID || undefined;

export async function authenticateUser(req: { headers?: Record<string, string | string[] | undefined> }) {
  const header = req.headers?.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("認証が必要です");
  const admin = getAuthenticatedClient(token);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("ログインが期限切れです");
  return { admin, user: data.user };
}

export async function assertStoreManager(admin: AdminClient, userId: string, storeId: string) {
  const [{ data: membership }, { data: appRole }] = await Promise.all([
    admin.from("user_stores").select("role").eq("user_id", userId).eq("store_id", storeId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  if (!appRole && !["owner", "manager"].includes(membership?.role || "")) {
    throw new Error("この店舗の自動化を管理する権限がありません");
  }
}

async function createBrowserSession(contextId: string, keepAlive = false, metadata: Json = {}) {
  const bb = getBrowserbase();
  const session = await bb.sessions.create({
    projectId: projectId(),
    keepAlive,
    timeout: keepAlive ? 21_600 : 300,
    region: "ap-southeast-1",
    browserSettings: {
      context: { id: contextId, persist: true },
      allowedDomains: ["estama.jp"],
      viewport: { width: 1440, height: 1000 },
      solveCaptchas: true,
    },
    userMetadata: { integration: "newkyasukan-estama", ...metadata },
  });
  return { bb, session };
}

async function connectSession(connectUrl: string) {
  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  return { browser, page };
}

async function disconnect(browser: Browser) {
  try { await browser.close(); } catch { /* セッション終了後は無視 */ }
}

async function releaseSession(bb: Browserbase, sessionId: string) {
  try { await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE", projectId: projectId() }); } catch { /* 自動失効に任せる */ }
}

export async function getConnection(admin: AdminClient, storeId: string) {
  const { data, error } = await admin
    .from("automation_connections")
    .select("*")
    .eq("store_id", storeId)
    .eq("provider", "estama")
    .maybeSingle();
  if (error) throw error;
  return data as Connection | null;
}

export async function startLoginSetup(admin: AdminClient, storeId: string) {
  const bb = getBrowserbase();
  let connection = await getConnection(admin, storeId);
  let contextId = connection?.browserbase_context_id;
  if (!contextId) {
    const context = await bb.contexts.create({ projectId: projectId() });
    contextId = context.id;
  }

  const { session } = await createBrowserSession(contextId, true, { action: "login-setup", storeId });
  const { browser, page } = await connectSession(session.connectUrl);
  await page.goto(ESTAMA_CAST_EDIT_URL, { waitUntil: "domcontentloaded" });
  await disconnect(browser);
  const live = await bb.sessions.debug(session.id);

  const { data, error } = await admin.from("automation_connections").upsert({
    store_id: storeId,
    provider: "estama",
    status: "login_in_progress",
    browserbase_context_id: contextId,
    setup_session_id: session.id,
    last_error: null,
  }, { onConflict: "store_id,provider" }).select("*").single();
  if (error) throw error;
  connection = data as Connection;
  return { connection, debuggerUrl: live.debuggerFullscreenUrl || live.debuggerUrl };
}

export async function verifyLoginSetup(admin: AdminClient, storeId: string) {
  const connection = await getConnection(admin, storeId);
  if (!connection?.browserbase_context_id) throw new Error("先にエステ魂ログイン設定を開始してください");

  const bb = getBrowserbase();
  let session: Browserbase.SessionCreateResponse | Browserbase.SessionRetrieveResponse | null = null;
  if (connection.setup_session_id) {
    try {
      const current = await bb.sessions.retrieve(connection.setup_session_id);
      if (current.status === "RUNNING" && current.connectUrl) session = current;
    } catch { /* 新しいセッションで確認 */ }
  }
  if (!session?.connectUrl) {
    session = (await createBrowserSession(connection.browserbase_context_id, false, { action: "login-verify", storeId })).session;
  }

  const { browser, page } = await connectSession(session.connectUrl);
  try {
    await page.goto(ESTAMA_CAST_EDIT_URL, { waitUntil: "domcontentloaded" });
    const ready = await page.locator("#Name").count() > 0;
    if (!ready) throw new LoginRequiredError("エステ魂のログインが確認できません。ライブブラウザ内でログインを完了してください");
    let shopId = await detectShopId(page);
    if (!shopId) {
      const { data: castWithEstamaUrl } = await admin.from("casts").select("estama_profile_url")
        .eq("store_id", storeId).not("estama_profile_url", "is", null).limit(1).maybeSingle();
      shopId = castWithEstamaUrl?.estama_profile_url?.match(/\/shop\/(\d+)\//)?.[1] || null;
    }
    const { data, error } = await admin.from("automation_connections").update({
      status: "ready",
      shop_id: shopId || connection.shop_id,
      last_verified_at: new Date().toISOString(),
      last_error: null,
      setup_session_id: null,
    }).eq("id", connection.id).select("*").single();
    if (error) throw error;
    await admin.from("automation_jobs").update({
      status: "queued", available_at: new Date().toISOString(), error_message: null,
    }).eq("store_id", storeId).eq("provider", "estama").eq("status", "waiting_for_login");
    return data as Connection;
  } catch (error) {
    await admin.from("automation_connections").update({
      status: error instanceof LoginRequiredError ? "login_in_progress" : "error",
      last_error: error instanceof Error ? error.message : String(error),
    }).eq("id", connection.id);
    throw error;
  } finally {
    await disconnect(browser);
    await releaseSession(bb, session.id);
  }
}

async function detectShopId(page: Page) {
  const hrefs = await page.locator('a[href*="/shop/"]').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).href),
  ).catch(() => [] as string[]);
  for (const href of hrefs) {
    const match = href.match(/\/shop\/(\d+)\//);
    if (match) return match[1];
  }
  return null;
}

const cut = (value: unknown, max: number) => String(value ?? "").slice(0, max);

const FEATURE_MAP: Record<string, string> = {
  "新人": "1", "経験豊富": "2", "業界未経験": "3", "施術上手": "28", "上品": "25",
  "甘えん坊": "4", "おとなしい": "5", "おっとり": "7", "明るい": "8", "優しい": "32",
  "努力家": "30", "礼儀正しい": "27", "清楚系": "9", "天然系": "10", "セクシー系": "11",
  "お姉様系": "12", "お嬢様系": "29", "ギャル系": "19", "美人系": "20", "熟女系": "21",
  "かわいい系": "22", "アイドル系": "24", "癒し系": "23", "妹系": "26",
  "モデル体型": "16", "小柄": "31", "色白肌": "18",
};

function castToEstama(cast: CastRecord) {
  let sizeB = "";
  let sizeCup = "";
  const bust = String(cast.bust_size || "").trim();
  const bustFirst = bust.match(/^(\d+)\s*([A-La-l])$/);
  const cupFirst = bust.match(/^([A-La-l])\s*(\d+)$/);
  if (bustFirst) [sizeB, sizeCup] = [bustFirst[1], bustFirst[2].toUpperCase()];
  else if (cupFirst) [sizeCup, sizeB] = [cupFirst[1].toUpperCase(), cupFirst[2]];
  else if (/^[A-La-l]$/.test(bust)) sizeCup = bust.toUpperCase();
  else sizeB = bust.replace(/\D/g, "").slice(0, 3);

  const bodyParts = String(cast.body_size || "").split(/[-–/／]/);
  const numeric = bodyParts.map((part) => part.replace(/\D/g, ""));
  if (!sizeB && numeric.length >= 3) sizeB = numeric[0];
  const sizeW = numeric.length >= 3 ? numeric[1] : numeric[0] || "";
  const sizeH = numeric.length >= 3 ? numeric[2] : numeric[1] || "";
  const types = Array.isArray(cast.features)
    ? cast.features.map((feature: string) => FEATURE_MAP[feature]).filter(Boolean).slice(0, 4)
    : [];
  const photos = (Array.isArray(cast.photos) && cast.photos.length ? cast.photos : cast.photo ? [cast.photo] : [])
    .filter(Boolean).slice(0, 6);

  return {
    name: cut(cast.name, 10),
    description: cut(cast.shop_comment, 500),
    cast_pr: cut(cast.therapist_comment || cast.profile, 500),
    experience: String(cast.therapist_years ?? "").replace(/\D/g, "").slice(0, 2),
    age: cut(cast.age, 2), tall: cut(cast.height, 3),
    size_b: sizeB.slice(0, 3), size_cup: sizeCup,
    size_w: sizeW.slice(0, 3), size_h: sizeH.slice(0, 3),
    blood: ["A", "B", "O", "AB"].includes(cast.blood_type) ? cast.blood_type : "",
    forte_procedure: cut(cast.favorite_techniques, 20),
    food: cut(cast.favorite_food, 20),
    man_like_type: cut(cast.ideal_type, 20),
    like_talent: cut(cast.celebrity_lookalike || cast.celebrity_like, 20),
    holiday: cut(cast.day_off_activities, 20),
    vogue: cut(cast.hobby || cast.hobbies, 20),
    blog: cut(cast.blog_url, 255), twitter: cut(cast.x_account, 255), instagram: cut(cast.instagram_url, 255),
    types, photos,
  };
}

async function setField(page: Page, selector: string, value: unknown) {
  if (value === null || value === undefined || value === "") return;
  const locator = page.locator(selector).first();
  if (!await locator.count()) return;
  const tag = await locator.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
  if (tag === "select") await locator.selectOption(String(value)).catch(async () => locator.selectOption({ label: String(value) }));
  else await locator.fill(String(value));
}

async function ensureAdminLogin(page: Page, requiredSelector?: string) {
  const url = page.url();
  const hasPassword = await page.locator('input[type="password"]').count() > 0;
  const hasRequired = requiredSelector ? await page.locator(requiredSelector).count() > 0 : true;
  if (/\/login\/?(?:\?|$)/i.test(url) || hasPassword || !hasRequired) throw new LoginRequiredError();
}

function normalizePhotoUrl(raw: string) {
  const value = raw.trim();
  const driveId = value.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|thumbnail\?id=)([\w-]+)/)?.[1]
    || value.match(/[?&]id=([\w-]+)/)?.[1]
    || (/^[\w-]{10,}$/.test(value) ? value : null);
  const normalized = driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : value;
  const url = new URL(normalized);
  if (url.protocol !== "https:") throw new Error("写真URLはHTTPSのみ利用できます");
  const supabaseHost = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const allowedHosts = new Set([
    "drive.google.com", "storage.googleapis.com", "img.estama.jp", "cdn2-caskan.com",
    ...(supabaseHost ? [new URL(supabaseHost).hostname] : []),
  ]);
  if (!allowedHosts.has(url.hostname) && !url.hostname.endsWith(".supabase.co")) {
    throw new Error(`未許可の写真ホストです: ${url.hostname}`);
  }
  return url.toString();
}

async function uploadPhotos(page: Page, urls: string[], maxPhotos = 6) {
  const inputs = page.locator('input[type="file"]');
  const count = Math.min(await inputs.count(), urls.length, maxPhotos);
  let uploaded = 0;
  for (let index = 0; index < count; index += 1) {
    try {
      const response = await fetch(normalizePhotoUrl(urls[index]), { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`写真取得HTTP ${response.status}`);
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > 15 * 1024 * 1024) throw new Error("写真が15MBを超えています");
      const contentType = response.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) throw new Error("写真URLが画像を返しませんでした");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > 15 * 1024 * 1024) throw new Error("写真が15MBを超えています");
      await inputs.nth(index).setInputFiles({
        name: `photo-${index + 1}.${contentType.includes("png") ? "png" : "jpg"}`,
        mimeType: contentType,
        buffer,
      });
      uploaded += 1;
    } catch (error) {
      console.warn("Estama photo upload skipped", index, error);
    }
  }
  return uploaded;
}

async function clickSave(page: Page) {
  const submit = page.locator('button, input[type="submit"], a').filter({
    hasText: /保存する|登録する|更新する|投稿する|保存|登録|更新|投稿/,
  }).last();
  if (!await submit.count()) throw new Error("エステ魂の保存ボタンが見つかりません");
  await Promise.all([
    page.waitForLoadState("domcontentloaded").catch(() => undefined),
    submit.click(),
  ]);
  const confirm = page.locator('button, input[type="submit"], a').filter({
    hasText: /確定|はい|登録する|保存する|投稿する/,
  }).last();
  if (await confirm.count()) await confirm.click().catch(() => undefined);
  await page.waitForTimeout(800);
}

const normalizeEstamaName = (value: string) => value
  .normalize("NFKC")
  .toLocaleLowerCase("ja-JP")
  .replace(/[\s\u3000・･·_＿―—–-]+/g, "")
  .replace(/[()（）\u005b\u005d【】「」『』]/g, "")
  .trim();

async function findEstamaCastRow(
  page: Page,
  options: { externalId?: string | null; remoteName?: string | null; localName: string },
): Promise<Locator> {
  const rows = page.locator("tr, .cast-row, .schedule-row, .therapist-row, .list-group-item, li");
  const rowData = await rows.evaluateAll((elements) => elements.map((element, index) => {
    const identity = Array.from(element.querySelectorAll("a, input, button, [data-id]"))
      .map((node) => [
        node.getAttribute("href"),
        node.getAttribute("value"),
        node.getAttribute("data-id"),
        node.getAttribute("name"),
        node.getAttribute("id"),
      ].filter(Boolean).join(" "))
      .join(" ");
    const values = Array.from(element.querySelectorAll(
      "td, th, .name, .cast-name, .therapist-name, strong, b, span, a",
    )).map((node) => node.textContent || "");
    const text = (element.textContent || "").trim();
    return {
      index,
      identity,
      values: [...values, ...text.split(/\r?\n/)],
      textLength: text.length,
      controls: element.querySelectorAll("input, select, button").length,
    };
  }));

  const rank = (matches: typeof rowData) => matches.sort((left, right) =>
    right.controls - left.controls || left.textLength - right.textLength
  );

  if (options.externalId) {
    const escapedId = options.externalId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idPattern = new RegExp(`(^|\\D)${escapedId}(\\D|$)`);
    const matches = rank(rowData.filter((row) => idPattern.test(row.identity)));
    if (matches.length) return rows.nth(matches[0].index);
  }

  const expected = [...new Set(
    [options.remoteName, options.localName]
      .filter(Boolean)
      .map((name) => normalizeEstamaName(String(name))),
  )];
  const matches = rank(rowData.filter((row) =>
    row.values.some((candidate) => expected.includes(normalizeEstamaName(candidate)))
  ));
  if (matches.length) return rows.nth(matches[0].index);

  const observed = [...new Set(rowData.flatMap((row) => row.values)
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0 && value.length <= 30))]
    .slice(0, 12);
  throw new Error(
    `エステ魂に「${options.remoteName || options.localName}」の完全一致が見つかりません`
    + `（画面: ${page.url()} / 候補: ${observed.join("、") || "なし"}）`,
  );
}

async function registerCast(admin: AdminClient, page: Page, job: AutomationJob, soul?: SoulCredentials) {
  if (!job.cast_id) throw new Error("登録対象のセラピストがありません");
  const { data: cast, error: castError } = await admin.from("casts").select("*").eq("id", job.cast_id).single();
  if (castError || !cast) throw castError || new Error("セラピストが見つかりません");
  const { data: current } = await admin.from("external_cast_profiles").select("*")
    .eq("cast_id", job.cast_id).eq("provider", "estama").maybeSingle();
  const editUrl = current?.admin_edit_url || ESTAMA_CAST_EDIT_URL;

  await admin.from("external_cast_profiles").upsert({
    store_id: job.store_id, cast_id: job.cast_id, provider: "estama",
    sync_status: "syncing", last_error: null,
  }, { onConflict: "cast_id,provider" });

  await page.goto(editUrl, { waitUntil: "domcontentloaded" });
  await ensureAdminLogin(page, "#Name");
  const data = castToEstama(cast as CastRecord);
  const fields: Array<[string, unknown]> = [
    ["#Name", data.name], ["#Description", data.description], ["#CastPr", data.cast_pr],
    ['[name="experience"]', data.experience], ['[name="age"]', data.age], ['[name="tall"]', data.tall],
    ['[name="size_b"]', data.size_b], ['[name="size_cup"]', data.size_cup],
    ['[name="size_w"]', data.size_w], ['[name="size_h"]', data.size_h], ['[name="blood"]', data.blood],
    ["#ForteProcedure", data.forte_procedure], ["#Food", data.food], ["#ManLikeType", data.man_like_type],
    ["#LikeTalent", data.like_talent], ["#Holiday", data.holiday], ["#Vogue", data.vogue],
    ["#Blog", data.blog], ["#Twitter", data.twitter], ["#Instagram", data.instagram],
  ];
  for (const [selector, value] of fields) await setField(page, selector, value);
  for (const type of data.types) {
    const checkbox = page.locator(`#type_${type}`);
    if (await checkbox.count() && !await checkbox.isChecked()) await checkbox.check();
  }
  const uploadedPhotos = await uploadPhotos(page, data.photos);
  await clickSave(page);

  const savedEditUrl = page.url();
  const publicHref = await page.locator('a[href*="/shop/"][href*="/cast/"]').first().getAttribute("href").catch(() => null);
  const publicUrl = publicHref ? new URL(publicHref, page.url()).toString() : cast.estama_profile_url || null;
  const externalId = publicUrl?.match(/\/cast\/(\d+)\//)?.[1]
    || page.url().match(/(?:cast_id=|\/cast_edit\/)(\d+)/)?.[1]
    || current?.external_cast_id || null;
  let soulResult: Json = {};
  if (soul) {
    try { soulResult = await setupSoulTherapist(page, data.name, soul); }
    catch (error) { soulResult = { status: "error", error: error instanceof Error ? error.message : String(error) }; }
  }

  const profilePatch = {
    store_id: job.store_id, cast_id: job.cast_id, provider: "estama",
    external_cast_id: externalId, admin_edit_url: savedEditUrl, public_profile_url: publicUrl,
    remote_name: data.name, sync_status: "synced", last_profile_sync_at: new Date().toISOString(), last_error: null,
    ...(soul ? {
      soul_status: soulResult.status === "configured" ? "configured" : soulResult.status === "issued" ? "issued" : "error",
      soul_login_url: soulResult.loginUrl || null,
      soul_account_email: soul.email,
    } : {}),
  };
  const { error: profileError } = await admin.from("external_cast_profiles").upsert(profilePatch, { onConflict: "cast_id,provider" });
  if (profileError) throw profileError;
  await admin.from("casts").update({ estama_profile_url: publicUrl, estama_listed: true }).eq("id", job.cast_id);
  return { externalId, publicUrl, uploadedPhotos, soul: soulResult };
}

async function setupSoulTherapist(page: Page, castName: string, credentials: SoulCredentials) {
  await page.goto(ESTAMA_SOUL_URL, { waitUntil: "domcontentloaded" });
  await ensureAdminLogin(page);
  let row = await findEstamaCastRow(page, { localName: castName });
  const start = row.getByText(/魂セラピストを始める/, { exact: false }).first();
  if (await start.count()) {
    await start.click();
    const confirm = page.getByText(/確定|はい|開始する/, { exact: false }).last();
    if (await confirm.count()) await confirm.click();
    await page.waitForTimeout(800);
    await page.goto(ESTAMA_SOUL_URL, { waitUntil: "domcontentloaded" });
    await ensureAdminLogin(page);
    row = await findEstamaCastRow(page, { localName: castName });
  }
  const login = row.getByText(/本人の代わりにログイン/, { exact: false }).first();
  if (!await login.count()) return { status: "issued" };
  const context = page.context();
  const popupPromise = context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  await login.click();
  const popup = await popupPromise;
  const accountPage = popup || page;
  await accountPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  const loginUrl = accountPage.url();
  const email = accountPage.locator('input[type="email"], input[name*="mail" i]').first();
  const passwords = accountPage.locator('input[type="password"]');
  if (await email.count()) await email.fill(credentials.email);
  if (await passwords.count()) await passwords.nth(0).fill(credentials.password);
  if (await passwords.count() > 1) await passwords.nth(1).fill(credentials.password);
  if (await email.count() || await passwords.count()) await clickSave(accountPage);
  return { status: "configured", loginUrl };
}

async function discoverShiftAdminUrl(page: Page, configuration: Json | null) {
  const configured = typeof configuration?.shift_admin_url === "string" ? configuration.shift_admin_url : null;
  if (configured) return configured;

  await page.goto("https://estama.jp/admin/", { waitUntil: "domcontentloaded" });
  await ensureAdminLogin(page);
  const menuLink = page.locator("a").filter({ hasText: /出勤|シフト|スケジュール/ }).first();
  const menuHref = await menuLink.getAttribute("href").catch(() => null);
  const listUrl = menuHref
    ? new URL(menuHref, page.url()).toString()
    : "https://estama.jp/admin/schedule/list/";

  await page.goto(listUrl, { waitUntil: "domcontentloaded" });
  await ensureAdminLogin(page);
  const candidates = await page.locator("a[href], button, input[type=\"submit\"]").evaluateAll((elements) =>
    elements.map((element) => ({
      text: ((element.textContent || element.getAttribute("value") || "") as string).trim().replace(/\s+/g, " "),
      href: element.getAttribute("href") || "",
      formAction: (element.closest("form")?.getAttribute("action") || ""),
      tag: element.tagName.toLowerCase(),
    })).filter((item) =>
      /出勤|シフト|スケジュール|schedule/i.test(item.text + " " + item.href + " " + item.formAction)
    )
  );
  console.log(JSON.stringify({
    level: "info",
    msg: "estama_shift_route_candidates",
    listUrl,
    candidates: candidates.slice(0, 20),
  }));

  const absolute = candidates.map((candidate) => ({
    ...candidate,
    url: candidate.href
      ? new URL(candidate.href, page.url()).toString()
      : candidate.formAction
        ? new URL(candidate.formAction, page.url()).toString()
        : "",
  }));
  const preferred = absolute.find((candidate) =>
    candidate.url && candidate.url !== listUrl && (
      /\/schedule\/(?:edit|register|form|input|setting|create|add)/i.test(candidate.url)
      || /出勤.*(?:登録|編集|入力|設定)|シフト.*(?:登録|編集|入力|設定)/.test(candidate.text)
    )
  );
  if (preferred?.url) return preferred.url;

  const action = page.locator("a, button").filter({
    hasText: /出勤.*(?:登録|編集|入力|設定)|シフト.*(?:登録|編集|入力|設定)/,
  }).filter({ visible: true }).first();
  if (await action.count()) {
    const href = await action.getAttribute("href").catch(() => null);
    if (href) return new URL(href, page.url()).toString();
    await action.click();
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    if (page.url() !== listUrl) return page.url();
  }

  return listUrl;
}

async function setTimeInRow(row: ReturnType<Page["locator"]>, kind: "start" | "end", value: string) {
  const pattern = kind === "start" ? /start|from|open|開始/i : /end|to|close|終了/i;
  const input = row.locator("input, select");
  const total = await input.count();
  let target = row.locator(`input[name*="${kind}" i], select[name*="${kind}" i]`).first();
  if (!await target.count()) {
    for (let i = 0; i < total; i += 1) {
      const name = await input.nth(i).getAttribute("name") || "";
      if (pattern.test(name)) { target = input.nth(i); break; }
    }
  }
  if (!await target.count()) {
    const candidates = row.locator('input[type="time"], select');
    target = candidates.nth(kind === "start" ? 0 : 1);
  }
  if (!await target.count()) throw new Error(`エステ魂の${kind === "start" ? "開始" : "終了"}時刻欄が見つかりません`);
  const tag = await target.evaluate((element) => element.tagName.toLowerCase());
  if (tag === "select") {
    const alternatives = [value.slice(0, 5), value.slice(0, 2), String(Number(value.slice(0, 2)))];
    let selected = false;
    for (const option of alternatives) {
      try { await target.selectOption(option); selected = true; break; } catch { /* 次候補 */ }
    }
    if (!selected) throw new Error(`時刻 ${value} を選択できません`);
  } else await target.fill(value.slice(0, 5));
}

async function syncShift(admin: AdminClient, page: Page, job: AutomationJob, connection: Connection) {
  const payload = job.payload || {};
  let shift: ShiftRecord | null = null;
  if (job.shift_id) {
    const { data } = await admin.from("shifts").select("*").eq("id", job.shift_id).maybeSingle();
    shift = data as ShiftRecord | null;
  }
  const desired = shift || payload;
  const castIdValue = job.cast_id || desired.cast_id;
  if (typeof castIdValue !== "string" || !castIdValue) throw new Error("シフトのセラピストIDがありません");
  const castId = castIdValue;
  const [{ data: cast }, { data: external }] = await Promise.all([
    admin.from("casts").select("id,name").eq("id", castId).single(),
    admin.from("external_cast_profiles").select("*").eq("cast_id", castId).eq("provider", "estama").maybeSingle(),
  ]);
  if (!external || external.sync_status !== "synced") throw new Error("先にセラピストをエステ魂へ登録する必要があります");
  const action = payload.action || (shift?.approval_status === "approved" && shift?.status !== "cancelled" ? "upsert" : "delete");
  const date = String(desired.shift_date || "").slice(0, 10);
  if (!date) throw new Error("シフト日がありません");
  const window = estamaShiftWindow();
  if (date < window.startDate || date > window.endDate) {
    if (job.shift_id) await admin.from("shifts").update({ estama_registered: false }).eq("id", job.shift_id);
    return {
      skipped: true,
      reason: "outside_estama_window",
      message: `エステ魂の同期対象（${window.startDate}〜${window.endDate}）外のため保留しました`,
      date,
      range: window,
    };
  }
  const shiftUrl = await discoverShiftAdminUrl(page, connection.configuration);
  await page.goto(shiftUrl, { waitUntil: "domcontentloaded" });
  await ensureAdminLogin(page);
  await setField(page, 'input[type="date"], input[name*="date" i], select[name*="date" i]', date);
  await page.waitForTimeout(500);

  const row = await findEstamaCastRow(page, {
    externalId: external.external_cast_id,
    remoteName: external.remote_name,
    localName: cast.name,
  });
  if (action === "delete") {
    const off = row.getByText(/休み|非出勤|削除/, { exact: false }).first();
    if (await off.count()) await off.click();
    else {
      const checkbox = row.locator('input[type="checkbox"]').first();
      if (await checkbox.count() && await checkbox.isChecked()) await checkbox.uncheck();
      const timeInputs = row.locator('input[type="time"], input[name*="time" i]');
      for (let i = 0; i < await timeInputs.count(); i += 1) await timeInputs.nth(i).fill("");
    }
  } else {
    const checkbox = row.locator('input[type="checkbox"]').first();
    if (await checkbox.count() && !await checkbox.isChecked()) await checkbox.check();
    await setTimeInRow(row, "start", String(desired.start_time));
    await setTimeInRow(row, "end", String(desired.end_time));
  }
  await clickSave(page);
  if (job.shift_id) await admin.from("shifts").update({ estama_registered: action !== "delete" }).eq("id", job.shift_id);
  await admin.from("external_cast_profiles").update({
    last_shift_sync_at: new Date().toISOString(), last_error: null,
  }).eq("id", external.id);
  return { action, date, cast: external.remote_name || cast.name };
}

async function reconcileShifts(admin: AdminClient, page: Page, job: AutomationJob, connection: Connection) {
  const { startDate, endDate } = estamaShiftWindow();
  let remoteSnapshot: Json = { available: false };
  if (connection.shop_id) {
    const publicUrl = `https://estama.jp/shop/${connection.shop_id}/schedule/`;
    try {
      await page.goto(publicUrl, { waitUntil: "domcontentloaded" });
      const text = await page.locator("body").innerText();
      remoteSnapshot = {
        available: true,
        url: publicUrl,
        hash: createHash("sha256").update(text).digest("hex"),
        capturedAt: new Date().toISOString(),
      };
    } catch (error) {
      remoteSnapshot = {
        available: false,
        url: publicUrl,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const [{ data: profiles }, { data: shifts }] = await Promise.all([
    admin.from("external_cast_profiles").select("cast_id").eq("store_id", job.store_id).eq("provider", "estama").eq("sync_status", "synced"),
    admin.from("shifts").select("*").eq("store_id", job.store_id).gte("shift_date", startDate).lte("shift_date", endDate)
      .eq("approval_status", "approved").neq("status", "cancelled"),
  ]);
  const byKey = new Map((shifts || []).map((shift) => {
    const typedShift = shift as ShiftRecord;
    return [`${typedShift.cast_id}:${typedShift.shift_date}`, typedShift] as const;
  }));
  let queued = 0;
  for (const profile of profiles || []) {
    for (let offset = 0; offset < ESTAMA_SHIFT_DAYS; offset += 1) {
      const day = addDays(startDate, offset);
      const desired = byKey.get(`${profile.cast_id}:${day}`);
      await admin.rpc("enqueue_estama_job", {
        p_store_id: job.store_id,
        p_job_type: "estama_sync_shift",
        p_cast_id: profile.cast_id,
        p_shift_id: desired?.id || null,
        p_dedupe_key: `estama:mirror:${profile.cast_id}:${day}`,
        p_payload: desired ? {
          action: "upsert", cast_id: profile.cast_id, shift_id: desired.id,
          shift_date: day, start_time: desired.start_time, end_time: desired.end_time, source: "daily_reconcile",
        } : { action: "delete", cast_id: profile.cast_id, shift_date: day, source: "daily_reconcile" },
      });
      queued += 1;
    }
  }
  await admin.from("automation_connections").update({
    last_reconciled_at: new Date().toISOString(), last_error: null,
  }).eq("id", connection.id);
  return { range: { startDate, endDate }, remoteSnapshot, queued };
}

async function skipOutsideShiftWindow(admin: AdminClient, job: AutomationJob): Promise<Json | null> {
  if (job.job_type !== "estama_sync_shift") return null;
  let date = typeof job.payload?.shift_date === "string" ? job.payload.shift_date.slice(0, 10) : "";
  if (!date && job.shift_id) {
    const { data } = await admin.from("shifts").select("shift_date").eq("id", job.shift_id).maybeSingle();
    date = String(data?.shift_date || "").slice(0, 10);
  }
  if (!date) return null;
  const window = estamaShiftWindow();
  if (date >= window.startDate && date <= window.endDate) return null;
  if (job.shift_id) await admin.from("shifts").update({ estama_registered: false }).eq("id", job.shift_id);
  return {
    skipped: true,
    reason: "outside_estama_window",
    message: `エステ魂の同期対象（${window.startDate}〜${window.endDate}）外のため保留しました`,
    date,
    range: window,
  };
}

async function updatePostOverallStatus(admin: AdminClient, postId: string) {
  const { data } = await admin.from("cast_posts").select("hp_status,o2_status,esutama_status").eq("id", postId).single();
  if (!data) return;
  const statuses = [data.hp_status, data.o2_status, data.esutama_status];
  const complete = statuses.every((status) => status === "posted");
  const failed = statuses.some((status) => status === "failed" || status === "skipped");
  await admin.from("cast_posts").update({
    status: complete ? "posted" : failed ? "failed" : "pending",
    posted_at: complete ? new Date().toISOString() : null,
  }).eq("id", postId);
}

async function postEstamaDiary(admin: AdminClient, page: Page, job: AutomationJob) {
  const postId = typeof job.payload?.post_id === "string" ? job.payload.post_id : "";
  if (!job.cast_id || !postId) throw new Error("写メ日記の投稿情報がありません");
  const [{ data: post, error: postError }, { data: cast, error: castError }, { data: external }] = await Promise.all([
    admin.from("cast_posts").select("id,title,body,image_urls,esutama_status,esutama_attempts").eq("id", postId).eq("cast_id", job.cast_id).single(),
    admin.from("casts").select("id,name").eq("id", job.cast_id).single(),
    admin.from("external_cast_profiles").select("*").eq("cast_id", job.cast_id).eq("provider", "estama").maybeSingle(),
  ]);
  if (postError || !post) throw postError || new Error("投稿が見つかりません");
  if (castError || !cast) throw castError || new Error("セラピストが見つかりません");
  if (!external || external.sync_status !== "synced") throw new Error("先にセラピストをエステ魂へ登録してください");
  if (post.esutama_status === "posted") return { posted: true, skipped: true, reason: "already_posted" };

  await admin.from("cast_posts").update({
    esutama_status: "posting",
    esutama_error: null,
    esutama_attempts: Number(post.esutama_attempts || 0) + 1,
    last_attempt_at: new Date().toISOString(),
  }).eq("id", postId);

  await page.goto(ESTAMA_SOUL_URL, { waitUntil: "domcontentloaded" });
  await ensureAdminLogin(page);
  const row = await findEstamaCastRow(page, {
    externalId: external.external_cast_id,
    remoteName: external.remote_name,
    localName: cast.name,
  });
  const login = row.getByText(/本人の代わりにログイン/, { exact: false }).first();
  if (!await login.count()) throw new Error("エステ魂の『本人の代わりにログイン』が見つかりません。魂セラピスト設定を確認してください");

  const popupPromise = page.context().waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  await login.click();
  const popup = await popupPromise;
  const accountPage = popup || page;
  await accountPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  if (await accountPage.locator('input[type="password"]').count()) {
    throw new LoginRequiredError("エステ魂のセラピスト側ログインが切れています");
  }

  const diaryLink = accountPage.locator("a, button").filter({ hasText: /写メ日記|写メブログ|日記/ }).first();
  if (!/diary|blog|photo/i.test(accountPage.url())) {
    if (!await diaryLink.count()) throw new Error("エステ魂の写メ日記メニューが見つかりません");
    await diaryLink.click();
    await accountPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  }
  const newPost = accountPage.locator("a, button").filter({ hasText: /新規投稿|日記を書く|投稿する|新規作成/ }).first();
  if (await newPost.count()) {
    await newPost.click();
    await accountPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  }

  await setField(accountPage, 'input[name*="title" i], input[id*="title" i], input[name*="subject" i]', post.title || "写メ日記");
  await setField(accountPage, 'textarea[name*="body" i], textarea[name*="content" i], textarea[name*="diary" i], textarea', post.body);
  const bodyField = accountPage.locator('textarea[name*="body" i], textarea[name*="content" i], textarea[name*="diary" i], textarea').first();
  if (!await bodyField.count()) throw new Error("エステ魂の写メ日記本文欄が見つかりません");
  const imageUrls = Array.isArray(post.image_urls) ? post.image_urls.filter((url): url is string => typeof url === "string") : [];
  const uploadedPhotos = await uploadPhotos(accountPage, imageUrls, 3);
  await clickSave(accountPage);
  const visibleError = await accountPage.locator('.error:visible, .alert-danger:visible, [role="alert"]:visible').allTextContents().catch(() => []);
  if (visibleError.some((value) => value.trim())) throw new Error(`エステ魂: ${visibleError.join(" / ").slice(0, 300)}`);

  await admin.from("cast_posts").update({
    esutama_status: "posted",
    esutama_error: null,
    posted_at: new Date().toISOString(),
  }).eq("id", postId);
  await updatePostOverallStatus(admin, postId);
  return { posted: true, uploadedPhotos, url: accountPage.url() };
}

export type PreparedEstamaDiary = {
  jobId: string;
  browserbaseContextId: string;
  soulCredentials?: SoulCredentials;
  cast: {
    name: string;
    externalId?: string | null;
    remoteName?: string | null;
  };
  post: {
    title?: string | null;
    body: string;
    imageUrls?: string[] | null;
  };
};

export async function runPreparedEstamaDiary(input: PreparedEstamaDiary) {
  const created = await createBrowserSession(input.browserbaseContextId, false, {
    action: "portal-diary",
    jobId: input.jobId,
  });
  let browser: Browser | null = null;
  try {
    const connected = await connectSession(created.session.connectUrl);
    browser = connected.browser;
    const page = connected.page;
    let soulResult: Json | undefined;
    if (input.soulCredentials) {
      soulResult = await setupSoulTherapist(page, input.cast.name, input.soulCredentials);
    }
    await page.goto(ESTAMA_SOUL_URL, { waitUntil: "domcontentloaded" });
    await ensureAdminLogin(page);
    const row = await findEstamaCastRow(page, {
      externalId: input.cast.externalId || undefined,
      remoteName: input.cast.remoteName || undefined,
      localName: input.cast.name,
    });
    const login = row.getByText(/本人の代わりにログイン/, { exact: false }).first();
    if (!await login.count()) {
      throw new Error("エステ魂の『本人の代わりにログイン』が見つかりません。魂セラピスト設定を確認してください");
    }

    const popupPromise = page.context().waitForEvent("page", { timeout: 5_000 }).catch(() => null);
    await login.click();
    const popup = await popupPromise;
    const accountPage = popup || page;
    await accountPage.waitForLoadState("domcontentloaded").catch(() => undefined);
    if (await accountPage.locator('input[type="password"]').count()) {
      throw new LoginRequiredError("エステ魂のセラピスト側ログインが切れています");
    }

    const diaryLink = accountPage.locator("a, button").filter({ hasText: /写メ日記|写メブログ|日記/ }).first();
    if (!/diary|blog|photo/i.test(accountPage.url())) {
      if (!await diaryLink.count()) throw new Error("エステ魂の写メ日記メニューが見つかりません");
      await diaryLink.click();
      await accountPage.waitForLoadState("domcontentloaded").catch(() => undefined);
    }
    const newPost = accountPage.locator("a, button").filter({ hasText: /新規投稿|日記を書く|投稿する|新規作成/ }).first();
    if (await newPost.count()) {
      await newPost.click();
      await accountPage.waitForLoadState("domcontentloaded").catch(() => undefined);
    }

    await setField(accountPage, 'input[name*="title" i], input[id*="title" i], input[name*="subject" i]', input.post.title || "写メ日記");
    await setField(accountPage, 'textarea[name*="body" i], textarea[name*="content" i], textarea[name*="diary" i], textarea', input.post.body);
    const bodyField = accountPage.locator('textarea[name*="body" i], textarea[name*="content" i], textarea[name*="diary" i], textarea').first();
    if (!await bodyField.count()) throw new Error("エステ魂の写メ日記本文欄が見つかりません");
    const imageUrls = Array.isArray(input.post.imageUrls)
      ? input.post.imageUrls.filter((url): url is string => typeof url === "string")
      : [];
    const uploadedPhotos = await uploadPhotos(accountPage, imageUrls, 3);
    await clickSave(accountPage);
    const visibleError = await accountPage.locator('.error:visible, .alert-danger:visible, [role="alert"]:visible').allTextContents().catch(() => []);
    if (visibleError.some((value) => value.trim())) {
      throw new Error(`エステ魂: ${visibleError.join(" / ").slice(0, 300)}`);
    }
    return {
      posted: true,
      uploadedPhotos,
      url: accountPage.url(),
      ...(soulResult ? { soul: soulResult } : {}),
    };
  } finally {
    if (browser) await disconnect(browser);
    await releaseSession(created.bb, created.session.id);
  }
}

async function claimNextJob(admin: AdminClient, storeId?: string, castId?: string, jobId?: string) {
  let query = admin.from("automation_jobs").select("*")
    .eq("provider", "estama").eq("status", "queued").lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true }).limit(1);
  if (storeId) query = query.eq("store_id", storeId);
  if (castId) query = query.eq("cast_id", castId);
  if (jobId) query = query.eq("id", jobId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: claimed } = await admin.from("automation_jobs").update({
    status: "running", attempts: data.attempts + 1, started_at: new Date().toISOString(), error_message: null,
  }).eq("id", data.id).eq("status", "queued").select("*").maybeSingle();
  return claimed as AutomationJob | null;
}

async function completeJob(admin: AdminClient, job: AutomationJob, result: Json) {
  await admin.from("automation_jobs").update({
    status: "completed", result, error_message: null, finished_at: new Date().toISOString(),
  }).eq("id", job.id);
}

async function failJob(admin: AdminClient, job: AutomationJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const postId = job.job_type === "estama_post_diary" && typeof job.payload?.post_id === "string"
    ? job.payload.post_id
    : null;
  if (error instanceof LoginRequiredError) {
    await Promise.all([
      admin.from("automation_jobs").update({ status: "waiting_for_login", error_message: message }).eq("id", job.id),
      admin.from("automation_connections").update({ status: "expired", last_error: message }).eq("store_id", job.store_id).eq("provider", "estama"),
      ...(postId ? [admin.from("cast_posts").update({ esutama_status: "pending", esutama_error: message }).eq("id", postId)] : []),
    ]);
    if (postId) await updatePostOverallStatus(admin, postId);
    return;
  }
  const retry = job.attempts < job.max_attempts;
  const delayMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1));
  const availableAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
  await admin.from("automation_jobs").update({
    status: retry ? "queued" : "failed",
    error_message: message,
    available_at: availableAt,
    finished_at: retry ? null : new Date().toISOString(),
  }).eq("id", job.id);
  if (postId) {
    await admin.from("cast_posts").update({
      esutama_status: retry ? "pending" : "failed",
      esutama_error: message,
    }).eq("id", postId);
    await updatePostOverallStatus(admin, postId);
  }
  if (job.cast_id) {
    await admin.from("external_cast_profiles").update({
      ...(job.job_type === "estama_register_cast" ? { sync_status: "error" } : {}),
      last_error: message,
    }).eq("cast_id", job.cast_id).eq("provider", "estama");
  }
}

export type EstamaShiftBatchItem = {
  jobId: string;
  shiftId: string;
  castId: string;
  castName: string;
  externalId: string | null;
  remoteName: string | null;
  reportToken: string;
  action: "upsert" | "delete";
  shiftDate: string;
  startTime: string;
  endTime: string;
};

export type EstamaShiftBatchResult = {
  jobId: string;
  shiftId: string;
  castId: string;
  action: "upsert" | "delete";
  shiftDate: string;
  ok: boolean;
  error?: string;
};

export type EstamaShiftBatchInput = {
  storeId: string;
  contextId: string;
  configuration?: Json | null;
  items: EstamaShiftBatchItem[];
  onResult?: (result: EstamaShiftBatchResult, reportToken: string) => Promise<void>;
};

const estamaEndTime = (startTime: string, endTime: string) => {
  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour > startHour) {
    return endTime.slice(0, 5);
  }
  return `${String(endHour + 24).padStart(2, "0")}:${endTime.slice(3, 5)}`;
};

export async function syncEstamaShiftBatch(input: EstamaShiftBatchInput) {
  const items = input.items.slice(0, 60);
  if (!input.contextId) throw new Error("Browserbaseの保存済みログイン情報がありません");
  if (!items.length) return { sessionId: null, shiftUrl: null, results: [] };

  const { bb, session } = await createBrowserSession(input.contextId, false, {
    action: "edge-shift-worker",
    storeId: input.storeId,
    itemCount: String(items.length),
  });
  const { browser, page } = await connectSession(session.connectUrl);
  page.setDefaultTimeout(8_000);
  const results: EstamaShiftBatchResult[] = [];
  const reportResult = async (result: EstamaShiftBatchResult, reportToken: string) => {
    if (!input.onResult) return;
    try {
      await input.onResult(result, reportToken);
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        msg: "estama_shift_item_report_failed",
        jobId: result.jobId,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  try {
    const shiftUrl = await discoverShiftAdminUrl(page, input.configuration || null);
    for (const item of items) {
      try {
        const itemShiftUrl = item.externalId
          ? `https://estama.jp/admin/schedule/${encodeURIComponent(item.externalId)}/`
          : shiftUrl;
        await page.goto(itemShiftUrl, { waitUntil: "domcontentloaded" });
        await ensureAdminLogin(page);
        if (results.length === 0) {
          const controls = await page.locator("input, select, button").evaluateAll((elements) =>
            elements.slice(0, 80).map((element) => ({
              tag: element.tagName.toLowerCase(),
              name: element.getAttribute("name"),
              id: element.getAttribute("id"),
              type: element.getAttribute("type"),
              value: (element as HTMLInputElement).value,
              text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
            }))
          );
          console.log(JSON.stringify({
            level: "info",
            msg: "estama_shift_form_controls",
            itemShiftUrl,
            title: await page.title(),
            controls,
          }));
        }
        await setField(
          page,
          'input[type="date"], input[name*="date" i], select[name*="date" i]',
          item.shiftDate,
        );
        await page.waitForTimeout(500);
        const scheduleName = `column[${item.shiftDate}][select]`;
        const start = page.locator(`select[name="${scheduleName}[select_start]"]`).first();
        const end = page.locator(`select[name="${scheduleName}[select_end]"]`).first();
        if (!await start.count() || !await end.count()) {
          throw new Error(`エステ魂の${item.shiftDate}の出退勤欄が見つかりません`);
        }

        if (item.action === "delete") {
          await start.selectOption("").catch(() => start.selectOption({ index: 0 }));
          await end.selectOption("").catch(() => end.selectOption({ index: 0 }));
        } else {
          const startValue = item.startTime.slice(0, 5);
          const endValue = estamaEndTime(item.startTime, item.endTime);
          await start.selectOption(startValue);
          await end.selectOption(endValue);
        }
        await clickSave(page);
        const result: EstamaShiftBatchResult = {
          jobId: item.jobId,
          shiftId: item.shiftId,
          castId: item.castId,
          action: item.action,
          shiftDate: item.shiftDate,
          ok: true,
        };
        results.push(result);
        await reportResult(result, item.reportToken);
        console.log(JSON.stringify({
          level: "info",
          msg: "estama_shift_item_done",
          jobId: item.jobId,
          castName: item.castName,
          shiftDate: item.shiftDate,
          action: item.action,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const result: EstamaShiftBatchResult = {
          jobId: item.jobId,
          shiftId: item.shiftId,
          castId: item.castId,
          action: item.action,
          shiftDate: item.shiftDate,
          ok: false,
          error: message,
        };
        results.push(result);
        await reportResult(result, item.reportToken);
        console.warn(JSON.stringify({
          level: "warning",
          msg: "estama_shift_item_failed",
          jobId: item.jobId,
          castName: item.castName,
          shiftDate: item.shiftDate,
          action: item.action,
          error: message,
        }));
        if (error instanceof LoginRequiredError) break;
      }
    }
    return { sessionId: session.id, shiftUrl, results };
  } finally {
    await disconnect(browser);
    await releaseSession(bb, session.id);
  }
}

export async function processAvailableJobs(
  admin: AdminClient,
  options: { storeId?: string; castId?: string; jobId?: string; limit?: number; soulCredentials?: SoulCredentials } = {},
) {
  const limit = Math.max(1, Math.min(options.limit || 20, 60));
  const results: Array<{ id: string; status: string; result?: Json; error?: string }> = [];
  let activeStore = "";
  let connection: Connection | null = null;
  let bb: Browserbase | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;
  let sessionId = "";

  try {
    for (let index = 0; index < limit; index += 1) {
      const job = await claimNextJob(admin, options.storeId, options.castId, options.jobId);
      if (!job) break;
      try {
        const skippedShift = await skipOutsideShiftWindow(admin, job);
        if (skippedShift) {
          await completeJob(admin, job, skippedShift);
          results.push({ id: job.id, status: "completed", result: skippedShift });
          continue;
        }
        if (!connection || activeStore !== job.store_id) {
          if (browser) await disconnect(browser);
          if (bb && sessionId) await releaseSession(bb, sessionId);
          connection = await getConnection(admin, job.store_id);
          activeStore = job.store_id;
          if (!connection?.browserbase_context_id || connection.status !== "ready") throw new LoginRequiredError("エステ魂ログイン設定が未完了です");
          const created = await createBrowserSession(connection.browserbase_context_id, false, { action: "worker", storeId: job.store_id });
          bb = created.bb;
          sessionId = created.session.id;
          const connected = await connectSession(created.session.connectUrl);
          browser = connected.browser;
          page = connected.page;
          await admin.from("automation_jobs").update({ browserbase_session_id: sessionId }).eq("id", job.id);
        }
        if (!page || !connection) throw new Error("ブラウザセッションを開始できませんでした");
        let result: Json;
        if (job.job_type === "estama_register_cast") result = await registerCast(admin, page, job, options.soulCredentials);
        else if (job.job_type === "estama_sync_shift") result = await syncShift(admin, page, job, connection);
        else if (job.job_type === "estama_post_diary") result = await postEstamaDiary(admin, page, job);
        else result = await reconcileShifts(admin, page, job, connection);
        await completeJob(admin, job, result);
        results.push({ id: job.id, status: "completed", result });
      } catch (error) {
        await failJob(admin, job, error);
        results.push({ id: job.id, status: error instanceof LoginRequiredError ? "waiting_for_login" : "failed", error: error instanceof Error ? error.message : String(error) });
        if (error instanceof LoginRequiredError) break;
      }
    }
  } finally {
    if (browser) await disconnect(browser);
    if (bb && sessionId) await releaseSession(bb, sessionId);
  }
  return results;
}

export async function enqueueCastJob(admin: AdminClient, storeId: string, castId: string) {
  const { data, error } = await admin.rpc("enqueue_estama_job", {
    p_store_id: storeId, p_job_type: "estama_register_cast", p_cast_id: castId, p_shift_id: null,
    p_dedupe_key: `estama:cast:${castId}`, p_payload: { source: "manual_run" },
  });
  if (error) throw error;
  return data as string;
}

export async function enqueueEstamaDiaryJob(admin: AdminClient, storeId: string, castId: string, postId: string) {
  const { data: active } = await admin.from("automation_jobs").select("id")
    .eq("store_id", storeId)
    .eq("cast_id", castId)
    .eq("job_type", "estama_post_diary")
    .in("status", ["queued", "running", "waiting_for_login"])
    .contains("payload", { post_id: postId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active?.id) return active.id as string;
  const { data: post } = await admin.from("cast_posts").select("esutama_attempts").eq("id", postId).single();
  const attempt = Number(post?.esutama_attempts || 0) + 1;
  const { data, error } = await admin.rpc("enqueue_estama_job", {
    p_store_id: storeId,
    p_job_type: "estama_post_diary",
    p_cast_id: castId,
    p_shift_id: null,
    p_dedupe_key: `estama:diary:${postId}:${attempt}`,
    p_payload: { source: "therapist_portal", post_id: postId, attempt },
  });
  if (error) throw error;
  return data as string;
}

export async function enqueueReconcileJobs(admin: AdminClient) {
  const { data: connections, error } = await admin.from("automation_connections").select("store_id")
    .eq("provider", "estama").eq("status", "ready");
  if (error) throw error;
  const date = new Date().toISOString().slice(0, 10);
  for (const connection of connections || []) {
    await admin.rpc("enqueue_estama_job", {
      p_store_id: connection.store_id,
      p_job_type: "estama_reconcile_shifts",
      p_cast_id: null,
      p_shift_id: null,
      p_dedupe_key: `estama:reconcile:${date}`,
      p_payload: { source: "vercel_cron", date },
    });
  }
  return connections?.length || 0;
}
