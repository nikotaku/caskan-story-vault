import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Star, CalendarCheck } from "lucide-react";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { useStore } from "@/hooks/useStore";
import { driveImgUrl } from "@/lib/drive";

interface Review {
  id: string;
  rating: number;
  therapist_name: string | null;
  review_text: string;
  created_at: string;
}

interface CastLite {
  id: string;
  name: string;
  photo: string | null;
}

/** 口コミの担当名（自由入力）を在籍キャストに突き合わせる（部分一致許容） */
const matchCast = (therapistName: string | null, casts: CastLite[]): CastLite | null => {
  if (!therapistName) return null;
  const n = therapistName.replace(/\s/g, "");
  if (!n) return null;
  return (
    casts.find((c) => c.name.replace(/\s/g, "") === n) ??
    casts.find((c) => c.name.replace(/\s/g, "").includes(n) || n.includes(c.name.replace(/\s/g, ""))) ??
    null
  );
};

const Stars = ({ rating, size = 16 }: { rating: number; size?: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} fill={i <= rating ? "var(--pub-accent,#c6a15b)" : "none"} stroke={i <= rating ? "var(--pub-accent,#c6a15b)" : "var(--pub-text-muted,#a3987f)"} />
    ))}
  </div>
);

export default function Voice() {
  const { store, storeId } = useStore();
  const storeName = store?.name ?? "全力エステ 仙台";
  const [reviews, setReviews] = useState<Review[]>([]);
  const [casts, setCasts] = useState<CastLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `お客様の声（口コミ） | ${storeName}`;
    Promise.all([
      supabase
        .from("customer_reviews")
        .select("id, rating, therapist_name, review_text, created_at")
        .eq("is_published", true)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false }),
      supabase
        .from("casts")
        .select("id, name, photo")
        .eq("store_id", storeId)
        .eq("is_visible", true),
    ]).then(([r, c]) => {
      setReviews((r.data as Review[]) || []);
      setCasts((c.data as CastLite[]) || []);
      setLoading(false);
    });
  }, [storeId, storeName]);

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
      <PublicNavigation />

      <main className="container py-6 px-3 md:px-4">
        <div className="max-w-2xl mx-auto">
          {/* タイトル */}
          <div className="text-center mb-6">
            <p className="text-xs tracking-[0.3em] font-bold" style={{ color: "var(--pub-accent,#c6a15b)" }}>VOICE</p>
            <h1 className="text-2xl font-bold mt-1" style={{ color: "var(--pub-text,#f0e6d2)" }}>お客様の声</h1>
            <p className="text-sm mt-1" style={{ color: "var(--pub-text-muted,#a3987f)" }}>実際にご利用いただいたお客様からのご感想です</p>
          </div>

          {/* サマリー */}
          {reviews.length > 0 && (
            <div className="bg-[var(--pub-card,#1a150f)] rounded-lg shadow-sm border border-[var(--pub-border,#3a2f1c)] p-5 mb-6 flex items-center gap-6">
              <div className="text-center shrink-0">
                <p className="text-4xl font-bold" style={{ color: "var(--pub-accent,#c6a15b)" }}>{avg.toFixed(1)}</p>
                <div className="flex justify-center mt-1"><Stars rating={Math.round(avg)} /></div>
                <p className="text-xs mt-1" style={{ color: "var(--pub-text-muted,#a3987f)" }}>平均評価</p>
              </div>
              <div className="flex-1">
                {[5, 4, 3, 2, 1].map((s) => {
                  const count = reviews.filter((r) => r.rating === s).length;
                  const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2 text-xs mb-0.5">
                      <Star size={11} fill="var(--pub-accent,#c6a15b)" stroke="var(--pub-accent,#c6a15b)" />
                      <span className="w-2" style={{ color: "var(--pub-text-muted,#a3987f)" }}>{s}</span>
                      <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "var(--pub-card2,#221b12)" }}>
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--pub-accent,#c6a15b)" }} />
                      </div>
                      <span className="w-6 text-right" style={{ color: "var(--pub-text-muted,#a3987f)" }}>{count}</span>
                    </div>
                  );
                })}
                <p className="text-xs mt-2" style={{ color: "var(--pub-text-muted,#a3987f)" }}>{reviews.length}件のご感想</p>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center py-12" style={{ color: "var(--pub-text-muted,#a3987f)" }}>読み込み中...</p>
          ) : reviews.length === 0 ? (
            <p className="text-center py-12" style={{ color: "var(--pub-text-muted,#a3987f)" }}>まだ口コミがありません</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => {
                const cast = matchCast(r.therapist_name, casts);
                return (
                  <div key={r.id} className="bg-[var(--pub-card,#1a150f)] rounded-lg shadow-sm border border-[var(--pub-border,#3a2f1c)] p-5">
                    <div className="flex items-center justify-between mb-2.5 gap-2">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="text-xs font-bold" style={{ color: "var(--pub-accent,#c6a15b)" }}>{r.rating}.0</span>
                      </div>
                      {r.therapist_name && !cast && (
                        <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: "var(--pub-accent,#c6a15b)", borderColor: "var(--pub-border,#3a2f1c)", background: "var(--pub-card2,#221b12)" }}>
                          担当：{r.therapist_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--pub-text-mid,#d9cdb4)" }}>{r.review_text}</p>

                    {/* 担当セラピストパネル（在籍キャストに一致した場合のみ） */}
                    {cast && (
                      <div
                        className="mt-4 rounded-lg border p-3 flex items-center gap-3"
                        style={{ borderColor: "var(--pub-border,#3a2f1c)", background: "var(--pub-card2,#221b12)" }}
                      >
                        <Link to={`/casts/${cast.id}`} className="shrink-0">
                          {cast.photo ? (
                            <img
                              src={driveImgUrl(cast.photo, 150)}
                              alt={cast.name}
                              className="w-14 h-14 rounded-full object-cover object-top border"
                              style={{ borderColor: "var(--pub-accent-a50,#c6a15b80)" }}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border"
                              style={{ color: "var(--pub-accent,#c6a15b)", borderColor: "var(--pub-accent-a50,#c6a15b80)", background: "var(--pub-card,#1a150f)" }}
                            >
                              {cast.name.charAt(0)}
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px]" style={{ color: "var(--pub-text-muted,#a3987f)" }}>担当セラピスト</p>
                          <Link
                            to={`/casts/${cast.id}`}
                            className="text-sm font-bold hover:underline"
                            style={{ color: "var(--pub-text,#f0e6d2)" }}
                          >
                            {cast.name}
                          </Link>
                        </div>
                        <Link
                          to={`/casts/${cast.id}`}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, var(--pub-accent,#c6a15b), var(--pub-accent-deep,#a87c2a))" }}
                        >
                          <CalendarCheck size={13} />
                          このセラピストで予約する
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 投稿導線 */}
          <div className="mt-10 text-center">
            <p className="text-sm mb-3" style={{ color: "var(--pub-text-muted,#a3987f)" }}>ご来店後のご感想をお聞かせください</p>
            <Link
              to="/review"
              className="inline-block px-6 py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, var(--pub-accent,#c6a15b), var(--pub-accent-deep,#a87c2a))" }}
            >
              口コミを投稿する
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
}
