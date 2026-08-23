import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import {
  Sparkles, Banknote, Clock, Shield, Heart, Check, ChevronDown,
  Home, Train, CalendarDays, UserCheck, MessageCircle, Star,
} from "lucide-react";

/**
 * 採用LP。HPの「求人情報」からリンクされる公開ページ。
 * 面談時にビデオ通話で画面共有しながら見せる用途も兼ねる。縦スクロール構成。
 */

interface BackRate {
  course_type: string;
  duration: number;
  customer_price: number;
  therapist_back: number;
}

const yen = (v: number) => `¥${v.toLocaleString()}`;

export default function RecruitTalk() {
  const { store, storeId } = useStore();
  const storeName = store?.name ?? "艶華";
  const isDefaultStore = store?.is_default ?? true;
  const brandEn = isDefaultStore
    ? "ZENRYOKU ESTHE"
    : ((store?.settings as any)?.brand_en as string | undefined) ?? "ENKA";
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [castCount, setCastCount] = useState<number | null>(null);

  useEffect(() => {
    document.title = `${storeName} 採用案内`;
    // 店舗の料金・在籍数のみ表示（他店舗のデータを混在させない）
    supabase.from("back_rates").select("course_type, duration, customer_price, therapist_back")
      .eq("store_id", storeId)
      .then(({ data }) => setBackRates((data || []) as BackRate[]));
    supabase.from("casts").select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count }) => setCastCount(count ?? null));
  }, [storeId, storeName]);

  // 最高バック（1本あたり）
  const maxBack = backRates.length ? Math.max(...backRates.map((r) => r.therapist_back)) : 17000;
  // 代表的な給与例：80分のバック（無ければ最大バック）
  const mainBack = backRates.find((r) => r.duration === 80)?.therapist_back
    ?? backRates[0]?.therapist_back ?? 10000;
  const daily3 = mainBack * 3;
  const monthly12 = daily3 * 12;

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

  return (
    <div className="min-h-screen bg-white text-gray-800">
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
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            {isDefaultStore ? (
              <>あなたの“全力”が、<br />ちゃんと評価される場所。</>
            ) : (
              <>あなたの“艶”が、<br />いちばん咲き誇る場所。</>
            )}
          </h1>
          <p className="text-base md:text-lg leading-relaxed opacity-95 mb-10">
            高還元・完全自由出勤・未経験OK。<br />
            あなたらしく、無理なく稼げる環境を用意しています。
          </p>
          <div className="inline-flex flex-col items-center gap-2 animate-bounce">
            <span className="text-xs opacity-90">下にスクロール</span>
            <ChevronDown size={24} />
          </div>
        </div>
      </section>

      {/* ===== 数字 ===== */}
      <Section className="bg-rose-50">
        <SectionTitle sub="NUMBERS">数字で見る{storeName}</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: castCount != null ? `${castCount}名` : "30名+", label: "在籍セラピスト" },
            { value: `${yen(maxBack)}`, label: "1本最大バック" },
            { value: "自由", label: "出勤シフト" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 text-center shadow-sm">
              <p className="text-2xl md:text-3xl font-bold text-rose-500">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== 給与システム ===== */}
      <Section>
        <SectionTitle sub="SALARY">しっかり稼げる給与システム</SectionTitle>
        <div className="rounded-3xl border border-rose-100 overflow-hidden mb-8">
          <div className="bg-rose-500 text-white px-5 py-3 font-bold text-center">コース別バック（1本あたり）</div>
          <div className="divide-y divide-rose-50">
            {(backRates.length ? backRates : []).map((r) => (
              <div key={`${r.course_type}-${r.duration}`} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-600">{r.course_type} {r.duration}分</span>
                <span className="text-lg font-bold text-rose-500">{yen(r.therapist_back)}</span>
              </div>
            ))}
            {backRates.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-gray-400">読み込み中…</div>
            )}
          </div>
        </div>

        {/* 給与例 */}
        <div className="bg-gradient-to-br from-rose-50 to-amber-50 rounded-3xl p-6 text-center">
          <p className="text-sm font-bold text-rose-500 mb-3">＼ たとえば… ／</p>
          <p className="text-gray-700 leading-relaxed">
            1日 <span className="font-bold text-rose-500">3本</span> 入れば
          </p>
          <p className="text-4xl font-bold text-rose-500 my-2">{yen(daily3)}<span className="text-base font-medium text-gray-500">／日</span></p>
          <p className="text-gray-700 leading-relaxed">
            週3ペース（月12日）なら
            <span className="block text-2xl font-bold text-rose-500 mt-1">月 {yen(monthly12)} 以上</span>
          </p>
          <p className="text-xs text-gray-400 mt-3">
            ※ 指名バック・オプションバックは別途上乗せ。<br />限定コース中心ならさらに高収入も可能です。
          </p>
        </div>
      </Section>

      {/* ===== 働きやすさ ===== */}
      <Section className="bg-rose-50">
        <SectionTitle sub="WORK STYLE">あなたのペースで働ける</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: CalendarDays, title: "完全自由出勤", desc: "週1日・1日2時間〜OK。予定に合わせて自由に。" },
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
            { icon: UserCheck, title: "未経験スタート9割", desc: "ていねいな講習があるので、未経験の方がほとんど。一から安心して始められます。" },
            { icon: Shield, title: "プライバシー厳守", desc: "顔出し不要。お写真の加工・モザイクも対応。身バレ対策を徹底しています。" },
            { icon: Heart, title: "女性も働きやすい環境", desc: "相談しやすい体制と清潔なルーム。困ったことはいつでもスタッフがサポート。" },
            { icon: Star, title: "高い集客力", desc: "ホームページ・SNS・口コミサイトで集客に力を入れているので、指名・リピートが付きやすい環境です。" },
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
            { q: "未経験でも大丈夫ですか？", a: "はい。在籍の9割が未経験スタートです。講習で一から練習できるので安心してください。" },
            { q: "身バレが心配です…", a: "顔出しは不要です。お写真の加工やモザイク対応もできるので、プライバシーはしっかり守られます。" },
            { q: "ノルマはありますか？", a: "ノルマは一切ありません。あなたのペースで無理なく働けます。" },
            { q: "どのくらい稼げますか？", a: `1本あたり最大${yen(maxBack)}のバック。1日3本入れば${yen(daily3)}/日が目安です。` },
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
          <div className="bg-white/15 backdrop-blur rounded-2xl p-6">
            <p className="text-sm opacity-90 mb-1">この後、担当スタッフが</p>
            <p className="text-lg font-bold">条件・お給料の詳細をご案内します</p>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-gray-400">
        {storeName} 採用案内
      </footer>
    </div>
  );
}
