import { createHmac } from "node:crypto";
import {
  RECRUIT_EVENTS,
  RECRUIT_EXPERIMENT_ID,
  RECRUIT_VARIANTS,
} from "../src/lib/recruitExperimentConfig";

type RequestLike = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

type ResponseLike = {
  status(code: number): ResponseLike;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
};

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || "https://imrxzkivwrkqbhqfbbes.supabase.co";
const STORE_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const VISITOR_TOKEN_PATTERN = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;

function header(req: RequestLike, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  if (typeof body !== "string") return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function sameOrigin(req: RequestLike): boolean {
  const origin = header(req, "origin");
  const forwardedHost = (header(req, "x-forwarded-host") || header(req, "host"))
    .split(",")[0]
    .trim();
  if (!origin || !forwardedHost) return false;
  try {
    return new URL(origin).host === forwardedHost;
  } catch {
    return false;
  }
}

function digest(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  const body = parseBody(req.body);
  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  const experimentId = typeof body.experimentId === "string" ? body.experimentId : "";
  const variant = typeof body.variant === "string" ? body.variant : "";
  const event = typeof body.event === "string" ? body.event : "";
  const visitorToken = typeof body.visitorToken === "string" ? body.visitorToken : "";

  if (!STORE_ID_PATTERN.test(storeId)
    || experimentId !== RECRUIT_EXPERIMENT_ID
    || !RECRUIT_VARIANTS.some((candidate) => candidate === variant)
    || !RECRUIT_EVENTS.some((candidate) => candidate === event)
    || !VISITOR_TOKEN_PATTERN.test(visitorToken)) {
    res.status(400).json({ error: "Invalid event" });
    return;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    res.status(503).json({ error: "Analytics unavailable" });
    return;
  }

  const forwardedFor = header(req, "x-forwarded-for").split(",")[0].trim();
  const network = forwardedFor || req.socket?.remoteAddress || "unknown";
  const visitorHash = digest(serviceRoleKey, `${storeId}|${experimentId}|${visitorToken}`);
  // Keep the limit network-wide. User-Agent is intentionally excluded so rotating it
  // cannot create fresh rate-limit buckets.
  const rateHash = digest(serviceRoleKey, `${storeId}|${experimentId}|${network}`);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_recruit_lp_event`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_store_id: storeId,
      p_experiment_id: experimentId,
      p_variant: variant,
      p_event: event,
      p_visitor_hash: visitorHash,
      p_rate_hash: rateHash,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    res.status(502).json({ error: "Analytics write failed" });
    return;
  }

  const accepted = await response.json();
  if (accepted !== true) {
    res.setHeader("Retry-After", "3600");
    res.status(429).json({ error: "Analytics throttled" });
    return;
  }

  res.status(204).end();
}
