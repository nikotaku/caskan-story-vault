import { useEffect, useState } from "react";
import benefitPrivateRoomImage from "@/assets/recruit/enka-benefit-private-room.png";
import benefitSnsManagementImage from "@/assets/recruit/enka-benefit-sns-management.png";
import benefitTaxiImage from "@/assets/recruit/enka-benefit-taxi.png";
import benefitTaxHousingImage from "@/assets/recruit/enka-benefit-tax-housing.png";
import { useStore } from "@/hooks/useStore";
import { usePageTracking } from "@/hooks/usePageTracking";
import {
  assignRecruitVariant,
  recordRecruitEvent,
  RECRUIT_EXPERIMENT_ID,
  type RecruitVariant,
} from "@/lib/recruitExperiment";
import { isRecruitVariant } from "@/lib/recruitExperimentConfig";
import {
  Sparkles, Banknote, Clock, Shield, Heart, Check, ChevronDown,
  Home, Train, CalendarDays, UserCheck, MessageCircle, Star, ArrowRight,
} from "lucide-react";

/**
 * 採用LP。HPの「求人情報」からリンクされる公開ページ。
 * 面談時にビデオ通話で画面共有しながら見せる用途も兼ねる。縦スクロール構成。
 */

const HERO_CONTENT: Record<RecruitVariant, {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
}> = {
  safety_first: {
    eyebrow: "仙台・未経験から始めるセラピスト求人",
    title: <>無理なく、安心して<br />続けられる働き方を。</>,
    description: <>顔出し不要・ノルマなし・個室待機。<br />不安なことは、始める前にすべて相談できます。</>,
  },
  freedom_first: {
    eyebrow: "仙台・自分のペースで働くセラピスト求人",
    title: <>働く時間も、始め方も、<br />あなたのペースで。</>,
    description: <>週1日・短時間・副業・短期も相談OK。<br />予定に合わせて、無理なく始められます。</>,
  },
};

const RECRUIT_CTA_LABEL = "LINEでまず相談する";
const ENKA_STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";
const ENKA_RECRUIT_LINE_URL = "https://lin.ee/UCwlbv5";
const ENKA_BENEFITS = [
  {
    image: benefitSnsManagementImage,
    alt: "SNS投稿・写メ日記・お客様への営業をお店が管理するサポート",
    title: "SNS投稿・営業をお店が管理",
    description: "面倒なSNS投稿や写メ日記の更新、お客様への営業連絡はお店がまとめて対応。接客に集中できます。",
  },
  {
    image: benefitTaxiImage,
    alt: "終電後など遅い時間の帰宅に対応するタクシー送迎",
    title: "タクシー送迎あり",
    description: "終電後など遅い時間の帰宅は、タクシー送迎に対応します。対応できる地域や条件は、出勤前にご相談ください。",
  },
  {
    image: benefitTaxHousingImage,
    alt: "税金面のサポートと不動産会社・アリバイ会社の紹介",
    title: "税金・住まいもサポート",
    description: "税金面の相談は必要に応じて専門家をご案内。不動産会社・アリバイ会社の紹介にも対応します。",
  },
  {
    image: benefitPrivateRoomImage,
    alt: "プライバシーに配慮した1人1ルームの個室待機",
    title: "1人1ルームで個室待機",
    description: "待機中は1人1ルームの個室をご用意。他のセラピストと顔を合わせにくく、プライバシーに配慮しています。",
  },
] as const;

function recruitPreviewVariant(): RecruitVariant | null {
  const value = new URLSearchParams(window.location.search).get("recruit_preview");
  return isRecruitVariant(value) ? value : null;
}

export default function RecruitTalk() {
  usePageTracking();
  const { store, storeId, loading: storeLoading } = useStore();
  const storeName = store?.name ?? "艶華";
  const isDefaultStore = store?.is_default ?? true;
  const configuredBrand = typeof store?.settings?.brand_en === "string"
    ? store.settings.brand_en
    : undefined;
  const configuredRecruitLine = typeof store?.settings?.recruit_line_url === "string"
    ? store.settings.recruit_line_url
    : undefined;
  const recruitLineUrl = configuredRecruitLine
    ?? (storeId === ENKA_STORE_ID ? ENKA_RECRUIT_LINE_URL : null);
  const previewVariant = recruitPreviewVariant();
  const trackingDisabled = previewVariant !== null
    || new URLSearchParams(window.location.search).get("recruit_tracking") === "off";
  const brandEn = isDefaultStore
    ? "ZENRYOKU ESTHE"
    : configuredBrand ?? "ENKA";
  const [variant, setVariant] = useState<RecruitVariant | null>(null);

  useEffect(() => {
    document.title = `${storeName} 採用案内`;
  }, [storeName]);

  useEffect(() => {
    if (storeLoading) return;
    setVariant(previewVariant ?? assignRecruitVariant(storeId));
  }, [previewVariant, storeId, storeLoading]);

  useEffect(() => {
    if (!variant || storeLoading || trackingDisabled) return;
    recordRecruitEvent(storeId, variant, "exposure").catch(() => {});
  }, [storeId, storeLoading, trackingDisabled, variant]);

  const handleRecruitClick = () => {
    if (!variant || trackingDisabled) return;
    recordRecruitEvent(storeId, variant, "cta_click").catch(() => {});
  };

  const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <section className={`px-6 py-16 ${className}`}>
      <div className="max-w-2xl mx-auto">{children}</div>
    </section>
  );

  const SectionTitle = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
    <div className="text-center mb-10">
      {sub && <p className="text-rose-400 text-sm font-bold tracking-widest mb-2">{sub}</p>}
      <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{children}</h2>
    </div>
  );

  if (storeLoading || !variant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-400 via-pink-400 to-amber-300 text-sm font-medium text-white">
        求人情報を読み込んでいます
      </div>
    );
  }

  const hero = HERO_CONTENT[variant];

  return (
    <div
      className="min-h-screen bg-white text-gray-800"
      data-recruit-experiment={RECRUIT_EXPERIMENT_ID}
      data-recruit-variant={variant}
      data-recruit-preview={previewVariant ? "true" : undefined}
    >
      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden bg-gradient-to-br from-rose-400 via-pink-400 to-amber-300">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <Sparkles className="absolute top-20 left-10 text-white" size={40} />
          <Heart className="absolute top-40 right-12 text-white fill-white" size={28} />
          <Sparkles className="absolute bottom-32 right-20 text-white" size={32} />
          <Heart className="absolute bottom-48 left-16 text-white fill-white" size={20} />
        </div>
        <div className="relative text-white">
          <p className="text-sm font-bold tracking-[0.3em] mb-4 opacity-90">{brandEn}</p>
          <p className="text-xs md:text-sm font-medium mb-4 opacity-90">{hero.eyebrow}</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            {hero.title}
          </h1>
          <p className="text-base md:text-lg leading-relaxed opacity-95 mb-10">
            {hero.description}
          </p>
          <div className="flex flex-col items-center gap-4">
            {recruitLineUrl && (
              <a
                href={recruitLineUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleRecruitClick}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 font-bold text-rose-500 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <MessageCircle size={20} />
                {RECRUIT_CTA_LABEL}
                <ArrowRight size={18} />
              </a>
            )}
            <a href="#recruit-details" className="inline-flex flex-col items-center gap-1 text-xs opacity-90">
              条件を見る
              <ChevronDown size={22} className="animate-bounce" />
            </a>
          </div>
        </div>
      </section>

      {/* ===== 最初に伝える3つの安心 ===== */}
      <Section className="bg-rose-50" >
        <div id="recruit-details" className="scroll-mt-6" />
        <SectionTitle sub="START HERE">安心して始められる3つの理由</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: "未経験", label: "丁寧にサポート" },
            { value: "日払い", label: "支払い方法を事前確認" },
            { value: "自由", label: "出勤シフト" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 text-center shadow-sm">
              <p className="text-xl md:text-2xl font-bold text-rose-500">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== 報酬・契約条件 ===== */}
      <Section>
        <SectionTitle sub="REWARD">報酬条件は、始める前に確認できます</SectionTitle>
        <div className="bg-gradient-to-br from-rose-50 to-amber-50 rounded-3xl p-6 text-center">
          <Banknote size={36} className="mx-auto mb-4 text-rose-500" />
          <p className="text-xl font-bold text-gray-800 mb-3">わからないまま契約することはありません</p>
          <p className="text-sm text-gray-600 leading-7">
            報酬の仕組み、支払い方法、控除、保証条件を事前にわかりやすくご説明します。<br className="hidden sm:block" />
            内容を確認してから、働くかどうかを決められます。
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {[
            { title: "日払いOK", desc: "受け取り方法を事前に確認" },
            { title: "ノルマなし", desc: "無理な本数目標はありません" },
            { title: "個別にご案内", desc: "経験や働き方に合わせて説明" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-rose-100 p-4 text-center">
              <p className="font-bold text-rose-500">{item.title}</p>
              <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== 艶華の4つのメリット ===== */}
      {storeId === ENKA_STORE_ID && (
        <Section className="bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50">
          <SectionTitle sub="ENKA BENEFITS">艶華で働く4つのメリット</SectionTitle>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {ENKA_BENEFITS.map((benefit) => (
              <article
                key={benefit.title}
                className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-sm"
              >
                <img
                  src={benefit.image}
                  alt={benefit.alt}
                  width={400}
                  height={400}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-800">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-gray-600">{benefit.description}</p>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      {/* ===== 働きやすさ ===== */}
      <Section className="bg-rose-50">
        <SectionTitle sub="WORK STYLE">あなたのペースで働ける</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: CalendarDays, title: "完全自由出勤", desc: "週1日・短時間も相談OK。予定に合わせて自由に。" },
            { icon: Check, title: "ノルマなし", desc: "本数・指名のノルマは一切ありません。" },
            { icon: Banknote, title: "日払いOK", desc: "働いたその日にお給料を受け取れます。" },
            { icon: Home, title: "個室待機", desc: "プライベートが守られた個室で待機。" },
            { icon: Train, title: "交通費支給", desc: "交通費の支給あり。出稼ぎも大歓迎。" },
            { icon: Clock, title: "短期・体験OK", desc: "まずは体験入店からでも大丈夫。" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mb-3">
                  <Icon size={20} className="text-rose-500" />
                </div>
                <p className="font-bold text-gray-800 mb-1">{f.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ===== 安心・サポート ===== */}
      <Section>
        <SectionTitle sub="SUPPORT">未経験でも安心のサポート</SectionTitle>
        <div className="space-y-4">
          {[
            { icon: UserCheck, title: "未経験からでも安心", desc: "ていねいな講習があるので、一から安心して始められます。" },
            { icon: Shield, title: "プライバシー厳守", desc: "顔出し不要。お写真の加工・モザイクも対応。身バレ対策を徹底しています。" },
            { icon: Heart, title: "女性も働きやすい環境", desc: "相談しやすい体制と清潔なルーム。困ったことはいつでもスタッフがサポート。" },
            { icon: Star, title: "集客をサポート", desc: "ホームページ・SNS・求人サイトを活用し、お仕事につながる発信を支えます。" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex gap-4 bg-rose-50/60 rounded-2xl p-5">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-rose-500 flex items-center justify-center">
                  <Icon size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 mb-1">{f.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ===== こんな方にピッタリ ===== */}
      <Section className="bg-gradient-to-br from-rose-100 to-amber-50">
        <SectionTitle sub="FIT">こんな方にピッタリ</SectionTitle>
        <div className="bg-white rounded-3xl p-6 space-y-3">
          {[
            "スキマ時間で効率よく稼ぎたい",
            "プライバシーを守って働きたい",
            "ノルマや人間関係のストレスが苦手",
            "未経験だけどチャレンジしてみたい",
            "Wワーク・副業として始めたい",
            "出稼ぎで短期集中で稼ぎたい",
          ].map((t) => (
            <div key={t} className="flex items-center gap-3">
              <div className="w-6 h-6 shrink-0 rounded-full bg-rose-500 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </div>
              <span className="text-sm text-gray-700">{t}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== 1日の流れ ===== */}
      <Section>
        <SectionTitle sub="A DAY">お仕事の1日の流れ</SectionTitle>
        <div className="space-y-0">
          {[
            { time: "出勤", desc: "好きな時間に出勤。身支度をして待機します。" },
            { time: "ご予約", desc: "予約が入ったらお部屋へ。お客様をお迎えします。" },
            { time: "施術", desc: "アロマトリートメントで癒しを提供（講習でしっかり練習します）。" },
            { time: "お見送り", desc: "施術後はお見送り。次の予約まで自由に休憩。" },
            { time: "退勤・精算", desc: "退勤時にその日のお給料を精算（日払いOK）。" },
          ].map((s, i, arr) => (
            <div key={s.time} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-rose-500 mt-1.5" />
                {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-rose-200" />}
              </div>
              <div className="pb-6">
                <p className="font-bold text-rose-500">{s.time}</p>
                <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== FAQ ===== */}
      <Section className="bg-rose-50">
        <SectionTitle sub="FAQ">よくあるご質問</SectionTitle>
        <div className="space-y-3">
          {[
            { q: "未経験でも大丈夫ですか？", a: "はい。講習で一から練習できるので安心してください。" },
            { q: "身バレが心配です…", a: "顔出しは不要です。お写真の加工やモザイク対応もできるので、プライバシーはしっかり守られます。" },
            { q: "ノルマはありますか？", a: "ノルマは一切ありません。あなたのペースで無理なく働けます。" },
            { q: "報酬条件はいつ確認できますか？", a: "お問い合わせ後、契約前に報酬の仕組み・支払い方法・控除・保証条件をご説明します。内容を確認してから判断できます。" },
            { q: "出稼ぎでも働けますか？", a: "もちろん歓迎です。交通費の支給もあるのでお気軽にご相談ください。" },
          ].map((f) => (
            <div key={f.q} className="bg-white rounded-2xl p-5">
              <p className="font-bold text-gray-800 mb-1.5">Q. {f.q}</p>
              <p className="text-sm text-gray-600 leading-relaxed">A. {f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== CTA ===== */}
      <section className="px-6 py-20 text-center bg-gradient-to-br from-rose-500 to-pink-500 text-white">
        <div className="max-w-xl mx-auto">
          <MessageCircle size={40} className="mx-auto mb-4 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">まずは体験から、<br />お気軽にどうぞ♡</h2>
          <p className="opacity-95 leading-relaxed mb-8">
            「ちょっと気になる」「話だけ聞きたい」でも大歓迎。<br />
            あなたに合った働き方を一緒に考えます。
          </p>
          {recruitLineUrl && (
            <a
              href={recruitLineUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleRecruitClick}
              className="mx-auto inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 font-bold text-rose-500 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <MessageCircle size={20} />
              {RECRUIT_CTA_LABEL}
              <ArrowRight size={18} />
            </a>
          )}
          <p className="mt-5 text-xs opacity-80">応募を決める前の質問だけでも大丈夫です</p>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-gray-400">
        {storeName} 採用案内
      </footer>
    </div>
  );
}
