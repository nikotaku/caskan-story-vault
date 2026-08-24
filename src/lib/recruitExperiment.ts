import {
  RECRUIT_EXPERIMENT_ID,
  RECRUIT_VARIANTS,
  type RecruitEvent,
  type RecruitVariant,
} from "@/lib/recruitExperimentConfig";

export {
  RECRUIT_EXPERIMENT_ID,
  RECRUIT_VARIANTS,
  type RecruitEvent,
  type RecruitVariant,
} from "@/lib/recruitExperimentConfig";

const VARIANT_STORAGE_PREFIX = "recruit_lp_variant";
const EVENT_STORAGE_PREFIX = "recruit_lp_event";
const BROWSER_TOKEN_KEY = "recruit_lp_browser_token:v1";

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing. The experiment still renders.
  }
}

function removeLocalStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function randomVariant(): RecruitVariant {
  try {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return RECRUIT_VARIANTS[value[0] % RECRUIT_VARIANTS.length];
  } catch {
    return Math.random() < 0.5 ? "safety_first" : "freedom_first";
  }
}

export function assignRecruitVariant(storeId: string): RecruitVariant {
  const key = `${VARIANT_STORAGE_PREFIX}:${storeId}:${RECRUIT_EXPERIMENT_ID}`;
  const saved = readLocalStorage(key);
  if (RECRUIT_VARIANTS.includes(saved as RecruitVariant)) return saved as RecruitVariant;

  const assigned = randomVariant();
  writeLocalStorage(key, assigned);
  return assigned;
}

function browserToken(): string {
  const saved = readLocalStorage(BROWSER_TOKEN_KEY);
  if (saved && /^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/.test(saved)) return saved;

  let token: string;
  try {
    token = window.crypto.randomUUID();
  } catch {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  writeLocalStorage(BROWSER_TOKEN_KEY, token);
  return token;
}

export async function recordRecruitEvent(
  storeId: string,
  variant: RecruitVariant,
  event: RecruitEvent,
): Promise<void> {
  const onceKey = [
    EVENT_STORAGE_PREFIX,
    storeId,
    RECRUIT_EXPERIMENT_ID,
    variant,
    event,
  ].join(":");

  if (readLocalStorage(onceKey) === "1") return;
  writeLocalStorage(onceKey, "pending");

  try {
    const response = await fetch("/api/recruit-event", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        experimentId: RECRUIT_EXPERIMENT_ID,
        variant,
        event,
        visitorToken: browserToken(),
      }),
    });
    if (!response.ok) throw new Error(`Recruit event failed: ${response.status}`);
    writeLocalStorage(onceKey, "1");
  } catch (error) {
    if (readLocalStorage(onceKey) === "pending") removeLocalStorage(onceKey);
    throw error;
  }
}
