import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { useStoreContact } from "@/hooks/useStoreContact";
import { driveImgUrl } from "@/lib/drive";
import { format } from "date-fns";
import { Phone, Calendar, ChevronDown, ChevronLeft, ChevronRight, Sparkles, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_RESERVATION_INTERVAL_MINUTES,
  findNextAvailableStart,
  formatAvailabilityTime,
} from "@/lib/availability";

/**
 * 艶華専用トップページ（デフォルト店舗以外で "/" に表示）。
 * 大型プランバナー → 本日の出勤 → おすすめプラン → NEW FACE → 料金導線 → 店舗情報。
 */

interface CastRow {
  id: string;
  name: string;
  age: number | null;
  photo: string | null;
  join_date: string;
}

interface ShiftRow {
  id: string;
  cast_id: string;
  start_time: string;
  end_time: string;
  casts: { id: string; name: string; photo: string | null; age: number | null; is_active: boolean; is_visible: boolean } | null;
}

interface ReservationRow {
  cast_id: string;
  start_time: string;
  duration: number;
}

interface HpArticle {
  id: string;
  title: string;
  content: string | null;
  category: string;
  created_at: string;
  image_urls: string[] | null;
}

interface ActiveDiscount {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  news: "ニュース",
  coupon: "クーポン",
  schedule: "出勤情報",
  newstaff: "新人入店",
  campaign: "キャンペーン",
  tips: "ノウハウ",
  other: "お知らせ",
};

const hhmm = (t: string) => t?.slice(0, 5) ?? "";

const isVideoUrl = (url: string) => /\.(?:mp4|webm|ogg)(?:[?#].*)?$/i.test(url);

const discountLabel = (discount: ActiveDiscount) => {
  if (discount.discount_type === "percent" || discount.discount_type === "percentage") {
    return `${discount.discount_value}%OFF`;
  }
  return discount.discount_value > 0
    ? `${discount.discount_value.toLocaleString()}円OFF`
    : "特典あり";
};

const LinkedParagraph = ({ text }: { text: string }) => {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  return (
    <p>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all underline underline-offset-2"
            style={{ color: "var(--pub-accent-light,#f2a0bc)" }}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
};

const ENKA_EVENT_HERO_VIDEO = {
  enabled: true,
  url: "https://enka-w-videos.saito-crow.chatgpt.site/videos/teaser.mp4",
  poster_url: "https://enka-w-videos.saito-crow.chatgpt.site/posters/teaser.jpg",
} as const;

export default function EnkaHome() {
  const { store, storeId } = useStore();
  const { telHref, phoneDisplay, lineUrl, hours } = useStoreContact();
  const storeName = store?.name ?? "艶華";
  const storeSettings = store?.settings ?? {};
  const tagline = typeof storeSettings.tagline === "string" ? storeSettings.tagline : "艶やかに、咲き誇る。";
  const banners = Array.isArray(storeSettings.hero_banners)
    ? storeSettings.hero_banners.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  // PLANにはプランに関係する3枚目以降だけを表示する。
  const planBanners = banners.slice(2);

  // イベント動画を既定表示し、stores.settings.hero_video でURLや表示可否を上書きできる。
  // イベント終了後は { enabled: false } にするだけで通常のバナーへ戻せる。
  const configuredHeroVideo =
    typeof storeSettings.hero_video === "object" && storeSettings.hero_video !== null
      ? (storeSettings.hero_video as Record<string, unknown>)
      : {};
  const heroVideoSettings = { ...ENKA_EVENT_HERO_VIDEO, ...configuredHeroVideo };
  const heroVideoEnabled = heroVideoSettings.enabled === true;
  const heroVideoUrl = typeof heroVideoSettings.url === "string" ? heroVideoSettings.url.trim() : "";
  const heroVideoPosterUrl =
    typeof heroVideoSettings.poster_url === "string" ? heroVideoSettings.poster_url.trim() : "";
  const siteUrl = store?.custom_domain ? `https://${store.custom_domain}` : window.location.origin;

  const [slide, setSlide] = useState(0);
  const [failedHeroVideoUrl, setFailedHeroVideoUrl] = useState<string | null>(null);
  const [todayShifts, setTodayShifts] = useState<ShiftRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [intervalMinutes, setIntervalMinutes] = useState(DEFAULT_RESERVATION_INTERVAL_MINUTES);
  const [newFaces, setNewFaces] = useState<CastRow[]>([]);
  const [articles, setArticles] = useState<HpArticle[]>([]);
  const [activeDiscounts, setActiveDiscounts] = useState<ActiveDiscount[]>([]);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  useEffect(() => { document.title = `${storeName}｜仙台・宮城のメンズエステ`; }, [storeName]);

  const showHeroVideo =
    heroVideoEnabled && heroVideoUrl.length > 0 && failedHeroVideoUrl !== heroVideoUrl;

  useEffect(() => {
    if (showHeroVideo || banners.length < 2) return;
    const t = setInterval(() => setSlide((p) => (p + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length, showHeroVideo]);

  useEffect(() => {
    if (!storeId) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    Promise.all([
      supabase
        .from("shifts")
        .select("id, cast_id, start_time, end_time, casts (id, name, photo, age, is_active, is_visible)")
        .eq("shift_date", today)
        .eq("store_id", storeId)
        .order("start_time"),
      supabase.rpc("get_reservation_slots", { p_date: today, p_cast_id: null }),
      supabase
        .from("shop_settings")
        .select("reservation_interval_minutes")
        .eq("store_id", storeId)
        .limit(1)
        .maybeSingle(),
    ]).then(([shiftResult, reservationResult, settingsResult]) => {
        const data = shiftResult.data;
        const seen = new Set<string>();
        setTodayShifts(
          ((data ?? []) as unknown as ShiftRow[]).filter((s) => {
            if (!s.casts?.is_active || !s.casts?.is_visible || seen.has(s.cast_id)) return false;
            seen.add(s.cast_id);
            return true;
          }),
        );
        setReservations(
          ((reservationResult.data as any[]) ?? []).map((reservation) => ({
            cast_id: reservation.cast_id,
            start_time: reservation.start_time,
            duration: reservation.duration,
          })),
        );
        setIntervalMinutes(
          settingsResult.data?.reservation_interval_minutes
            ?? DEFAULT_RESERVATION_INTERVAL_MINUTES,
        );
      });

    supabase
      .from("casts")
      .select("id, name, age, photo, join_date")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .eq("is_visible", true)
      .gte("join_date", format(monthAgo, "yyyy-MM-dd"))
      .order("join_date", { ascending: false })
      .limit(8)
      .then(({ data }) => setNewFaces((data ?? []) as CastRow[]));

    supabase
      .from("hp_articles")
      .select("id, title, content, category, created_at, image_urls")
      .eq("store_id", storeId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setArticles((data ?? []) as HpArticle[]));

    supabase
      .from("discounts")
      .select("id, name, discount_type, discount_value")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .order("discount_value", { ascending: false })
      .then(({ data }) => setActiveDiscounts((data ?? []) as ActiveDiscount[]));
  }, [storeId]);

  const featuredDiscount = activeDiscounts[0] ?? null;

  const nextAvailable = (shift: ShiftRow): string | null => {
    const now = new Date();
    const [startHour, startMinute] = shift.start_time.split(":").map(Number);
    const [endHour, endMinute] = shift.end_time.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const endRaw = endHour * 60 + endMinute;
    const end = endRaw <= start ? endRaw + 24 * 60 : endRaw;
    const currentRaw = now.getHours() * 60 + now.getMinutes();
    const current = endRaw <= start && currentRaw < endRaw ? currentRaw + 24 * 60 : currentRaw;
    const reservedBlocks = reservations
      .filter((reservation) => reservation.cast_id === shift.cast_id)
      .map((reservation) => {
        const [hour, minute] = reservation.start_time.split(":").map(Number);
        const rawStart = hour * 60 + minute;
        const reservedStart = rawStart < start ? rawStart + 24 * 60 : rawStart;
        return {
          start: reservedStart,
          duration: reservation.duration,
        };
      });
    const availableStart = findNextAvailableStart({
      shiftStart: start,
      shiftEnd: end,
      currentTime: current,
      reservations: reservedBlocks,
      intervalMinutes,
    });
    return availableStart === null ? null : formatAvailabilityTime(availableStart);
  };

  const Heading = ({ en, ja }: { en: string; ja: string }) => (
    <div className="text-center mb-6">
      <h2
        className="text-2xl md:text-3xl font-bold"
        style={{ color: "var(--pub-text,#f7e9f0)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.25em" }}
      >
        {en}
      </h2>
      <p className="text-xs mt-1" style={{ color: "var(--pub-text-muted,#a98496)" }}>{ja}</p>
      <div
        className="w-16 h-px mx-auto mt-3"
        style={{ background: "linear-gradient(90deg, transparent, var(--pub-accent,#d4547a), transparent)" }}
      />
    </div>
  );

  const CastCard = ({ id, name, age, photo, time, nextTime }: { id: string; name: string; age: number | null; photo: string | null; time?: string; nextTime?: string | null }) => (
    <Link to={`/casts/${id}`} className="shrink-0 w-36 md:w-44">
      <div
        className="rounded-xl overflow-hidden border"
        style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "var(--pub-card,#211320)" }}
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          {photo ? (
            <img src={driveImgUrl(photo, 400)} alt={name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "var(--pub-card2,#2b1a28)" }}>
              <Sparkles size={22} style={{ color: "var(--pub-accent,#d4547a)" }} />
            </div>
          )}
          {nextTime && (
            <span
              className="absolute right-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-lg"
              style={{ backgroundColor: "var(--pub-accent,#d4547a)" }}
            >
              最短 {nextTime}
            </span>
          )}
        </div>
        <div className="px-2.5 py-2 text-center">
          <p className="text-sm font-bold truncate" style={{ color: "var(--pub-text,#f7e9f0)" }}>
            {name}
            {age != null && <span className="text-xs font-normal ml-1" style={{ color: "var(--pub-text-muted,#a98496)" }}>({age})</span>}
          </p>
          {time && <p className="text-[11px] mt-0.5" style={{ color: "var(--pub-accent-light,#f2a0bc)" }}>{time}</p>}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#150a11)" }}>
      <PublicNavigation />

      {/* 1. トップ広告：動画を有効化するとスライドを停止して差し替える */}
      {showHeroVideo ? (
        <div className="relative w-full" style={{ aspectRatio: "2 / 1", backgroundColor: "var(--pub-bg,#150a11)" }}>
          <video
            key={heroVideoUrl}
            src={heroVideoUrl}
            poster={heroVideoPosterUrl || undefined}
            className="h-full w-full object-contain"
            aria-label={`${storeName} 8月13日から15日のイベント動画広告`}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setFailedHeroVideoUrl(heroVideoUrl)}
          >
            お使いのブラウザは動画再生に対応していません。
          </video>
        </div>
      ) : banners.length > 0 ? (
        <div className="relative" style={{ backgroundColor: "var(--pub-bg,#150a11)" }}>
          <Link to="/system">
            <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
              {/* クロスフェード切替（全バナーを重ねて不透明度で遷移） */}
              {banners.map((b, i) => (
                <img
                  key={b}
                  src={b}
                  alt={`${storeName} プランバナー${i + 1}`}
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 ease-in-out"
                  style={{ opacity: slide === i ? 1 : 0 }}
                />
              ))}
            </div>
          </Link>
          {banners.length > 1 && (
            <>
              <button
                onClick={() => setSlide((p) => (p - 1 + banners.length) % banners.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white"
                aria-label="前のバナー"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setSlide((p) => (p + 1) % banners.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white"
                aria-label="次のバナー"
              >
                <ChevronRight size={18} />
              </button>
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{ backgroundColor: slide === i ? "var(--pub-accent,#d4547a)" : "rgba(255,255,255,.35)" }}
                    aria-label={`バナー${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* ブランドライン */}
      <div className="text-center py-8 px-4">
        <p className="text-xs tracking-[0.28em]" style={{ color: "var(--pub-text-muted,#a98496)" }}>仙台・宮城のメンズエステ</p>
        <h1
          className="text-3xl md:text-4xl font-bold mt-2"
          style={{ color: "var(--pub-accent,#d4547a)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}
        >
          {storeName}
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--pub-text-mid,#dfc0cf)", letterSpacing: "0.3em" }}>{tagline}</p>
      </div>

      {/* 毎日自動更新される店舗ニュース */}
      {articles.length > 0 && (
        <section className="px-4 py-8" style={{ backgroundColor: "var(--pub-card,#211320)" }}>
          <div className="container mx-auto max-w-3xl">
            <Heading en="NEWS" ja="艶華からのお知らせ" />
            {featuredDiscount && (
              <div
                className="mb-4 flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center"
                style={{ borderColor: "var(--pub-accent,#d4547a)", backgroundColor: "var(--pub-accent-a10,#d4547a1a)" }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <TicketPercent size={24} className="shrink-0" style={{ color: "var(--pub-accent-light,#f2a0bc)" }} />
                  <div className="min-w-0">
                    <p className="text-[11px]" style={{ color: "var(--pub-text-muted,#a98496)" }}>予約時に使えるクーポン</p>
                    <p className="font-bold" style={{ color: "var(--pub-text,#f7e9f0)" }}>
                      {featuredDiscount.name} <span style={{ color: "var(--pub-accent-light,#f2a0bc)" }}>{discountLabel(featuredDiscount)}</span>
                    </p>
                  </div>
                </div>
                <Link
                  to="/booking"
                  className="shrink-0 rounded-lg px-4 py-2.5 text-center text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--pub-accent,#d4547a)" }}
                >
                  クーポンを使って予約
                </Link>
              </div>
            )}
            <div className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "var(--pub-bg,#150a11)" }}>
              {articles.map((article) => {
                const expanded = expandedArticle === article.id;
                const mediaUrls = article.image_urls ?? [];
                const videoUrls = mediaUrls.filter(isVideoUrl);
                const imageUrls = mediaUrls.filter((url) => !isVideoUrl(url));
                return (
                  <article key={article.id} className="px-4 py-3" style={{ borderColor: "var(--pub-border,#4a2740)" }}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 text-left"
                      onClick={() => setExpandedArticle(expanded ? null : article.id)}
                      aria-expanded={expanded}
                    >
                      <time className="shrink-0 pt-0.5 text-xs" style={{ color: "var(--pub-text-muted,#a98496)" }} dateTime={article.created_at}>
                        {new Date(article.created_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                      </time>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: "var(--pub-accent-a10,#d4547a1a)", color: "var(--pub-accent-light,#f2a0bc)" }}>
                        {CATEGORY_LABEL[article.category] ?? "お知らせ"}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{article.title}</span>
                      <ChevronDown size={16} className={`mt-0.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} style={{ color: "var(--pub-text-muted,#a98496)" }} />
                    </button>
                    {expanded && (
                      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--pub-border,#4a2740)" }}>
                        {videoUrls.length > 0 && (
                          <div className="mb-4 space-y-3">
                            {videoUrls.map((url) => (
                              <video
                                key={url}
                                src={url}
                                controls
                                playsInline
                                preload="metadata"
                                className="aspect-video w-full rounded-lg border object-contain"
                                style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "#000" }}
                              >
                                お使いのブラウザは動画再生に対応していません。
                              </video>
                            ))}
                          </div>
                        )}
                        {imageUrls.length > 0 && (
                          <div className="mb-4 flex gap-2 overflow-x-auto">
                            {imageUrls.map((url, index) => (
                              <img key={url} src={url} alt={`${article.title} ${index + 1}`} loading="lazy" className="h-36 w-auto shrink-0 rounded-lg object-cover" />
                            ))}
                          </div>
                        )}
                        {article.content && (
                          <div className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--pub-text-mid,#dfc0cf)" }}>
                            {article.content
                              .replace(/^#{1,6}\s+/gm, "")
                              .replace(/\*\*/g, "")
                              .split(/\n+/)
                              .filter(Boolean)
                              .map((paragraph, index) => (
                                <LinkedParagraph key={index} text={paragraph.replace(/^[-*]\s+/, "・")} />
                              ))}
                          </div>
                        )}
                        <div
                          className="mt-5 rounded-xl border p-3"
                          style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "var(--pub-card,#211320)" }}
                        >
                          {featuredDiscount && (
                            <p className="mb-3 text-center text-sm font-bold" style={{ color: "var(--pub-accent-light,#f2a0bc)" }}>
                              {featuredDiscount.name}で{discountLabel(featuredDiscount)}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <Link
                              to="/booking"
                              className="rounded-lg px-3 py-2.5 text-center text-sm font-bold text-white"
                              style={{ backgroundColor: "var(--pub-accent,#d4547a)" }}
                            >
                              Web予約・空き状況
                            </Link>
                            <Link
                              to="/campaigns"
                              className="rounded-lg border px-3 py-2.5 text-center text-sm font-bold"
                              style={{ borderColor: "var(--pub-accent,#d4547a)", color: "var(--pub-text,#f7e9f0)" }}
                            >
                              クーポン詳細
                            </Link>
                          </div>
                          {lineUrl && (
                            <a
                              href={lineUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 block text-center text-xs underline underline-offset-4"
                              style={{ color: "var(--pub-text-mid,#dfc0cf)" }}
                            >
                              LINEで予約・相談する
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 2. 本日の出勤 */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <Heading en="TODAY" ja="本日の出勤" />
          {todayShifts.length === 0 ? (
            <p className="text-center text-sm py-6" style={{ color: "var(--pub-text-muted,#a98496)" }}>
              本日の出勤情報は準備中です
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {todayShifts.map((s) => (
                <CastCard
                  key={s.id}
                  id={s.casts!.id}
                  name={s.casts!.name}
                  age={s.casts!.age}
                  photo={s.casts!.photo}
                  time={`${hhmm(s.start_time)} - ${hhmm(s.end_time)}`}
                  nextTime={nextAvailable(s)}
                />
              ))}
            </div>
          )}
          <div className="text-center mt-5">
            <Link to="/schedule">
              <Button
                variant="outline"
                className="bg-transparent"
                style={{ borderColor: "var(--pub-accent,#d4547a)", color: "var(--pub-text,#f7e9f0)" }}
              >
                出勤スケジュールを見る
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 3. おすすめプラン（バナー縦積み） */}
      {planBanners.length > 0 && (
        <section className="py-8 px-4" style={{ backgroundColor: "var(--pub-card,#211320)" }}>
          <div className="container mx-auto max-w-2xl">
            <Heading en="PLAN" ja="おすすめプラン" />
            <div className="space-y-4">
              {planBanners.map((b, i) => (
                <Link key={i} to="/booking" className="block rounded-xl overflow-hidden border" style={{ borderColor: "var(--pub-border,#4a2740)" }}>
                  <img src={b} alt={`${storeName} プラン${i + 1}`} loading="lazy" className="w-full h-auto" />
                </Link>
              ))}
            </div>
            <p className="text-center text-xs mt-4" style={{ color: "var(--pub-text-muted,#a98496)" }}>
              バナーをタップでWeb予約へ
            </p>
          </div>
        </section>
      )}

      {/* 4. NEW FACE */}
      {newFaces.length > 0 && (
        <section className="py-8 px-4">
          <div className="container mx-auto max-w-5xl">
            <Heading en="NEW FACE" ja="新人セラピスト" />
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {newFaces.map((c) => (
                <CastCard key={c.id} id={c.id} name={c.name} age={c.age} photo={c.photo} />
              ))}
            </div>
            <div className="text-center mt-5">
              <Link to="/casts">
                <Button
                  variant="outline"
                  className="bg-transparent"
                  style={{ borderColor: "var(--pub-accent,#d4547a)", color: "var(--pub-text,#f7e9f0)" }}
                >
                  セラピスト一覧を見る
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. 料金・システム導線 */}
      <section className="py-10 px-4" style={{ backgroundColor: "var(--pub-card,#211320)" }}>
        <div className="container mx-auto max-w-2xl text-center">
          <Heading en="SYSTEM" ja="料金システム" />
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[["60分", "¥15,000"], ["80分", "¥19,000"], ["100分", "¥24,000"]].map(([d, p]) => (
              <div key={d} className="rounded-xl border py-4" style={{ borderColor: "var(--pub-border,#4a2740)", backgroundColor: "var(--pub-bg,#150a11)" }}>
                <p className="text-xs" style={{ color: "var(--pub-text-muted,#a98496)" }}>艶華コース {d}</p>
                <p className="text-lg font-bold mt-1" style={{ color: "var(--pub-accent-light,#f2a0bc)" }}>{p}</p>
              </div>
            ))}
          </div>
          <p className="text-sm mb-5" style={{ color: "var(--pub-text-mid,#dfc0cf)" }}>
            お得なオプションパック <span className="font-bold" style={{ color: "var(--pub-accent,#d4547a)" }}>-桜- ・ -牡丹-</span> もご用意
          </p>
          <Link to="/system">
            <Button
              size="lg"
              className="min-w-[220px]"
              style={{ backgroundColor: "var(--pub-accent,#d4547a)", color: "#fff" }}
            >
              料金の詳細を見る
            </Button>
          </Link>
        </div>
      </section>

      {/* 6. 店舗情報 */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-2xl">
          <Heading en="SHOP" ja="店舗情報" />
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--pub-border,#4a2740)" }}>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["店舗名", storeName],
                  ["URL", siteUrl],
                  ["営業時間", hours ?? "12:00〜26:00（25:00最終受付）"],
                  ["TEL", phoneDisplay],
                  ["最寄り駅", "北四番丁駅｜勾当台公園駅｜仙台駅"],
                  ["エリア", "マンション（個室）"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b last:border-b-0" style={{ borderColor: "var(--pub-border,#4a2740)" }}>
                    <td className="py-3 px-4 font-bold w-1/3 align-top" style={{ color: "var(--pub-text,#f7e9f0)", backgroundColor: "var(--pub-card2,#2b1a28)" }}>{k}</td>
                    <td className="py-3 px-4" style={{ color: "var(--pub-text-mid,#dfc0cf)" }}>
                      {k === "TEL" ? <a href={telHref} className="hover:underline">{v}</a>
                        : k === "URL" ? <a href={v as string} className="hover:underline" style={{ color: "var(--pub-accent,#d4547a)" }}>{v}</a>
                        : v}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs mt-3" style={{ color: "var(--pub-text-muted,#a98496)" }}>
            <Link to="/system" className="hover:underline">特定商取引法に基づく表示は料金ページ下部をご覧ください</Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 px-4 text-center" style={{ backgroundColor: "var(--pub-card,#211320)" }}>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={telHref}>
            <Button size="lg" className="gap-2 min-w-[210px]" style={{ backgroundColor: "var(--pub-accent,#d4547a)", color: "#fff" }}>
              <Phone size={18} />電話で予約
            </Button>
          </a>
          {lineUrl && (
            <a href={lineUrl} target="_blank" rel="noreferrer">
              <Button size="lg" className="gap-2 min-w-[210px] bg-[#06c755] hover:bg-[#05b34c] text-white">
                LINEで予約
              </Button>
            </a>
          )}
          <Link to="/booking">
            <Button
              size="lg"
              variant="outline"
              className="gap-2 min-w-[210px] bg-transparent"
              style={{ borderColor: "var(--pub-accent,#d4547a)", color: "var(--pub-text,#f7e9f0)" }}
            >
              <Calendar size={18} />Web予約
            </Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
}
