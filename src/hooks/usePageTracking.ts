import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";

const PUBLIC_PATHS: string[] = [
  "/", "/lp", "/system", "/campaigns", "/pricing", "/access", "/booking",
  "/survey", "/review", "/review-maker", "/voice", "/recruit-talk", "/haru",
];
const PUBLIC_PREFIXES: string[] = ["/schedule", "/casts", "/page/", "/book/", "/r/"];
// /system は公開ページ（/system/... は管理画面なので除外）

interface Attribution {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  referrerHost: string;
}

const ATTRIBUTION_KEY = "traffic_attribution";

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  return PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

function isBot(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|ia_archiver|semrushbot|ahrefsbot/.test(ua);
}

function compact(value: string | null, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

function readLandingAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  let referrerHost = "";
  try {
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      const currentHost = window.location.hostname.replace(/^www\./, "").toLowerCase();
      const candidate = referrer.hostname.replace(/^www\./, "").toLowerCase();
      if (candidate && candidate !== currentHost) referrerHost = candidate;
    }
  } catch {
    // Invalid or blocked referrers are treated as direct traffic.
  }
  return {
    source: compact(params.get("utm_source"), 120),
    medium: compact(params.get("utm_medium"), 120),
    campaign: compact(params.get("utm_campaign"), 160),
    content: compact(params.get("utm_content"), 160),
    referrerHost,
  };
}

function getSessionItem(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function setSessionItem(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { /* storage may be blocked */ }
}

function getLocalItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function setLocalItem(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage may be blocked */ }
}

export function usePageTracking() {
  const location = useLocation();
  const { storeId, loading: storeLoading } = useStore();

  useEffect(() => {
    if (storeLoading) return;
    if (!isPublicPath(location.pathname)) return;
    if (isBot()) return;

    // 同一タブ内でのセッション（新規タブ=新規セッション）
    const isNewSession = !getSessionItem("tracked");
    if (isNewSession) setSessionItem("tracked", "1");

    let attribution = readLandingAttribution(location.search);
    if (isNewSession) {
      setSessionItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    } else {
      try {
        const saved = getSessionItem(ATTRIBUTION_KEY);
        if (saved) attribution = { ...attribution, ...JSON.parse(saved) } as Attribution;
      } catch {
        // Keep the current-page attribution if saved data is malformed.
      }
    }

    // 日次ユニーク訪問者（同一ブラウザ・同一日は1カウント）
    const today = new Date().toISOString().slice(0, 10);
    const visitorKey = `last_visit:${storeId}`;
    const lastDate = getLocalItem(visitorKey);
    const isNewDailyVisitor = lastDate !== today;
    if (isNewDailyVisitor) setLocalItem(visitorKey, today);

    supabase
      .rpc("record_page_view", {
        p_path: location.pathname,
        p_store_id: storeId,
        p_is_new_session: isNewSession,
        p_is_new_daily_visitor: isNewDailyVisitor,
        p_utm_source: attribution.source || null,
        p_utm_medium: attribution.medium || null,
        p_utm_campaign: attribution.campaign || null,
        p_utm_content: attribution.content || null,
        p_referrer_host: attribution.referrerHost || null,
      })
      .then(() => {}, () => {});
  }, [location.pathname, location.search, storeId, storeLoading]);
}
