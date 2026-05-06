import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { ChatBot } from "@/components/ChatBot";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
}

interface Cast {
  id: string;
  name: string;
  photo: string | null;
  message: string | null;
  age: number | null;
  height: number | null;
  cup_size: string | null;
  tags: string[] | null;
  x_account: string | null;
}

interface News {
  id: string;
  title: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
}

const FALLBACK_BANNERS = [
  "https://cdn2-caskan.com/caskan/img/shop_top_banner/1401_banner_1750253573.png",
  "https://cdn2-caskan.com/caskan/img/shop_top_banner/1401_banner_1776948828.png",
];

const Top = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [newCasts, setNewCasts] = useState<Cast[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    document.title = "全力エステ 仙台店｜仙台のメンズエステ";
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [b, c, n] = await Promise.all([
      supabase
        .from("banners")
        .select("id,title,image_url,link_url")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("casts")
        .select("id,name,photo,message,age,height,cup_size,tags,x_account")
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("board_posts")
        .select("id,title,content,created_at,is_pinned")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
    if (b.data) setBanners(b.data as Banner[]);
    if (c.data) setNewCasts(c.data as Cast[]);
    if (n.data) setNews(n.data as News[]);
  };

  // Banner slider auto rotate
  const slides =
    banners.length > 0
      ? banners
      : FALLBACK_BANNERS.map((url, i) => ({
          id: String(i),
          title: null,
          image_url: url,
          link_url: null,
        }));

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(
      () => setBannerIdx((i) => (i + 1) % slides.length),
      5000
    );
    return () => clearInterval(t);
  }, [slides.length]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
      d.getHours()
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div
      className="min-h-screen pb-14 md:pb-0"
      style={{ backgroundColor: "#f5e8e4" }}
    >
      <PublicNavigation />

      {/* ===== BANNER SLIDER ===== */}
      <section className="bg-[#f5e8e4] py-6 md:py-10">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="relative overflow-hidden rounded-lg shadow-2xl bg-white">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
            >
              {slides.map((b) => {
                const img = (
                  <img
                    src={b.image_url}
                    alt={b.title || "全力エステ仙台"}
                    className="w-full h-auto object-cover flex-shrink-0"
                    loading="lazy"
                  />
                );
                return (
                  <div key={b.id} className="w-full flex-shrink-0">
                    {b.link_url ? (
                      <a
                        href={b.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {img}
                      </a>
                    ) : (
                      img
                    )}
                  </div>
                );
              })}
            </div>

            {slides.length > 1 && (
              <>
                <button
                  aria-label="前へ"
                  onClick={() =>
                    setBannerIdx((i) => (i - 1 + slides.length) % slides.length)
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 backdrop-blur-sm transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  aria-label="次へ"
                  onClick={() =>
                    setBannerIdx((i) => (i + 1) % slides.length)
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 backdrop-blur-sm transition"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`${i + 1}枚目へ`}
                      onClick={() => setBannerIdx(i)}
                      className={`h-2 w-2 rounded-full transition ${
                        i === bannerIdx ? "bg-white w-6" : "bg-white/60"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== NEW FACE ===== */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <SectionTitle en="NEW FACE" jp="新人情報" />
          {newCasts.length === 0 ? (
            <p className="text-center text-[#a89586]">
              新人情報はまだありません
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mt-8">
              {newCasts.map((cast) => (
                <Link
                  to={`/casts/${cast.id}`}
                  key={cast.id}
                  className="group block bg-white rounded-lg overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="aspect-[3/4] bg-gradient-to-br from-[#f5e8e4] to-[#e5d5cc] overflow-hidden">
                    {cast.photo ? (
                      <img
                        src={cast.photo}
                        alt={cast.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl text-[#d4b5a8]">
                        {cast.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-4 text-center">
                    <h3
                      className="text-2xl font-bold mb-2 tracking-wider"
                      style={{ color: "#8b7355" }}
                    >
                      {cast.name}
                    </h3>
                    {cast.message && (
                      <p className="text-sm text-[#a89586] mb-2 line-clamp-2">
                        {cast.message}
                      </p>
                    )}
                    <p className="text-sm text-[#8b7355]">
                      {cast.age && `${cast.age}歳`}
                      {cast.height && ` ${cast.height}㎝`}
                      {cast.cup_size && (
                        <span className="ml-1">({cast.cup_size})</span>
                      )}
                    </p>
                    {cast.tags && cast.tags.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1 mt-3">
                        {cast.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-[#d4a574]/40 text-[#8b7355] bg-[#f5e8e4]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="text-center mt-8">
            <Link
              to="/casts"
              className="inline-block px-8 py-3 border-2 border-[#d4a574] text-[#8b7355] hover:bg-[#d4a574] hover:text-white transition-colors font-semibold tracking-wider rounded"
            >
              セラピスト一覧 →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== NEWS ===== */}
      <section className="py-12 md:py-16 bg-white/40">
        <div className="container mx-auto max-w-4xl px-4">
          <SectionTitle en="NEWS" jp="お知らせ" />
          {news.length === 0 ? (
            <p className="text-center text-[#a89586]">
              お知らせはまだありません
            </p>
          ) : (
            <ul className="mt-8 space-y-4">
              {news.map((n) => (
                <li
                  key={n.id}
                  className="bg-white rounded-lg p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow border border-[#e5d5cc]"
                >
                  <p className="text-xs text-[#a89586] mb-1">
                    {formatDate(n.created_at)}
                  </p>
                  <h3
                    className="text-lg md:text-xl font-bold mb-2"
                    style={{ color: "#8b7355" }}
                  >
                    {n.title}
                  </h3>
                  <p className="text-sm text-[#5c4a3a] whitespace-pre-wrap line-clamp-3">
                    {n.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="text-center mt-8">
            <Link
              to="/news"
              className="inline-block text-[#8b7355] hover:text-[#d4a574] transition-colors font-semibold tracking-wider"
            >
              その他のお知らせ →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== CONCEPT ===== */}
      <section
        className="py-16 md:py-24"
        style={{
          background:
            "linear-gradient(135deg, #efd0c2 0%, #f5e1d8 50%, #efd0c2 100%)",
        }}
      >
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <SectionTitle en="CONCEPT" jp="コンセプト" />
          <div
            className="space-y-4 mt-10 leading-loose tracking-wider"
            style={{ color: "#5c4a3a" }}
          >
            <p className="text-base md:text-lg">
              素直で愛嬌があり不器用でも全力心でサービス
            </p>
            <p>選び抜かれたビジュアル</p>
            <p>洗練された施術</p>
            <p>妥協のない接客</p>
            <p className="pt-4 text-xl md:text-2xl font-bold tracking-widest">
              "全力エステ"は
            </p>
            <p>仙台のメンズエステ界における</p>
            <p className="text-lg md:text-xl">
              「<span className="font-bold text-[#8b7355]">頂点</span>」を本気で狙う
            </p>
            <p>ハイレベルサロンです。</p>
            <p className="pt-4 text-base md:text-lg">
              ただ癒すだけじゃない。
            </p>
            <p>あなたの五感すべてを圧倒する</p>
            <p className="text-2xl md:text-3xl font-bold tracking-widest pt-2 text-[#8b7355]">
              「全力の一撃」
            </p>
            <p>をご堪能ください。</p>
          </div>
        </div>
      </section>

      {/* ===== SNS / 外部リンク ===== */}
      <section className="py-12 bg-white/60">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <SectionTitle en="LINKS" jp="公式リンク" />
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <a
              href="https://r.caskan.jp/zenryoku1209"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4a574] hover:bg-[#c5966a] text-white font-semibold rounded shadow"
            >
              Web予約 <ExternalLink size={16} />
            </a>
            <a
              href="https://twitter.com/zenryoku_esthe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#d4a574] text-[#8b7355] hover:bg-[#f5e8e4] font-semibold rounded"
            >
              X (Twitter) <ExternalLink size={16} />
            </a>
            <a
              href="https://bsky.app/profile/zenryoku-esthe.bsky.social"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#d4a574] text-[#8b7355] hover:bg-[#f5e8e4] font-semibold rounded"
            >
              Bluesky <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
      <FixedBottomBar />
      <ChatBot />
    </div>
  );
};

const SectionTitle = ({ en, jp }: { en: string; jp: string }) => (
  <div className="text-center">
    <h2
      className="text-3xl md:text-5xl font-bold tracking-[0.3em]"
      style={{ color: "#8b7355" }}
    >
      {en}
    </h2>
    <p className="text-sm md:text-base mt-2 tracking-widest text-[#a89586]">
      {jp}
    </p>
    <div className="mx-auto mt-3 h-px w-16 bg-[#d4a574]" />
  </div>
);

export default Top;
