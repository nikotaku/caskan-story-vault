import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Store {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  theme_color: string | null;
  settings: Record<string, unknown>;
  is_default: boolean;
  custom_domain?: string | null;
}

// デフォルト店舗（既存データはすべてこの店舗に帰属）
export const DEFAULT_STORE_ID = "00000000-0000-0000-0000-000000000001";

interface StoreContextValue {
  store: Store | null;
  storeId: string;
  loading: boolean;
}

const StoreContext = createContext<StoreContextValue>({
  store: null,
  storeId: DEFAULT_STORE_ID,
  loading: true,
});

// localhost / IP / *.vercel.app はドメイン解決の対象外（デフォルト店舗扱い）
function isGenericHost(host: string): boolean {
  return host === "localhost" || /^[\d.]+$/.test(host) || host.endsWith(".vercel.app");
}

// サブドメインから店舗スラッグを判定。
// apex / www はデフォルト店舗扱い（null）※独自ドメインは custom_domain で別途解決する
function getSubdomainSlug(): string | null {
  const host = window.location.hostname;
  if (isGenericHost(host)) return null;
  const parts = host.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (sub === "www") return null;
  return sub;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolve = async () => {
      const slug = getSubdomainSlug();
      let data: Store | null = null;

      // プレビュー確認用の店舗強制指定（?store=slug）。プレビューURLでは
      // ホスト名から店舗を判定できないため、検証時のみ使用する。
      const forcedSlug = new URLSearchParams(window.location.search).get("store");
      if (forcedSlug) {
        const { data: byForced } = await supabase
          .from("stores" as any)
          .select("*")
          .eq("slug", forcedSlug)
          .eq("is_active", true)
          .maybeSingle();
        data = byForced as unknown as Store | null;
      }

      // 独自ドメイン（stores.custom_domain、www有無どちらでも）で店舗を解決
      const host = window.location.hostname;
      if (!data && !isGenericHost(host)) {
        const bare = host.replace(/^www\./, "");
        const { data: byDomain } = await supabase
          .from("stores" as any)
          .select("*")
          .eq("custom_domain", bare)
          .eq("is_active", true)
          .maybeSingle();
        data = byDomain as unknown as Store | null;
      }

      if (!data && slug) {
        const { data: bySlug } = await supabase
          .from("stores" as any)
          .select("*")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();
        data = bySlug as unknown as Store | null;
      }

      if (!data) {
        const { data: byDefault } = await supabase
          .from("stores" as any)
          .select("*")
          .eq("is_default", true)
          .maybeSingle();
        data = byDefault as unknown as Store | null;
      }

      // 店舗ごとのファビコン（stores.settings.favicon にパスを設定）
      const favicon = (data?.settings as any)?.favicon;
      if (favicon) {
        document
          .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
          .forEach((link) => { link.href = favicon; });
      }

      if (data?.theme_color) {
        // shadcn の --primary を店舗テーマ色（HSL値）で上書き
        document.documentElement.style.setProperty("--primary", data.theme_color);
      }

      // 公開ページ用パレット（settings.public_theme）をCSS変数として適用。
      // 未設定の店舗はコード側の既定配色が使われる。
      const theme = (data?.settings as any)?.public_theme;
      if (theme) {
        const root = document.documentElement.style;
        const KEY_MAP: Record<string, string> = {
          bg: "--pub-bg", card: "--pub-card", card2: "--pub-card2", border: "--pub-border",
          accent: "--pub-accent", accent_deep: "--pub-accent-deep", accent_light: "--pub-accent-light",
          text: "--pub-text", text_mid: "--pub-text-mid", text_muted: "--pub-text-muted",
          light_bg: "--pub-light-bg", light_accent: "--pub-light-accent", light_accent_deep: "--pub-light-accent-deep",
          light_text: "--pub-light-text", light_text_muted: "--pub-light-text-muted", light_text_strong: "--pub-light-text-strong",
          light_border: "--pub-light-border", light_soft: "--pub-light-soft",
          light_photo: "--pub-light-photo", light_photo2: "--pub-light-photo2",
          dark: "--pub-dark", dark_border: "--pub-dark-border",
        };
        for (const [key, cssVar] of Object.entries(KEY_MAP)) {
          if (typeof theme[key] === "string") root.setProperty(cssVar, theme[key]);
        }
        // 不透明度付きバリアント（8桁hexでアルファを焼き込む）
        if (theme.accent) {
          root.setProperty("--pub-accent-a10", `${theme.accent}1a`);
          root.setProperty("--pub-accent-a40", `${theme.accent}66`);
          root.setProperty("--pub-accent-a50", `${theme.accent}80`);
          root.setProperty("--pub-accent-a60", `${theme.accent}99`);
        }
        if (theme.border) root.setProperty("--pub-border-a60", `${theme.border}99`);
        if (theme.dark_border) root.setProperty("--pub-dark-border-a60", `${theme.dark_border}99`);
        if (theme.light_accent) root.setProperty("--pub-light-accent-a10", `${theme.light_accent}1a`);
        if (theme.light_bg) root.setProperty("--pub-light-bg-a50", `${theme.light_bg}80`);
      }

      setStore(data);
      setLoading(false);
    };
    resolve();
  }, []);

  return (
    <StoreContext.Provider value={{ store, storeId: store?.id ?? DEFAULT_STORE_ID, loading }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
