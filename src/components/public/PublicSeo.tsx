import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useStore } from "@/hooks/useStore";

const PAGE_LABELS: Array<{ pattern: RegExp; label: string; description: string }> = [
  { pattern: /^\/$/, label: "", description: "仙台・宮城で上質な癒しをお探しの方へ。出勤情報、料金、キャンペーン、Web予約をご案内します。" },
  { pattern: /^\/schedule\/?$/, label: "出勤情報", description: "本日・今週のセラピスト出勤スケジュールをご確認いただけます。" },
  { pattern: /^\/casts\/?$/, label: "セラピスト一覧", description: "在籍セラピストのプロフィールや最新情報をご紹介します。" },
  { pattern: /^\/casts\/[^/]+\/diary\/?$/, label: "セラピスト日記", description: "セラピストの最新日記とお知らせをご覧いただけます。" },
  { pattern: /^\/casts\/[^/]+\/?$/, label: "セラピスト詳細", description: "セラピストのプロフィール、出勤予定、日記をご案内します。" },
  { pattern: /^\/campaigns\/?$/, label: "キャンペーン・クーポン", description: "現在ご利用いただけるクーポンと期間限定イベント、キャンペーンバナーをご案内します。" },
  { pattern: /^\/(pricing|system)\/?$/, label: "料金・システム", description: "コース料金、オプション、割引などの料金システムをご案内します。" },
  { pattern: /^\/access\/?$/, label: "アクセス", description: "仙台市内のご利用エリアとアクセス情報をご案内します。" },
  { pattern: /^\/voice\/?$/, label: "お客様の声", description: "ご利用いただいたお客様から寄せられた口コミをご紹介します。" },
  { pattern: /^\/recruit-talk\/?$/, label: "セラピスト求人", description: "仙台・宮城で未経験から始められるセラピスト求人です。自由出勤、研修、プライバシー対策、応募前の相談方法をご案内します。" },
  { pattern: /^\/page\/[^/]+\/?$/, label: "お知らせ", description: "店舗からの最新情報をご案内します。" },
];

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
};

const upsertCanonical = (href: string | null) => {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    canonical?.remove();
    return;
  }
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = href;
};

export function PublicSeo() {
  const { pathname } = useLocation();
  const { store, loading } = useStore();

  useEffect(() => {
    if (loading) return;

    const page = PAGE_LABELS.find(({ pattern }) => pattern.test(pathname));
    const indexable = Boolean(page);
    const storeName = store?.name ?? "艶華";
    const origin = store?.custom_domain
      ? `https://${store.custom_domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
      : (store?.is_default ?? true)
        ? "https://enka-salon.jp"
        : window.location.origin;

    if (!indexable || !page) {
      upsertMeta('meta[name="robots"]', { name: "robots", content: "noindex,nofollow" });
      upsertMeta('meta[name="googlebot"]', { name: "googlebot", content: "noindex,nofollow" });
      upsertCanonical(null);
      document.getElementById("public-seo-jsonld")?.remove();
      return;
    }

    const title = page.label
      ? `${page.label}｜${storeName}｜仙台・宮城メンズエステ`
      : `${storeName}｜仙台・宮城のメンズエステ`;
    const description = `${storeName}は仙台・宮城のメンズエステです。${page.description}`;
    const canonicalUrl = `${origin}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;

    document.documentElement.lang = "ja";
    document.title = title;
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: "index,follow,max-image-preview:large" });
    upsertMeta('meta[name="googlebot"]', { name: "googlebot", content: "index,follow,max-image-preview:large" });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: storeName });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertCanonical(canonicalUrl);

    document.getElementById("public-seo-jsonld")?.remove();
    if (pathname === "/") {
      const script = document.createElement("script");
      script.id = "public-seo-jsonld";
      script.type = "application/ld+json";
      script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            name: storeName,
            url: `${origin}/`,
            inLanguage: "ja-JP",
          },
          {
            "@type": "LocalBusiness",
            name: storeName,
            url: `${origin}/`,
            description,
            areaServed: [
              { "@type": "City", name: "仙台市" },
              { "@type": "AdministrativeArea", name: "宮城県" },
            ],
          },
        ],
      });
      document.head.appendChild(script);
    }
  }, [loading, pathname, store]);

  return null;
}
