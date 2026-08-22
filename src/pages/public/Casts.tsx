import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { driveImgUrl } from "@/lib/drive";
import o2LogoUrl from "@/assets/o2-logo.png";
import o2BlogLogoUrl from "@/assets/o2-blog-logo.png";
import { useStore } from "@/hooks/useStore";
import { CastTitleBadge, useTitleBadges } from "@/components/public/CastTitleBadge";

interface Cast {
  id: string;
  name: string;
  age: number | null;
  height: number | null;
  bust: number | null;
  cup_size: string | null;
  waist: number | null;
  hip: number | null;
  type: string;
  status: string;
  photo: string | null;
  photos: string[] | null;
  title_badge_id?: string | null;
  tags: string[] | null;
  join_date: string;
  profile: string | null;
  x_account: string | null;
  line_url: string | null;
  litlink_url: string | null;
  o2_url: string | null;
  estama_profile_url: string | null;
  instagram_url: string | null;
  blog_url: string | null;
  skebiy_url: string | null;
  custom_fields: Record<string, string> | null;
}

const INTERNAL_TAGS = [
  "在籍", "出稼ぎ", "入店手続き待ち",
  "ノーステータス", "入店手続き---面談予定", "入店手続き---講習予定",
  "ビギナーズ", "スタンダード", "ソルジャー", "マスター",
];

const Casts = () => {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'newface'>('all');
  const [todayShiftCastIds, setTodayShiftCastIds] = useState<Set<string>>(new Set());
  const { storeId, loading: storeLoading } = useStore();

  useEffect(() => {
    document.title = `${storeName} - セラピスト`;
  }, []);

  useEffect(() => {
    if (storeLoading) return;
    fetchCasts();
    fetchTodayShifts();
    const castsChannel = supabase
      .channel('public-casts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casts' }, () => fetchCasts())
      .subscribe();
    const shiftsChannel = supabase
      .channel('public-shifts-today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => fetchTodayShifts())
      .subscribe();
    return () => {
      supabase.removeChannel(castsChannel);
      supabase.removeChannel(shiftsChannel);
    };
  }, [storeLoading, storeId]);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from("casts")
        .select("id,name,age,height,bust,cup_size,waist,hip,type,status,photo,photos,title_badge_id,tags,join_date,profile,x_account,line_url,litlink_url,o2_url,estama_profile_url,instagram_url,blog_url,skebiy_url,custom_fields")
        .eq("is_visible", true)
        .eq("store_id", storeId)
        .order("name", { ascending: true });
      if (error) throw error;
      setCasts(data || []);
    } catch (error) {
      console.error("Error fetching casts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayShifts = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("shifts")
      .select("cast_id")
      .eq("shift_date", today)
      .eq("store_id", storeId);
    setTodayShiftCastIds(new Set((data || []).map((s: any) => s.cast_id)));
  };

  const isNewFace = (joinDate: string) => {
    const join = new Date(joinDate);
    const now = new Date();
    return Math.ceil(Math.abs(now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24)) <= 30;
  };

  const titleBadgeMap = useTitleBadges();
  const { store } = useStore();
  const storeName = store?.name ?? "艶華";

  const filteredCasts = casts.filter((cast) => {
    if (filter === 'today') return todayShiftCastIds.has(cast.id);
    if (filter === 'newface') return isNewFace(cast.join_date);
    return true;
  });

  const formatSize = (cast: Cast) => {
    if (!cast.height) return '';
    let s = `T.${cast.height}`;
    if (cast.bust && cast.cup_size && cast.waist && cast.hip) s += ` B.${cast.bust}(${cast.cup_size}) W.${cast.waist} H.${cast.hip}`;
    else if (cast.bust && cast.waist && cast.hip) s += ` B.${cast.bust} W.${cast.waist} H.${cast.hip}`;
    return s;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
      <PublicNavigation />

      <main className="container py-4 md:py-8 px-3 md:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg md:text-2xl font-bold" style={{ color: "var(--pub-text,#f0e6d2)" }}>
              <small className="text-xs md:text-sm block mb-0.5 text-[var(--pub-text-muted,#a3987f)]">THERAPIST</small>
              セラピスト
            </h2>
            <Link to="/schedule" className="inline-block bg-[var(--pub-card,#1a150f)] hover:bg-[var(--pub-card2,#221b12)] text-[var(--pub-text,#f0e6d2)] border border-[var(--pub-accent,#c6a15b)] px-4 py-1.5 text-sm rounded transition-colors">
              出勤表はこちら
            </Link>
          </div>

          <div className="mb-4 md:mb-6 flex flex-wrap gap-2">
            {(['all', 'today', 'newface'] as const).map((f) => (
              <Button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm ${filter === f ? 'bg-[var(--pub-accent,#c6a15b)] hover:bg-[var(--pub-accent-deep,#a87c2a)] text-white' : 'bg-[var(--pub-card,#1a150f)] hover:bg-[var(--pub-card2,#221b12)] text-[var(--pub-text,#f0e6d2)] border border-[var(--pub-accent,#c6a15b)]'}`}
              >
                {f === 'all' ? 'すべて' : f === 'today' ? '本日出勤' : '新人'}
              </Button>
            ))}
          </div>

          {filteredCasts.length === 0 ? (
            <div className="text-center py-12"><p className="text-[var(--pub-text-muted,#a3987f)]">該当するセラピストが見つかりませんでした</p></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredCasts.map((cast) => {
                const hasSns = !!(cast.x_account || cast.line_url || cast.litlink_url || cast.instagram_url || cast.o2_url || cast.estama_profile_url || cast.blog_url || cast.skebiy_url);
                return (
                  <div key={cast.id} className="relative">
                    <Link to={`/casts/${cast.id}`} className="block group">
                      <figure className="bg-[var(--pub-card,#1a150f)] rounded overflow-hidden shadow hover:shadow-lg transition-shadow">
                        {/* tag badges */}
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                          {cast.tags?.filter(t => !INTERNAL_TAGS.includes(t)).map((tag, idx) => (
                            <span key={idx} className={`text-white text-xs font-bold px-2 py-1 rounded shadow-md ${tag === '人気セラピスト' ? 'bg-red-500' : tag === '新人' ? 'bg-pink-500' : 'bg-blue-500'}`}>{tag}</span>
                          ))}
                        </div>

                        {/* photo */}
                        <div className="relative">
                          <div className="absolute top-2 right-2 z-10">
                            <CastTitleBadge badge={titleBadgeMap.get(cast.title_badge_id ?? "")} />
                          </div>
                          {cast.photo ? (
                            <img src={driveImgUrl(cast.photo)} alt={cast.name} className="w-full aspect-[3/4] object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full aspect-[3/4] bg-gradient-to-br from-[var(--pub-accent,#c6a15b)] to-[var(--pub-accent-deep,#a87c2a)] flex items-center justify-center">
                              <span className="text-4xl text-white">{cast.name.charAt(0)}</span>
                            </div>
                          )}

                          {/* SNS icon overlay — always visible at photo bottom */}
                          {hasSns && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-2">
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                {cast.x_account && (
                                  <a
                                    href={cast.x_account.startsWith("http") ? cast.x_account : `https://twitter.com/${cast.x_account}`}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="X"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-md group-hover/sns:scale-110 transition-transform">
                                      <img src="https://cdn2-caskan.com/caskan/asset/sns/x.png" alt="X" className="w-4 h-4" />
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">X</span>
                                  </a>
                                )}
                                {cast.line_url && (
                                  <a
                                    href={cast.line_url}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="LINE"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full flex items-center justify-center shadow-md group-hover/sns:scale-110 transition-transform" style={{ backgroundColor: "#06c755" }}>
                                      <img src="https://storage.googleapis.com/caskan/asset/line_icon.png" alt="LINE" className="w-4 h-4" />
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">LINE</span>
                                  </a>
                                )}
                                {cast.instagram_url && (
                                  <a
                                    href={cast.instagram_url}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="Instagram"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md group-hover/sns:scale-110 transition-transform" style={{ background: "linear-gradient(45deg,#feda75,#d62976,#4f5bd5)" }}>
                                      IG
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">Insta</span>
                                  </a>
                                )}
                                {cast.litlink_url && (
                                  <a
                                    href={cast.litlink_url}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="リットリンク"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[var(--pub-accent,#c6a15b)] text-[10px] font-bold shadow-md group-hover/sns:scale-110 transition-transform">
                                      lit
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">lit.link</span>
                                  </a>
                                )}
                                {cast.o2_url && (
                                  <a
                                    href={cast.o2_url}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="口コミO2"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md group-hover/sns:scale-110 transition-transform overflow-hidden">
                                      <img src={o2LogoUrl} alt="O2" className="w-6 h-6 object-contain" />
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">O2</span>
                                  </a>
                                )}
                                {cast.estama_profile_url && (
                                  <a
                                    href={cast.estama_profile_url}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="魂セラピスト"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full bg-[#b72d5b] flex items-center justify-center text-white text-sm font-bold shadow-md group-hover/sns:scale-110 transition-transform">
                                      魂
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">魂</span>
                                  </a>
                                )}
                                {cast.blog_url && (
                                  <a
                                    href={cast.blog_url}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="ブログ"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full flex items-center justify-center shadow-md group-hover/sns:scale-110 transition-transform overflow-hidden" style={{ backgroundColor: "#f59e0b" }}>
                                      <img src={cast.custom_fields?.blog_icon || o2BlogLogoUrl} alt="Blog" className="w-full h-full object-cover" />
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">ブログ</span>
                                  </a>
                                )}
                                {cast.skebiy_url && (
                                  <a
                                    href={cast.skebiy_url}
                                    target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()} aria-label="Skebiy"
                                    className="flex flex-col items-center gap-0.5 group/sns"
                                  >
                                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-md group-hover/sns:scale-110 transition-transform overflow-hidden" style={{ backgroundColor: "#7c3aed" }}>
                                      {cast.custom_fields?.skebiy_icon ? (
                                        <img src={cast.custom_fields.skebiy_icon} alt="Sk" className="w-6 h-6 object-contain" />
                                      ) : "Sk"}
                                    </span>
                                    <span className="text-[9px] text-white/80 leading-none">Skebiy</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* info below photo */}
                        <div className="p-2 md:p-3">
                          <h4 className="font-bold text-[var(--pub-text,#f0e6d2)] text-sm leading-tight">{cast.name}{cast.age ? `(${cast.age})` : ''}</h4>
                          {formatSize(cast) && <p className="text-xs text-[var(--pub-text-muted,#a3987f)] mt-0.5 leading-tight">{formatSize(cast)}</p>}
                        </div>
                      </figure>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
};

export default Casts;
