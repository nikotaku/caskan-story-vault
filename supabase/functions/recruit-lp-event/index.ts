import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const STORE_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EXPERIMENT_ID_PATTERN = /^[a-z0-9_-]{1,80}$/;
const EVENT_LABEL_PATTERN = /^[a-z0-9_-]{1,40}$/;
const VISITOR_TOKEN_PATTERN = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;

type Payload = {
  storeId?: unknown;
  experimentId?: unknown;
  variant?: unknown;
  event?: unknown;
  visitorToken?: unknown;
};

function cors(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(origin: string, body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function originAllowed(origin: string, customDomain: string | null): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    const domain = (customDomain ?? "").replace(/^www\./, "").toLowerCase();
    const matchesStore = domain.length > 0 && (host === domain || host === `www.${domain}`);
    const isProjectPreview = host.startsWith("newkyasukan-")
      && host.endsWith("-nikotakus-projects.vercel.app");
    const isLocal = url.protocol === "http:"
      && (host === "localhost" || host === "127.0.0.1");
    return url.protocol === "https:" ? matchesStore || isProjectPreview : isLocal;
  } catch {
    return false;
  }
}

async function digest(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin || "null") });
  }
  if (req.method !== "POST" || !origin) {
    return json(origin || "null", { error: "Method or origin not allowed" }, 405);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json(origin, { error: "Invalid JSON" }, 400);
  }

  const storeId = typeof payload.storeId === "string" ? payload.storeId : "";
  const experimentId = typeof payload.experimentId === "string" ? payload.experimentId : "";
  const variant = typeof payload.variant === "string" ? payload.variant : "";
  const event = typeof payload.event === "string" ? payload.event : "";
  const visitorToken = typeof payload.visitorToken === "string" ? payload.visitorToken : "";

  if (!STORE_ID_PATTERN.test(storeId)
    || !EXPERIMENT_ID_PATTERN.test(experimentId)
    || !EVENT_LABEL_PATTERN.test(variant)
    || !EVENT_LABEL_PATTERN.test(event)
    || !VISITOR_TOKEN_PATTERN.test(visitorToken)) {
    return json(origin, { error: "Invalid event" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(origin, { error: "Analytics unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("custom_domain")
    .eq("id", storeId)
    .eq("is_active", true)
    .maybeSingle();

  if (storeError || !store || !originAllowed(origin, store.custom_domain)) {
    return json(origin, { error: "Origin not allowed" }, 403);
  }

  const forwardedFor = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const network = req.headers.get("cf-connecting-ip") ?? (forwardedFor || "unknown");
  const visitorHash = await digest(serviceRoleKey, `${storeId}|${experimentId}|${visitorToken}`);
  const rateHash = await digest(serviceRoleKey, `${storeId}|${experimentId}|${network}`);

  const { data: accepted, error } = await admin.rpc("record_recruit_lp_event", {
    p_store_id: storeId,
    p_experiment_id: experimentId,
    p_variant: variant,
    p_event: event,
    p_visitor_hash: visitorHash,
    p_rate_hash: rateHash,
  });

  if (error) {
    console.error("record_recruit_lp_event failed", error.code);
    return json(origin, { error: "Analytics write failed" }, 502);
  }
  if (accepted !== true) {
    return json(origin, { error: "Analytics throttled" }, 429);
  }

  return new Response(null, { status: 204, headers: cors(origin) });
});
