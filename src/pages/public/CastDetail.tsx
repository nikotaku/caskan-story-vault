import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { ArrowLeft, Phone, Calendar, Camera } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { driveImgUrl } from "@/lib/drive";
import { useStoreContact } from "@/hooks/useStoreContact";
import { useStore } from "@/hooks/useStore";
import { getBookingKey } from "@/lib/bookingUrl";
import { ReviewStars } from "@/components/public/ReviewStars";
import { ReviewCategoryScores } from "@/components/public/ReviewCategoryScores";

interface Cast {
  id: string;
  name: string;
  age: number | null;
  height: number | null;
  bust_size: string | null;
  body_size: string | null;
  blood_type: string | null;
  therapist_years: number | null;
  type: string;
  status: string;
  photo: string | null;
  photos: string[] | null;
  profile: string | null;
  message: string | null;
  favorite_techniques: string | null;
  favorite_food: string | null;
  celebrity_lookalike: string | null;
  day_off_activities: string | null;
  hobbies: string | null;
  ideal_type: string | null;
  room: string | null;
  x_account: string | null;
  instagram_url: string | null;
  line_url: string | null;
  litlink_url: string | null;
  o2_url: string | null;
  estama_profile_url: string | null;
  blog_url: string | null;
  skebiy_url: string | null;
  tags: string[] | null;
  shop_comment: string | null;
}

interface TherapistProfile {
  self_introduction: string | null;
  comment: string | null;
  hobbies: string | null;
  special_skills: string | null;
  preferred_type: string | null;
  mbti: string | null;
  career_history: string | null;
  massage_skills: string | null;
  training_count: number | null;
}

interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  body: string;
  visit_date: string | null;
  course: string | null;
  created_at: string;
  title: string | null;
  source_provider: string | null;
  source_url: string | null;
  source_details: unknown;
}

interface CustomerReviewRow {
  id: string;
  rating: number | string | null;
  therapist_name: string | null;
  review_text: string | null;
  created_at: string;
  reviewer_name: string | null;
  review_title: string | null;
  reviewed_at: string | null;
  source_provider: string | null;
  source_url: string | null;
  source_details: unknown;
}

interface ProfileJson {
  age?: number;
  height?: number;
  weight?: number;
  blood_type?: string;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  working: { text: "接客中", color: "#ef4444" },
  waiting: { text: "待機中", color: "#22c55e" },
  offline: { text: "退勤", color: "#9ca3af" },
};

const SectionHeader = ({ label, sub }: { label: string; sub?: string }) => (
  <div className="px-5 py-3 border-b border-[var(--pub-border,#3a2f1c)]" style={{ background: "#2a2320" }}>
    <h3 className="text-sm font-bold tracking-widest" style={{ color: "var(--pub-accent,#c6a15b)" }}>{label}</h3>
    {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--pub-text,#f0e6d2)" }}>{sub}</p>}
  </div>
);

const CastDetail = () => {
  const { store, storeId } = useStore();
  const { telHref } = useStoreContact();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cast, setCast] = useState<Cast | null>(null);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fetchAll = useCallback(async () => {
    try {
      const [castRes, profileRes] = await Promise.all([
        supabase.from("casts").select("id,name,age,height,bust_size,body_size,blood_type,therapist_years,type,status,photo,photos,profile,message,favorite_techniques,favorite_food,celebrity_lookalike,day_off_activities,hobbies,ideal_type,room,x_account,instagram_url,line_url,litlink_url,o2_url,estama_profile_url,blog_url,skebiy_url,tags,shop_comment").eq("id", id).eq("store_id", storeId).eq("is_active", true).single(),
        supabase.from("therapist_profiles").select("*").eq("cast_id", id).maybeSingle(),
      ]);
      if (castRes.error) throw castRes.error;
      setCast(castRes.data);
      setProfile(profileRes.data ?? null);
      document.title = `${castRes.data.name} | ${store?.name ?? "艶華"}`;

      // 口コミは担当セラピスト（この人）宛のお客様投稿のみ表示。
      // 担当名は短縮名（例「かずは」）で投稿されることがあるため、
      // キャスト名（フルネーム）と空白除去のうえ部分一致で照合する。
      const castKey = (castRes.data.name ?? "").replace(/\s/g, "");
      const { data: allRev } = await supabase
        .from("customer_reviews")
        .select("id, rating, therapist_name, review_text, created_at, reviewer_name, review_title, reviewed_at, source_provider, source_url, source_details")
        .eq("is_published", true)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      const revData = ((allRev ?? []) as CustomerReviewRow[]).filter((r) => {
        const t = (r.therapist_name ?? "").replace(/\s/g, "");
        if (!t) return false;
        return castKey === t || castKey.includes(t) || t.includes(castKey);
      });
      setReviews(revData.map((r) => ({
        id: r.id,
        reviewer_name: r.reviewer_name || "お客様",
        rating: Number(r.rating ?? 5),
        body: r.review_text ?? "",
        visit_date: r.reviewed_at ?? null,
        course: null,
        created_at: r.created_at,
        title: r.review_title ?? null,
        source_provider: r.source_provider ?? null,
        source_url: r.source_url ?? null,
        source_details: r.source_details,
      })));
    } catch {
      navigate("/casts");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, store?.name, storeId]);

  useEffect(() => {
    if (id) void fetchAll();
  }, [fetchAll, id]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--pub-accent,#c6a15b)]" />
      </div>
    );
  }

  if (!cast) return null;

  const isPairCast = /[&＆]/.test(cast.name);
  const bookingPath = isPairCast ? `/r/${getBookingKey(cast.id)}` : "/booking";

  // Parse profile JSON if stored as JSON in the profile field
  let profileJson: ProfileJson | null = null;
  let profileText: string | null = cast.profile;
  if (cast.profile && cast.profile.trimStart().startsWith("{")) {
    try { profileJson = JSON.parse(cast.profile) as ProfileJson; profileText = null; } catch { /* keep as text */ }
  }

  const displayAge    = cast.age    ?? profileJson?.age    ?? null;
  const displayHeight = cast.height ?? profileJson?.height ?? null;
  // body_size is stored as "T/W/H" (e.g. "158/58/84")
  const bodySizeParts = cast.body_size ? cast.body_size.split(/[-–/／]/) : [];
  const displayWaist  = bodySizeParts[1]?.replace(/[^0-9]/g, '') || null;
  const displayHip    = bodySizeParts[2]?.replace(/[^0-9]/g, '') || null;
  const displayWeight = profileJson?.weight ?? null;
  const displayBlood  = cast.blood_type ?? profileJson?.blood_type ?? null;

  const allPhotos = (cast.photos && cast.photos.length > 0
    ? cast.photos
    : cast.photo ? [cast.photo] : []
  ).filter(Boolean);

  const status = STATUS_LABEL[cast.status] ?? { text: cast.status, color: "#9ca3af" };

  // Build interview items from both casts columns and therapist_profiles
  const interviewItems: { q: string; a: string }[] = [
    profile?.self_introduction && { q: "自己紹介", a: profile.self_introduction },
    cast.therapist_years != null && { q: "セラピスト歴", a: `${cast.therapist_years}年` },
    (profile?.massage_skills || cast.favorite_techniques) && { q: "得意な施術", a: profile?.massage_skills ?? cast.favorite_techniques ?? "" },
    profile?.career_history && { q: "エステ経歴", a: profile.career_history },
    profile?.training_count != null && { q: "研修回数", a: `${profile.training_count}回` },
    (profile?.hobbies || cast.hobbies) && { q: "趣味・特技", a: profile?.hobbies ?? cast.hobbies ?? "" },
    profile?.special_skills && { q: "特技", a: profile.special_skills },
    cast.favorite_food && { q: "好きな食べ物", a: cast.favorite_food },
    cast.celebrity_lookalike && { q: "似ている芸能人", a: cast.celebrity_lookalike },
    cast.day_off_activities && { q: "休日の過ごし方", a: cast.day_off_activities },
    (profile?.preferred_type || cast.ideal_type) && { q: "好みのタイプ", a: profile?.preferred_type ?? cast.ideal_type ?? "" },
    profile?.mbti && { q: "MBTI", a: profile.mbti },
    displayBlood && { q: "血液型", a: `${displayBlood}型` },
  ].filter(Boolean) as { q: string; a: string }[];

  const INTERNAL_TAGS = [
    "在籍", "出稼ぎ", "入店手続き待ち",
    "ノーステータス", "入店手続き---面談予定", "入店手続き---講習予定",
    "ビギナーズ", "スタンダード", "ソルジャー", "マスター",
  ];
  const therapistComment = cast.message ?? null;
  const shopComment = cast.shop_comment ?? profile?.comment ?? null;

  // Average rating
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
      <PublicNavigation />

      <main className="container py-3 md:py-6 px-2 md:px-4">
        <div className="max-w-3xl mx-auto">

          <button
            onClick={() => navigate("/casts")}
            className="flex items-center gap-1 text-sm mb-4 hover:underline"
            style={{ color: "var(--pub-text,#f0e6d2)" }}
          >
            <ArrowLeft size={14} />
            セラピスト一覧に戻る
          </button>

          <div className="bg-[var(--pub-card,#1a150f)] rounded-lg overflow-hidden shadow-md">

            {/* ── Photo carousel ── */}
            <div className="relative bg-black">
              {allPhotos.length > 0 ? (
                <>
                  <div className="overflow-hidden" ref={emblaRef}>
                    <div className="flex">
                      {allPhotos.map((photo, i) => (
                        <div key={i} className="flex-[0_0_100%] min-w-0">
                          <img
                            src={driveImgUrl(photo, 1200)}
                            alt={`${cast.name} ${i + 1}`}
                            className="w-full object-cover"
                            style={{ maxHeight: "520px", objectPosition: "top" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {allPhotos.length > 1 && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {allPhotos.map((_, i) => (
                        <button key={i} onClick={() => emblaApi?.scrollTo(i)}
                          className="w-1.5 h-1.5 rounded-full transition-all"
                          style={{ background: i === selectedIndex ? "#fff" : "rgba(255,255,255,0.4)" }}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-72 flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--pub-border,#3a2f1c), var(--pub-card2,#221b12))" }}>
                  <span className="text-7xl font-bold text-white/60">{cast.name.charAt(0)}</span>
                </div>
              )}
              {cast.tags && cast.tags.filter(t => !INTERNAL_TAGS.includes(t)).length > 0 && (
                <div className="absolute top-3 left-3 flex flex-col gap-1">
                  {cast.tags.filter(t => !INTERNAL_TAGS.includes(t)).map((tag, i) => (
                    <span key={i} className="text-white text-xs font-bold px-2 py-0.5 rounded shadow"
                      style={{ background: tag === "人気セラピスト" ? "#ef4444" : tag === "新人" ? "#ec4899" : "#3b82f6" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {allPhotos.length > 1 && (
              <div className="flex gap-1.5 px-3 py-2 overflow-x-auto bg-[var(--pub-card2,#221b12)]">
                {allPhotos.map((photo, i) => (
                  <button key={i} onClick={() => emblaApi?.scrollTo(i)}
                    className="flex-shrink-0 rounded overflow-hidden border-2 transition-all"
                    style={{ width: 52, height: 52, borderColor: i === selectedIndex ? "var(--pub-accent,#c6a15b)" : "transparent", opacity: i === selectedIndex ? 1 : 0.55 }}>
                    <img src={driveImgUrl(photo, 400)} alt="" className="w-full h-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}

            {/* ── Name & status ── */}
            <div className="px-5 pt-5 pb-3 border-b border-[var(--pub-border,#3a2f1c)]">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>{cast.name}</h1>
                  {displayAge && <p className="text-sm mt-0.5" style={{ color: "var(--pub-text-muted,#a3987f)" }}>{displayAge}歳</p>}
                </div>
                <div className="flex items-center gap-3">
                  {avgRating && (
                    <div className="flex items-center gap-1">
                      <ReviewStars rating={Number(avgRating)} size={14} mutedColor="var(--pub-border,#3a2f1c)" />
                      <span className="text-sm font-bold" style={{ color: "var(--pub-accent,#c6a15b)" }}>{avgRating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats grid ── */}
            {(displayHeight || cast.bust_size || displayWaist || displayHip || displayWeight || displayBlood) && (
              <div className="border-b border-[var(--pub-border,#3a2f1c)]">
                <div className={`grid divide-x divide-[var(--pub-border,#3a2f1c)] ${[displayHeight, cast.bust_size, displayWaist, displayHip].filter(Boolean).length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                  {displayHeight && (
                    <div className="py-3 text-center">
                      <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--pub-text-muted,#a3987f)" }}>身長</p>
                      <p className="text-sm font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>{displayHeight}cm</p>
                    </div>
                  )}
                  {cast.bust_size && (
                    <div className="py-3 text-center">
                      <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--pub-text-muted,#a3987f)" }}>カップ</p>
                      <p className="text-sm font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>{cast.bust_size}カップ</p>
                    </div>
                  )}
                  {displayWaist && (
                    <div className="py-3 text-center">
                      <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--pub-text-muted,#a3987f)" }}>ウエスト</p>
                      <p className="text-sm font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>{displayWaist}</p>
                    </div>
                  )}
                  {displayHip && (
                    <div className="py-3 text-center">
                      <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--pub-text-muted,#a3987f)" }}>ヒップ</p>
                      <p className="text-sm font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>{displayHip}</p>
                    </div>
                  )}
                </div>
                {(displayWeight || displayBlood) && (
                  <div className="grid grid-cols-2 divide-x divide-[var(--pub-border,#3a2f1c)] border-t border-[var(--pub-border,#3a2f1c)]">
                    {displayWeight && (
                      <div className="py-3 text-center">
                        <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--pub-text-muted,#a3987f)" }}>体重</p>
                        <p className="text-sm font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>{displayWeight}kg</p>
                      </div>
                    )}
                    {displayBlood && (
                      <div className="py-3 text-center">
                        <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--pub-text-muted,#a3987f)" }}>血液型</p>
                        <p className="text-sm font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>{displayBlood}型</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── CTA buttons ── */}
            <div className="px-5 py-4 flex flex-col gap-3 border-b border-[var(--pub-border,#3a2f1c)]">
              {/* 電話で予約する → 写メ日記を見る（サイト内の写メ日記ページへ） */}
              <Link to={`/casts/${cast.id}/diary`}
                className="flex items-center justify-center gap-2 py-3.5 rounded-lg text-white font-bold text-base transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, var(--pub-accent,#c6a15b), var(--pub-accent-deep,#a87c2a))" }}>
                <Camera size={17} />写メ日記を見る
              </Link>
              <Link to={bookingPath}
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold border transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                style={{ borderColor: "var(--pub-accent,#c6a15b)", color: "var(--pub-text,#f0e6d2)" }}>
                <Calendar size={15} />{isPairCast ? "Wセラピスト専用予約はこちら" : "Web予約はこちら"}
              </Link>
            </div>

            {/* ── セラピストインタビュー ── */}
            {interviewItems.length > 0 && (
              <>
                <SectionHeader label="INTERVIEW" sub="セラピストインタビュー" />
                <div className="divide-y divide-[var(--pub-border,#3a2f1c)]">
                  {interviewItems.map(({ q, a }) => (
                    <div key={q} className="px-5 py-3 flex gap-4 text-sm">
                      <dt className="shrink-0 font-semibold w-28 text-[var(--pub-text-muted,#a3987f)]">Q. {q}</dt>
                      <dd className="leading-relaxed text-[var(--pub-text,#f0e6d2)] whitespace-pre-wrap">{a}</dd>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── セラピストコメント ── */}
            {therapistComment && (
              <>
                <SectionHeader label="THERAPIST COMMENT" sub="セラピストコメント" />
                <div className="px-5 py-4" style={{ background: "var(--pub-card2,#221b12)" }}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--pub-text,#f0e6d2)" }}>
                    {therapistComment}
                  </p>
                </div>
              </>
            )}

            {/* ── ショップコメント ── */}
            {shopComment && (
              <>
                <SectionHeader label="SHOP COMMENT" sub="ショップコメント" />
                <div className="px-5 py-4" style={{ background: "var(--pub-card2,#221b12)" }}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--pub-text,#f0e6d2)" }}>
                    {shopComment}
                  </p>
                </div>
              </>
            )}

            {/* ── Profile text (legacy) ── */}
            {profileText && (
              <>
                <SectionHeader label="PROFILE" sub="プロフィール" />
                <div className="px-5 py-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--pub-text,#f0e6d2)" }}>{profileText}</p>
                </div>
              </>
            )}

            {/* ── SNS links ── */}
            {(cast.x_account || cast.instagram_url || cast.line_url || cast.litlink_url || cast.o2_url || cast.estama_profile_url || cast.blog_url || cast.skebiy_url) && (
              <>
                <SectionHeader label="SNS / LINKS" sub="各種リンク" />
                <div className="px-5 py-4 flex flex-wrap gap-3">
                  {cast.x_account && (
                    <a
                      href={cast.x_account.startsWith("http") ? cast.x_account : `https://twitter.com/${cast.x_account}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "var(--pub-border,#3a2f1c)", color: "var(--pub-text,#f0e6d2)" }}
                    >
                      <img src="https://cdn2-caskan.com/caskan/asset/sns/x.png" alt="X" className="w-4 h-4" />
                      X（Twitter）
                    </a>
                  )}
                  {cast.instagram_url && (
                    <a
                      href={cast.instagram_url.startsWith("http") ? cast.instagram_url : `https://instagram.com/${cast.instagram_url.replace(/^@/, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "#d6336c", color: "#e1568f" }}
                    >
                      <span className="text-xs font-bold">IG</span>
                      Instagram
                    </a>
                  )}
                  {cast.line_url && (
                    <a
                      href={cast.line_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "#06c755", color: "#06c755" }}
                    >
                      <img src="https://storage.googleapis.com/caskan/asset/line_icon.png" alt="LINE" className="w-4 h-4" />
                      LINE
                    </a>
                  )}
                  {cast.litlink_url && (
                    <a
                      href={cast.litlink_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "var(--pub-accent,#c6a15b)", color: "var(--pub-accent,#c6a15b)" }}
                    >
                      <span className="text-xs font-bold">lit.</span>
                      リットリンク
                    </a>
                  )}
                  {cast.o2_url && (
                    <a
                      href={cast.o2_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "#e85298", color: "#e85298" }}
                    >
                      <span className="text-xs font-bold">O2</span>
                      口コミ（O2）
                    </a>
                  )}
                  {cast.estama_profile_url && (
                    <a
                      href={cast.estama_profile_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "#b72d5b", color: "#d85a84" }}
                    >
                      <span className="text-xs font-bold">魂</span>
                      魂セラピスト
                    </a>
                  )}
                  {cast.blog_url && (
                    <a
                      href={cast.blog_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "#e85298", color: "#e85298" }}
                    >
                      <span className="text-xs font-bold">O2</span>
                      プロフィール（O2）
                    </a>
                  )}
                  {cast.skebiy_url && (
                    <a
                      href={cast.skebiy_url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-[var(--pub-card2,#221b12)]"
                      style={{ borderColor: "var(--pub-accent,#c6a15b)", color: "var(--pub-accent,#c6a15b)" }}
                    >
                      <span className="text-xs font-bold">S</span>
                      Skebiy
                    </a>
                  )}
                </div>
              </>
            )}

            {/* ── 口コミ ── */}
            <>
              <SectionHeader label="VOICE" sub={`口コミ（${reviews.length}件）`} />
              {reviews.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--pub-text-muted,#a3987f)" }}>
                  まだ口コミがありません
                </div>
              ) : (
                <div className="divide-y divide-[var(--pub-border,#3a2f1c)]">
                  {reviews.map((r) => (
                    <div key={r.id} className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ReviewStars rating={Number(r.rating)} size={14} mutedColor="var(--pub-border,#3a2f1c)" />
                        <span className="text-xs font-bold" style={{ color: "var(--pub-accent,#c6a15b)" }}>{Number(r.rating).toFixed(1)}</span>
                        <span className="text-xs" style={{ color: "var(--pub-text-muted,#a3987f)" }}>
                          {r.reviewer_name}
                          {r.visit_date && ` · ${r.visit_date.replace(/-/g, "/")}`}
                          {r.course && ` · ${r.course}`}
                        </span>
                        {r.source_provider === "estama" && (
                          r.source_url ? (
                            <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs hover:underline" style={{ color: "var(--pub-accent,#c6a15b)" }}>
                              エスたま掲載
                            </a>
                          ) : (
                            <span className="ml-auto text-xs" style={{ color: "var(--pub-accent,#c6a15b)" }}>エスたま掲載</span>
                          )
                        )}
                      </div>
                      {r.title && <h3 className="text-sm font-bold mb-1" style={{ color: "var(--pub-text,#f0e6d2)" }}>{r.title}</h3>}
                      <ReviewCategoryScores details={r.source_details} />
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--pub-text,#f0e6d2)" }}>{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* お客様の声（口コミ一覧）への導線 */}
              <div className="px-5 py-4 border-t border-[var(--pub-border,#3a2f1c)] text-center">
                <Link to="/voice" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: "var(--pub-accent,#c6a15b)" }}>
                  お客様の声（口コミ一覧）を見る →
                </Link>
              </div>
            </>

          </div>

          <div className="text-center mt-6 mb-2">
            <Link to="/casts" className="text-sm hover:underline" style={{ color: "var(--pub-text-muted,#a3987f)" }}>
              ← セラピスト一覧に戻る
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
};

export default CastDetail;
