import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ChatBot } from "@/components/ChatBot";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { SectionHeading } from "@/components/public/SectionHeading";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface Cast {
  id: string;
  name: string;
  age: number | null;
  height: number | null;
  cup_size: string | null;
  photo: string | null;
  profile: string | null;
  join_date: string;
  x_account: string | null;
  status: string;
}

interface Shift {
  id: string;
  cast_id: string;
  start_time: string;
  end_time: string;
  room: string | null;
  casts: {
    id: string;
    name: string;
    photo: string | null;
    age: number | null;
    height: number | null;
    cup_size: string | null;
    profile: string | null;
    x_account: string | null;
  };
}

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [newFaceCasts, setNewFaceCasts] = useState<Cast[]>([]);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [allCasts, setAllCasts] = useState<Cast[]>([]);

  const slides = [
    "https://cdn2-caskan.com/caskan/img/shop_top_banner/1401_banner_1750253573.png",
    "https://cdn2-caskan.com/caskan/img/shop_top_banner/1401_banner_1750762260.png",
  ];

  useEffect(() => {
    document.title = "全力エステ 仙台 | メンズエステ";
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = format(thirtyDaysAgo, "yyyy-MM-dd");

    const [castsRes, shiftsRes] = await Promise.all([
      supabase
        .from("casts")
        .select("id, name, age, height, cup_size, photo, profile, join_date, x_account, status")
        .order("join_date", { ascending: false }),
      supabase
        .from("shifts")
        .select(`
          id, cast_id, start_time, end_time, room,
          casts (id, name, photo, age, height, cup_size, profile, x_account)
        `)
        .eq("shift_date", today)
        .order("start_time", { ascending: true }),
    ]);

    if (castsRes.data) {
      setAllCasts(castsRes.data);
      setNewFaceCasts(
        castsRes.data.filter((c) => c.join_date >= thirtyDaysAgoStr)
      );
    }
    if (shiftsRes.data) {
      // Deduplicate by cast_id
      const seen = new Set<string>();
      const unique = shiftsRes.data.filter((s) => {
        if (seen.has(s.cast_id)) return false;
        seen.add(s.cast_id);
        return true;
      });
      setTodayShifts(unique as Shift[]);
    }
  };

  const nextSlide = () =>
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () =>
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "#f5e8e4" }}>
      <PublicNavigation />

      {/* Banner Slider */}
      <div className="relative">
        <div className="relative overflow-hidden">
          <AspectRatio ratio={16 / 9}>
            <img
              src={slides[currentSlide]}
              alt="トップバナー | 全力エステ 仙台"
              className="w-full h-full object-cover transition-opacity duration-500"
            />
          </AspectRatio>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 p-2 rounded-full text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 p-2 rounded-full text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-3 h-3 rounded-full transition-all ${
                  currentSlide === i ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* NEW FACE Section */}
      {newFaceCasts.length > 0 && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-5xl">
            <SectionHeading english="NEW FACE" japanese="新人情報" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {newFaceCasts.slice(0, 5).map((cast) => (
                <TherapistCard key={cast.id} cast={cast} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* NEWS Section */}
      <section className="py-12 px-4 bg-white">
        <div className="container mx-auto max-w-3xl">
          <SectionHeading english="NEWS" japanese="お知らせ" />
          <div className="text-center text-[#a89586] text-sm">
            <p>最新のお知らせは X (Twitter) にてご確認ください</p>
            <a
              href="https://twitter.com/zr_sendai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-6 py-2 bg-black text-white rounded-full text-sm hover:bg-gray-800 transition-colors"
            >
              <img
                src="https://cdn2-caskan.com/caskan/asset/sns/x.png"
                alt="X"
                className="w-4 h-4 invert"
              />
              @zr_sendai をフォロー
            </a>
          </div>
        </div>
      </section>

      {/* CONCEPT Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <SectionHeading english="CONCEPT" japanese="コンセプト" />
          <div className="bg-white rounded-lg shadow-md p-8 md:p-12">
            <div className="space-y-4 text-center text-sm md:text-base" style={{ color: "#6b5d4f" }}>
              <p className="text-lg md:text-xl font-semibold" style={{ color: "#8b7355" }}>
                素直で愛嬌があり不器用でも全力心でサービス
              </p>
              <div className="pt-4 space-y-2">
                <p>選び抜かれたビジュアル</p>
                <p>洗練された施術</p>
                <p>妥協のない接客</p>
              </div>
              <div className="pt-6 space-y-2">
                <p className="font-semibold" style={{ color: "#d4a574" }}>
                  "全力エステ"は
                </p>
                <p>仙台のメンズエステ界における</p>
                <p className="font-bold text-lg">「頂点」を本気で狙う</p>
                <p>ハイレベルサロンです。</p>
              </div>
              <div className="pt-6 space-y-2">
                <p>ただ癒すだけじゃない。</p>
                <p>あなたの五感すべてを圧倒する</p>
                <p className="font-bold text-xl" style={{ color: "#d4a574" }}>
                  「全力の一撃」
                </p>
                <p>をご堪能ください。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PICK UP Section */}
      {allCasts.length > 0 && (
        <section className="py-12 px-4 bg-white">
          <div className="container mx-auto max-w-5xl">
            <SectionHeading english="PICK UP" japanese="ピックアップ" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {allCasts.slice(0, 5).map((cast) => (
                <TherapistCard key={cast.id} cast={cast} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TODAY'S SCHEDULE Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <SectionHeading english="TODAY'S SCHEDULE" japanese="本日の出勤" />
          {todayShifts.length === 0 ? (
            <div className="text-center text-[#a89586] py-8">
              <p>本日の出勤予定はありません</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {todayShifts.map((shift) => (
                <Link
                  key={shift.id}
                  to={`/casts/${shift.casts.id}`}
                  className="block group"
                >
                  <div className="bg-white rounded overflow-hidden shadow hover:shadow-lg transition-shadow">
                    <div className="relative">
                      {shift.casts.photo ? (
                        <img
                          src={shift.casts.photo}
                          alt={shift.casts.name}
                          className="w-full aspect-[3/4] object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-[3/4] bg-gradient-to-br from-[#d4b5a8] to-[#c5a89b] flex items-center justify-center">
                          <span className="text-4xl text-white">
                            {shift.casts.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      {shift.casts.x_account && (
                        <div className="absolute bottom-2 right-2">
                          <a
                            href={`https://twitter.com/${shift.casts.x_account}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <img
                              src="https://cdn2-caskan.com/caskan/asset/sns/x.png"
                              alt="X"
                              className="w-6 h-6"
                            />
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-[#8b7355] text-sm">
                        {shift.casts.name}
                      </h4>
                      {shift.casts.profile && (
                        <p className="text-[10px] text-[#a89586] truncate">
                          {shift.casts.profile}
                        </p>
                      )}
                      <div className="text-[10px] text-[#a89586] mt-1">
                        {shift.casts.age && <span>{shift.casts.age}歳</span>}
                        {shift.casts.height && (
                          <span className="ml-1">{shift.casts.height}㎝</span>
                        )}
                        {shift.casts.cup_size && (
                          <span className="ml-1">({shift.casts.cup_size})</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#8b7355] mt-1">
                        🕐 {shift.start_time.substring(0, 5)}〜
                        {shift.end_time.substring(0, 5)}
                      </div>
                      {shift.room && (
                        <div className="text-[10px] text-[#a89586]">
                          ■{shift.room}■
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="text-center mt-6">
            <Link
              to="/schedule"
              className="text-[#8b7355] text-sm hover:underline"
            >
              今週の出勤情報 →
            </Link>
          </div>
        </div>
      </section>

      {/* Custom Banner */}
      <div className="container mx-auto px-4 max-w-3xl py-4">
        <img
          src="https://cdn2-caskan.com/caskan/img/shop_custom_banner/1401_banner_1750164303.jpeg"
          alt="バナー | 全力エステ 仙台"
          className="w-full rounded"
        />
      </div>

      {/* NOTICE Section */}
      <section className="py-12 px-4 bg-white">
        <div className="container mx-auto max-w-3xl">
          <SectionHeading english="NOTICE" japanese="注意事項" />
          <div className="text-xs text-gray-600 leading-relaxed space-y-2">
            <p className="font-bold">【ご利用規則】</p>
            <p>
              仙台リラクゼーションサロン【全力エステ】（以下「当店」といいます。）を、ご利用いただく際には、本利用規約に同意されたものとみなします。
            </p>
            <p>※コース内にシャワーのお時間は含まれますのでご了承ください。</p>
            <p>
              ※18歳未満の方、スカウト目的の方、同業者、暴力団関係者、泥酔者、薬物使用者、その他当店が相応しくないと判断した方の、お問い合わせ及びご利用は固くお断り致します。
            </p>
            <p>※当店は、番号非通知及び公衆電話からの受付は致しかねます。</p>
            <p>
              ※当店は、リラクゼーションを目的とした施術を提供するプライベートサロンであり、医療行為、治療行為、風俗的なサービス等は一切行なっておりません。
            </p>
            <p>
              ※セラピストの引き抜き行為やスカウト行為が発覚した場合は、例外なく損害賠償請求、法的措置等も視野にいれた然るべき対応をとらせていただきます。
            </p>
            <p>※セラピストとの個人的な連絡先交換や店外へのお誘いは堅くお断り致します。</p>
            <p>
              ※盗撮や盗聴等の行為があった際は、所轄警察署に被害届を提出し、法的手続きをとらせていただきます。
            </p>
          </div>
        </div>
      </section>

      {/* SHOP Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <SectionHeading english="SHOP" japanese="店舗情報" />
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-bold text-[#8b7355] w-1/3 bg-[#faf5f2]">
                    店舗名
                  </td>
                  <td className="py-3 px-4 text-gray-700">全力エステ 仙台</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-bold text-[#8b7355] bg-[#faf5f2]">
                    URL
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    <a
                      href="https://zenryoku-esthe.com"
                      className="text-blue-600 hover:underline"
                    >
                      https://zenryoku-esthe.com
                    </a>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-bold text-[#8b7355] bg-[#faf5f2]">
                    営業時間
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    12:00〜26:00(24:40最終受付)
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-bold text-[#8b7355] bg-[#faf5f2]">
                    TEL
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    <a href="tel:07090941854" className="hover:underline">
                      07090941854
                    </a>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-bold text-[#8b7355] bg-[#faf5f2]">
                    最寄り駅
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    北四番丁駅｜勾当台公園駅｜仙台駅
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* External Link Banner */}
      <div className="container mx-auto px-4 max-w-3xl pb-8 text-center">
        <a
          href="https://eslove.jp/hokkaido-tohoku/miyagi/shoplist"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://eslove.jp/eslove_front_theme/banner/banner_200x40.gif"
            alt="宮城のメンズエステ情報ならエステラブ"
            className="inline-block"
          />
        </a>
      </div>

      <PublicFooter />
      <FixedBottomBar />
      <ChatBot />
    </div>
  );
};

/* Therapist Card Component */
const TherapistCard = ({ cast }: { cast: Cast }) => {
  return (
    <Link to={`/casts/${cast.id}`} className="block group">
      <div className="bg-white rounded overflow-hidden shadow hover:shadow-lg transition-shadow">
        <div className="relative">
          {cast.photo ? (
            <img
              src={cast.photo}
              alt={cast.name}
              className="w-full aspect-[3/4] object-cover"
            />
          ) : (
            <div className="w-full aspect-[3/4] bg-gradient-to-br from-[#d4b5a8] to-[#c5a89b] flex items-center justify-center">
              <span className="text-4xl text-white">
                {cast.name.charAt(0)}
              </span>
            </div>
          )}
          {cast.x_account && (
            <div className="absolute bottom-2 right-2">
              <a
                href={`https://twitter.com/${cast.x_account}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src="https://cdn2-caskan.com/caskan/asset/sns/x.png"
                  alt="X"
                  className="w-6 h-6"
                />
              </a>
            </div>
          )}
        </div>
        <div className="p-2">
          <h4 className="font-bold text-[#8b7355] text-sm">{cast.name}</h4>
          {cast.profile && (
            <p className="text-[10px] text-[#a89586] truncate">{cast.profile}</p>
          )}
          <div className="text-[10px] text-[#a89586] mt-1">
            {cast.age && <span>{cast.age}歳</span>}
            {cast.height && <span className="ml-1">{cast.height}㎝</span>}
            {cast.cup_size && <span className="ml-1">({cast.cup_size})</span>}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default Home;
