import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Megaphone, TicketPercent } from "lucide-react";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
  title: string | null;
  display_order: number;
}

interface Discount {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
}

interface CampaignArticle {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
}

const fallbackCoupons: Discount[] = [
  { id: "advance", name: "事前予約割", discount_type: "details", discount_value: 0 },
  { id: "referral", name: "紹介割", discount_type: "details", discount_value: 0 },
];

const discountLabel = (discount: Discount) => {
  if (discount.discount_type === "percent" || discount.discount_type === "percentage") {
    return `${discount.discount_value}% OFF`;
  }
  if (discount.discount_value > 0) return `${discount.discount_value.toLocaleString()}円 OFF`;
  return "詳細はお問い合わせください";
};

const summary = (content: string | null) =>
  (content ?? "")
    .replace(/[#*`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

export default function Campaigns() {
  const { store, storeId, loading: storeLoading } = useStore();
  const storeName = store?.name ?? "全力エステ 仙台";
  const [banners, setBanners] = useState<Banner[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [events, setEvents] = useState<CampaignArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeLoading) return;

    const fetchCampaigns = async () => {
      setLoading(true);
      const [bannerResult, discountResult, eventResult] = await Promise.all([
        supabase
          .from("banners")
          .select("id, image_url, link_url, title, display_order")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("discounts")
          .select("id, name, discount_type, discount_value")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("hp_articles")
          .select("id, title, content, created_at")
          .eq("store_id", storeId)
          .eq("is_published", true)
          .eq("category", "campaign")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      const databaseBanners = (bannerResult.data ?? []) as Banner[];
      const configuredHeroBanners = store?.settings.hero_banners;
      const heroBanners = Array.isArray(configuredHeroBanners)
        ? configuredHeroBanners.filter((value): value is string => typeof value === "string" && value.length > 0)
        : [];
      setBanners(databaseBanners.length > 0 ? databaseBanners : heroBanners.map((imageUrl, index) => ({
        id: `hero-${index}`,
        image_url: imageUrl,
        link_url: "/booking",
        title: null,
        display_order: index,
      })));
      setDiscounts((discountResult.data ?? []) as Discount[]);
      setEvents((eventResult.data ?? []) as CampaignArticle[]);
      setLoading(false);
    };

    fetchCampaigns();
  }, [store, storeId, storeLoading]);

  const coupons = discounts.length > 0 ? discounts : fallbackCoupons;

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#150a11)", color: "var(--pub-text,#f7e9f0)" }}>
      <PublicNavigation />

      <header className="px-4 py-10 text-center" style={{ background: "linear-gradient(180deg, var(--pub-card,#211320), var(--pub-bg,#150a11))" }}>
        <p className="text-xs tracking-[0.35em]" style={{ color: "var(--pub-accent-light,#f2a0bc)" }}>CAMPAIGN</p>
        <h1 className="mt-2 text-2xl font-bold md:text-4xl" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          キャンペーン一覧
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--pub-text-mid,#dfc0cf)" }}>
          {storeName}のクーポン、期間限定イベント、お得なご案内をまとめています。
        </p>
      </header>

      <main className="container mx-auto max-w-3xl space-y-12 px-4 py-8">
        <section aria-labelledby="campaign-banner-heading">
          <h2 id="campaign-banner-heading" className="sr-only">キャンペーンバナー</h2>
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--pub-text-muted,#a98496)" }}>キャンペーンを読み込んでいます…</div>
          ) : banners.length > 0 ? (
            <div className="space-y-5">
              {banners.map((banner) => {
                const image = (
                  <img
                    src={banner.image_url}
                    alt={banner.title || `${storeName} キャンペーン`}
                    loading="lazy"
                    className="block h-auto w-full"
                  />
                );
                return (
                  <article key={banner.id} className="overflow-hidden rounded-xl border shadow-lg" style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "var(--pub-card,#211320)" }}>
                    {banner.link_url ? (
                      <a href={banner.link_url} target={banner.link_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{image}</a>
                    ) : image}
                    {banner.title && <p className="px-4 py-3 text-sm font-medium">{banner.title}</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-5 py-12 text-center" style={{ borderColor: "var(--pub-border,#4a2740)", color: "var(--pub-text-muted,#a98496)" }}>
              現在公開中のキャンペーンバナーはありません。
            </div>
          )}
        </section>

        <section aria-labelledby="coupon-heading">
          <div className="mb-5 flex items-center justify-center gap-2">
            <TicketPercent size={20} style={{ color: "var(--pub-accent,#d4547a)" }} />
            <h2 id="coupon-heading" className="text-xl font-bold">ご利用いただけるクーポン</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="rounded-xl border p-4" style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "var(--pub-card,#211320)" }}>
                <div className="flex items-start gap-3">
                  <Gift size={18} className="mt-0.5 shrink-0" style={{ color: "var(--pub-accent,#d4547a)" }} />
                  <div>
                    <h3 className="font-bold">{coupon.name}</h3>
                    <p className="mt-1 text-sm" style={{ color: "var(--pub-accent-light,#f2a0bc)" }}>{discountLabel(coupon)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs" style={{ color: "var(--pub-text-muted,#a98496)" }}>
            適用条件や併用可否は、ご予約時にご確認ください。
          </p>
        </section>

        {events.length > 0 && (
          <section aria-labelledby="event-heading">
            <div className="mb-5 flex items-center justify-center gap-2">
              <Megaphone size={20} style={{ color: "var(--pub-accent,#d4547a)" }} />
              <h2 id="event-heading" className="text-xl font-bold">イベント情報</h2>
            </div>
            <div className="space-y-3">
              {events.map((event) => (
                <article key={event.id} className="rounded-xl border p-4" style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "var(--pub-card,#211320)" }}>
                  <time className="text-xs" style={{ color: "var(--pub-text-muted,#a98496)" }} dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleDateString("ja-JP")}
                  </time>
                  <h3 className="mt-1 font-bold">{event.title}</h3>
                  {summary(event.content) && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--pub-text-mid,#dfc0cf)" }}>{summary(event.content)}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="text-center">
          <Link to="/booking">
            <Button size="lg" style={{ backgroundColor: "var(--pub-accent,#d4547a)", color: "#fff" }}>キャンペーンを使って予約する</Button>
          </Link>
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
}
