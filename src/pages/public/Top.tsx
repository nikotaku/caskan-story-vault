import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { WeeklyScheduleWidget } from "@/components/public/WeeklyScheduleWidget";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useStore } from "@/hooks/useStore";
import { ExternalLink, Menu } from "lucide-react";
import { format } from "date-fns";
import "@/styles/zrtop.css";

const NAV_ITEMS = [
  { to: "/", label: "TOP", sub: "トップ", external: false },
  { to: "/schedule", label: "SCHEDULE", sub: "出勤情報", external: false },
  { to: "/casts", label: "THERAPIST", sub: "セラピスト", external: false },
  { to: "/campaigns", label: "CAMPAIGN", sub: "キャンペーン", external: false },
  { to: "/voice", label: "VOICE", sub: "口コミ", external: false },
  { to: "/system", label: "SYSTEM", sub: "料金システム", external: false },
  { to: "/access", label: "ACCESS", sub: "アクセス", external: false },
  { to: "/recruit-talk", label: "RECRUIT", sub: "求人情報", external: false },
  { to: "/booking", label: "RESERVE", sub: "Web予約", external: false },
];

// 予約システムのURL（必要に応じて変更）
const RESERVE_URL = "/booking";
const reserveHref = (course?: string) =>
  course ? `${RESERVE_URL}${RESERVE_URL.includes("?") ? "&" : "?"}course=${encodeURIComponent(course)}` : RESERVE_URL;

const STORE_SNS_DEFS = [
  { key: "store_sns_x", label: "店舗公式 X (旧Twitter)", short: "X", color: "#000000" },
  { key: "store_sns_line", label: "店舗公式 LINE", short: "L", color: "#06c755" },
  { key: "store_sns_o2", label: "店舗公式 O2 (ゼロツー)", short: "O2", color: "#e85298" },
  { key: "store_sns_instagram", label: "店舗公式 Instagram", short: "IG", color: "#d62976" },
  { key: "store_sns_bluesky", label: "店舗公式 Bluesky", short: "B", color: "#1185fe" },
];

interface HpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  created_at: string;
  image_urls: string[] | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  news: "ニュース", coupon: "クーポン", schedule: "出勤情報",
  newstaff: "新人入店", campaign: "キャンペーン", tips: "ノウハウ", other: "お知らせ",
};

// AI生成文に混じるMarkdown記法（見出し・太字・区切り線・表組み等）を除去して自然な文章にする
const cleanContent = (md: string): string =>
  md
    .replace(/^#{1,6}\s+/gm, "")              // 見出し ###
    .replace(/\*\*(.+?)\*\*/g, "$1")          // 太字 **text**
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1") // 斜体 *text*
    .replace(/`([^`]+)`/g, "$1")              // コード `text`
    .replace(/^\s*>\s?/gm, "")                // 引用 >
    .replace(/^\s*[-*]\s+/gm, "・")           // 箇条書き - / *
    .replace(/^\s*\d+\.\s+/gm, "")            // 番号付きリスト
    .replace(/^\s*[-=]{3,}\s*$/gm, "")        // 区切り線 --- / ===
    .replace(/^\s*\|.*\|\s*$/gm, (line) => {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return ""; // 表の区切り行
      return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((s) => s.trim()).join("　");
    })
    .replace(/\n{3,}/g, "\n\n")               // 余分な空行を圧縮
    .trim();

// **強調** をアクセント色の太字に変換（インライン）
const renderInline = (text: string, kp: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<strong key={`${kp}-${i}`} className="font-bold" style={{ color: "var(--pub-light-accent,#c49480)" }}>{m[1]}</strong>);
    i++; last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

// ニュース本文をHTML風に装飾して描画（💡ハイライト / ◆小見出し / **太字**）
const NewsContent = ({ content }: { content: string }) => {
  const cleaned = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-=]{3,}\s*$/gm, "")
    .replace(/`([^`]+)`/g, "$1");
  const lines = cleaned.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((raw, idx) => {
        const line = raw.replace(/^\s*[-*]\s+/, "・").trimEnd();
        if (!line.trim()) return <div key={idx} className="h-1" />;
        if (line.startsWith("💡")) {
          return (
            <div key={idx} className="rounded-lg px-3 py-2 text-[13px] font-bold my-1"
              style={{ background: "var(--pub-light-soft,#fbeee6)", color: "var(--pub-light-accent-deep,#b5794f)", borderLeft: "3px solid var(--pub-light-accent,#c49480)" }}>
              {renderInline(line, `h${idx}`)}
            </div>
          );
        }
        if (/^[◆■●▶]/.test(line)) {
          return (
            <p key={idx} className="mt-2.5 mb-0.5 font-bold text-[15px]" style={{ color: "var(--pub-light-accent,#c49480)" }}>
              {renderInline(line.replace(/^[◆■●▶]\s*/, ""), `hd${idx}`)}
            </p>
          );
        }
        return (
          <p key={idx} className="text-sm leading-relaxed" style={{ color: "var(--pub-light-text-strong,#5a5550)" }}>
            {renderInline(line, `p${idx}`)}
          </p>
        );
      })}
    </div>
  );
};

const Top = () => {
  const { store } = useStore();
  const storeName = store?.name ?? "全力エステ 仙台";
  const brandEn = (store?.settings as any)?.brand_en ?? "ZR";
  const [snsContent, setSnsContent] = useState<Record<string, string>>({});
  const [articles, setArticles] = useState<HpArticle[]>([]);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { storeId, loading: storeLoading } = useStore();
  usePageTracking();

  const storeSns = STORE_SNS_DEFS
    .map((d) => ({ ...d, url: snsContent[d.key] || "" }))
    .filter((d) => d.url);

  useEffect(() => {
    document.title = `${storeName}｜仙台のメンズエステ`;
    if (storeLoading) return;
    fetchAll();
  }, [storeLoading, storeId]);

  const fetchAll = async () => {
    const [content, arts] = await Promise.all([
      supabase.from("site_content").select("key, value").like("key", "store_sns_%").eq("store_id", storeId),
      supabase
        .from("hp_articles")
        .select("id, title, slug, content, category, created_at, image_urls")
        .eq("is_published", true)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (content.data) {
      const map: Record<string, string> = {};
      content.data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
      setSnsContent(map);
    }
    if (arts.data) {
      setArticles(arts.data as HpArticle[]);
    }
  };

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-light-bg,#f8f6f3)" }}>
      {/* 左寄せハンバーガーメニュー（ヘッダー・ロゴなし） */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="メニュー"
            className="fixed top-4 left-4 z-50 p-2.5 rounded-md border border-[#d8b25a]/50 bg-black/55 text-[#fbe9a6] backdrop-blur-sm hover:bg-black/75 transition-colors"
          >
            <Menu size={22} />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 border-r border-[var(--pub-dark-border,#3a3634)] text-white" style={{ backgroundColor: "var(--pub-dark,#242220)" }}>
          <nav className="py-4">
            {NAV_ITEMS.map((item) => {
              const cls = "flex items-baseline gap-2 px-5 py-3.5 border-b border-[var(--pub-dark-border-a60,#3a363499)] transition-colors hover:bg-[var(--pub-dark-border-a60,#3a363499)]";
              const inner = (
                <>
                  <span className="text-[var(--pub-light-border,#d8ceca)] font-semibold text-sm tracking-wider">{item.label}</span>
                  <span className="text-[11px] text-[#9a8c88]">{item.sub}</span>
                </>
              );
              return item.external ? (
                <a key={item.to} href={item.to} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setMenuOpen(false)}>{inner}</a>
              ) : (
                <Link key={item.to} to={item.to} className={cls} onClick={() => setMenuOpen(false)}>{inner}</Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* ===== ヒーロー / 理念 / コース ===== */}
      <div className="zrtop">
        {/* 1枚目：ヒーロー */}
        <section className="hero">
          <div className="mono">ZR</div>
          <div className="inner">
            <div className="overline goldtext"><span className="dia" />{brandEn} ｜ {storeName}</div>
            <h1>また、<span className="goldtext">あの人</span>に<br />会いに。</h1>
            <p className="concept">至極のおもてなしは、人がつくる。<br />あなたを覚えている、ただ一人のセラピストへ。</p>
            <div className="cta-row">
              <Link className="btn btn-gold goldfill" to={reserveHref()}>ご予約・空き状況 →</Link>
              <Link className="btn btn-line" to="/casts">セラピスト一覧</Link>
            </div>
          </div>
          <div className="loc">仙台・宮城のメンズエステ</div>
        </section>

        {/* 2枚目：理念 */}
        <section className="philo">
          <div className="over goldtext">OUR PHILOSOPHY ｜ {storeName}</div>
          <h2>技術の前に、<span className="goldtext">人</span>がいる。</h2>
          <p>
            ただ疲れをほぐすだけではありません。<br />
            あなたの名前を、前回の言葉を、今日の表情を覚えている。<br />
            その一人のために手を尽くすから、「また会いに来たい」が生まれる。<br />
            <span className="goldtext">至極のおもてなしは、人がつくる。</span><br />
            その想いを、すべてのコースに込めています。
          </p>
          <button className={`cta goldfill${coursesOpen ? " open" : ""}`} onClick={() => setCoursesOpen((v) => !v)}>
            {coursesOpen ? "コースを閉じる " : "おすすめコースを見る "}<span className="arw">▾</span>
          </button>
        </section>

        {/* 開閉コース */}
        <section id="courses" className={coursesOpen ? "open" : ""}>
          <div className="courses-inner">
            <div className="title goldtext">RECOMMENDED COURSE</div>
            <div className="grid">
              <div className="card">
                <div className="visual">
                  <div className="badge"><span className="star">★</span><span className="n goldtext">No.1</span></div>
                  <div className="cname goldtext">全力コース</div>
                  <div className="cmin goldtext">80分</div>
                  <div className="csub goldtext">× MB &amp; 極液</div>
                </div>
                <div className="cbody">
                  <h3>全力コース × MB/極液</h3>
                  <div className="price goldtext">¥26,000</div>
                  <p className="desc">仙台メンズエステ史上最高値のSPメニュー。疲れや悩みなど、貴方のすべてを出し切ってください。</p>
                  <Link className="reserve-btn goldfill" to={reserveHref("80mb")}>予約する</Link>
                </div>
              </div>

              <div className="card">
                <div className="visual">
                  <div className="cname goldtext">全力コース</div>
                  <div className="cmin goldtext">60分</div>
                </div>
                <div className="cbody">
                  <h3>全力コース 60分</h3>
                  <div className="price goldtext">¥15,000</div>
                  <p className="desc">まずはお試し。60分に凝縮された全力施術でサクッと癒され、明日へのエナジーチャージを。</p>
                  <Link className="reserve-btn goldfill" to={reserveHref("60")}>予約する</Link>
                </div>
              </div>

              <div className="card">
                <div className="visual">
                  <div className="cname goldtext">全力コース</div>
                  <div className="cmin goldtext">80分</div>
                </div>
                <div className="cbody">
                  <h3>全力コース 80分</h3>
                  <div className="price goldtext">¥19,000</div>
                  <p className="desc">たっぷり80分。延長も可能で、豊富なオプションと組み合わせ、貴方だけのオリジナルを。</p>
                  <Link className="reserve-btn goldfill" to={reserveHref("80")}>予約する</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ===== 週間出勤スケジュール ===== */}
      <WeeklyScheduleWidget />

      {/* ===== Web予約 CTA ===== */}
      <div className="py-4 flex gap-2 justify-center flex-wrap" style={{ background: "#2e2b29" }}>
        <Link
          to="/booking"
          className="inline-block bg-[var(--pub-light-accent,#c49480)] hover:bg-[#b08370] text-white font-bold text-sm px-6 py-2.5 rounded shadow transition"
        >
          Web予約はこちら
        </Link>
        <Link
          to="/schedule"
          className="inline-block border border-[var(--pub-light-accent,#c49480)] text-[var(--pub-light-accent,#c49480)] hover:bg-[var(--pub-light-accent-a10,#c494801a)] font-semibold text-sm px-6 py-2.5 rounded transition"
        >
          出勤カレンダー
        </Link>
      </div>

      {/* ===== ニュース ===== */}
      {articles.length > 0 && (
        <section className="py-10 md:py-16" style={{ background: "var(--pub-light-bg,#fdf8f5)" }}>
          <div className="container mx-auto max-w-3xl px-3 md:px-6">
            <SectionTitle en="NEWS" jp="新着情報" />
            <div className="mt-6 space-y-0 divide-y divide-[var(--pub-light-border,#e5d5cc)]">
              {articles.map((a) => (
                <div key={a.id} className="py-4">
                  <button
                    className="w-full text-left group"
                    onClick={() => setExpandedArticle(expandedArticle === a.id ? null : a.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-[var(--pub-light-text-muted,#a89586)] whitespace-nowrap mt-0.5">
                        {format(new Date(a.created_at), "MM/dd")}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5" style={{ background: "var(--pub-light-soft,#f5e1d8)", color: "var(--pub-light-accent,#c49480)" }}>
                        {CATEGORY_LABEL[a.category] ?? a.category}
                      </span>
                      <span className="text-sm font-medium group-hover:text-[var(--pub-light-accent,#c49480)] transition-colors flex-1" style={{ color: "var(--pub-light-text-strong,#5a5550)" }}>
                        {a.title}
                      </span>
                    </div>
                  </button>
                  {expandedArticle === a.id && (
                    <div className="mt-3 ml-[60px]">
                      {a.image_urls && a.image_urls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                          {a.image_urls.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`${a.title} 画像${i + 1}`}
                              loading="lazy"
                              className="h-32 w-auto rounded-md object-cover shrink-0 border border-[var(--pub-light-border,#e5d5cc)]"
                            />
                          ))}
                        </div>
                      )}
                      {a.content && <NewsContent content={a.content} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== 店舗公式SNS ===== */}
      <section
        className="py-10 md:py-16"
        style={{ background: "linear-gradient(135deg, var(--pub-light-soft,#efd0c2) 0%, var(--pub-light-soft,#f5e1d8) 50%, var(--pub-light-soft,#efd0c2) 100%)" }}
      >
        <div className="container mx-auto max-w-3xl px-3 md:px-6 text-center">
          <SectionTitle en="OFFICIAL SNS" jp="店舗公式SNS" />
          <p className="text-sm mt-2" style={{ color: "var(--pub-light-text,#7a706c)" }}>
            最短のご案内情報はこちらからご確認いただけます。
          </p>
          <div className="grid gap-3 sm:grid-cols-2 mt-6 md:mt-8">
            {storeSns.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition border border-[var(--pub-light-border,#e5d5cc)]"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 text-white font-bold" style={{ backgroundColor: s.color }}>
                  {s.short}
                </span>
                <span className="flex-1 text-left">
                  <span className="block font-bold text-sm" style={{ color: "var(--pub-light-text,#7a706c)" }}>{s.label}</span>
                  <span className="text-xs text-[var(--pub-light-text-muted,#a89586)]">最新情報はこちら</span>
                </span>
                <ExternalLink size={16} className="text-[var(--pub-light-accent,#c49480)] shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
};

const SectionTitle = ({ en, jp }: { en: string; jp: string }) => (
  <div className="text-center">
    <h2 className="text-2xl md:text-4xl font-bold tracking-[0.3em]" style={{ color: "var(--pub-light-text,#7a706c)" }}>
      {en}
    </h2>
    <p className="text-xs md:text-sm mt-1 tracking-widest text-[var(--pub-light-text-muted,#a89586)]">{jp}</p>
    <div className="mx-auto mt-2 h-px w-12 bg-[var(--pub-light-accent,#c49480)]" />
  </div>
);

export default Top;
