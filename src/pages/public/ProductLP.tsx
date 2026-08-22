import {
  CalendarDays,
  MessageSquare,
  CalendarRange,
  BarChart3,
  Calculator,
  Heart,
  Globe,
  Sparkles,
  Smartphone,
  GraduationCap,
  FolderArchive,
  Store,
  Check,
} from "lucide-react";

const PAINS = [
  "予約はLINE、シフトはスプレッドシート、売上はノート…情報がバラバラ",
  "毎晩の精算でバック率を電卓計算。ミスも揉め事も起きる",
  "お客様の好みやNGを覚えきれず、リピート営業が属人化",
  "HPの更新は外注頼み。写メ日記もお知らせも反映が遅い",
  "予約確認SMSを毎回手打ち。サンクス連絡は忘れがち",
  "オーナーが倒れたら誰も契約・パスワード・固定費が分からない",
];

const FEATURES = [
  {
    icon: CalendarDays,
    tag: "予約管理",
    title: "予約タイムテーブル",
    desc: "セラピスト×時間軸のタイムラインに予約を一覧表示。確認中／SMS待ち／確定／完了のステータスボードで当日の動きを見える化。タップで予約詳細・編集まで完結。",
  },
  {
    icon: MessageSquare,
    tag: "SMS連携",
    title: "ワンタップSMS送信",
    desc: "予約確認SMS・サンクスSMSをテンプレート登録しておけば、ボタンひとつでお客様の電話番号宛てに本文入りのSMS送信画面が起動。料金明細・ルーム住所・決済リンクも自動挿入。",
  },
  {
    icon: CalendarRange,
    tag: "シフト",
    title: "月別シフト管理",
    desc: "カレンダー／ダミー用の2ビュー。ルームごとの色分け表示で「どの部屋が埋まっているか」が一目瞭然。セラピストからのシフト提出→承認フローにも対応。",
  },
  {
    icon: BarChart3,
    tag: "売上管理",
    title: "売上ダッシュボード",
    desc: "月別売上・日別精算・カード／PayPay売上・売上目標・経費・広告費・控除・紹介報酬までワンページに集約。グラフで推移を確認、確認待ち予約のアラートも。",
  },
  {
    icon: Calculator,
    tag: "精算",
    title: "報酬の自動計算",
    desc: "コース・オプション・指名ごとのバック率をマスタ登録すれば、予約からセラピスト報酬を自動計算。雑費・宿泊費・交通費を引いた日払い額まで一発算出、精算レシートも発行。",
  },
  {
    icon: Heart,
    tag: "顧客CRM",
    title: "顧客カルテ・営業管理",
    desc: "圧の好み・気になる部位・会話の好み・NGを電話ヒアリングしながら記録。来店回数・累計利用額からVIP/常連/リピーターを自動判定し、「30日来てない顧客」を抽出してフォロー。",
  },
  {
    icon: Globe,
    tag: "集客",
    title: "集客HP一体型",
    desc: "出勤表・セラピスト一覧・料金・予約フォームつきの公式HPが管理画面と完全連動。記事・タイムライン・おすすめメニュー・SNSリンクも管理画面から即更新。",
  },
  {
    icon: Sparkles,
    tag: "AI",
    title: "AI文章生成",
    desc: "セラピスト紹介文・お知らせ・キャッチコピー・クーポン文・入店速報をAIが自動生成。文章が苦手でも、プロ品質の集客テキストが数秒で完成。",
  },
  {
    icon: Smartphone,
    tag: "セラピスト向け",
    title: "セラピストポータル",
    desc: "セラピストはログイン不要のマイページから、シフト提出・精算明細の確認・担当顧客のカルテ閲覧・交通費申請・写メ日記投稿まで。スマホ完結で店との連絡コストを削減。",
  },
  {
    icon: GraduationCap,
    tag: "教育",
    title: "教育・マニュアル",
    desc: "研修カリキュラムの受講進捗をセラピスト別に管理。パネル撮影マニュアル・接客マニュアル・採用基準シートも管理画面から編集でき、新人教育を標準化。",
  },
  {
    icon: FolderArchive,
    tag: "事業継続",
    title: "引き継ぎセンター",
    desc: "業者一覧・ログイン情報・固定費・銀行口座・賃貸契約・備品まで店舗運営の裏側を一元管理。「オーナーにしか分からない」をなくし、事業承継・多店舗化に備える。",
  },
  {
    icon: Store,
    tag: "多店舗",
    title: "マルチ店舗対応",
    desc: "1つのシステムで複数店舗を運営。店舗ごとにサブドメイン・ロゴ・テーマカラーを設定でき、データは店舗単位で完全分離。2号店の立ち上げも即日。",
  },
];

const STRENGTHS = [
  {
    title: "業態に最適化された設計",
    desc: "指名種別ごとのバック率、ルーム運用、深夜またぎ営業（〜翌2時表記）、写メ日記文化まで。メンズエステ／リラクゼーションの現場運用をそのままシステム化しています。",
  },
  {
    title: "集客から精算まで分断ゼロ",
    desc: "HPで入った予約がそのままタイムテーブルへ、完了した予約がそのまま売上・顧客統計・報酬計算へ。転記作業も二重入力も発生しません。",
  },
  {
    title: "スマホファースト",
    desc: "管理画面・セラピストポータルともスマホ最適化。SMS送信画面のワンタップ起動など、「店に居ない時間」の運営を前提に作られています。",
  },
];

const FLOW = [
  { title: "無料相談・デモ", desc: "現在の運営状況をヒアリングし、実際の画面をご覧いただきます。" },
  { title: "初期設定", desc: "コース・バック率・ルーム・セラピスト情報を弊社側でセットアップ。" },
  { title: "データ移行", desc: "既存の顧客・予約データはスプレッドシートからインポート可能。" },
  { title: "運用開始", desc: "独自ドメインのHPを公開し、その日から予約受付・精算を開始。" },
];

const FAQS = [
  {
    q: "PCがなくても使えますか？",
    a: "はい。管理画面・セラピストポータルともスマホ最適化済みで、日々の運用はスマホだけで完結できます。",
  },
  {
    q: "既存のホームページや予約データはどうなりますか？",
    a: "顧客・予約データはスプレッドシートからのインポートに対応。HPは独自ドメインを設定でき、システム付属の公式HPに置き換えられます。",
  },
  {
    q: "複数店舗で使えますか？",
    a: "1契約で複数店舗に対応しています。店舗ごとにサブドメイン・デザインを分けつつ、データは完全に分離されます。",
  },
  {
    q: "セラピストにアカウントを配る必要はありますか？",
    a: "不要です。セラピストには専用URLを渡すだけで、シフト提出や精算確認ができるマイページが使えます。",
  },
  {
    q: "料金はいくらですか？",
    a: "店舗規模・必要な機能に応じてご提案します。まずは無料相談でお見積もりください。",
  },
];

const CONTACT_HREF = "mailto:saito.crow@gmail.com?subject=" + encodeURIComponent("キャス管デモ依頼");

export default function ProductLP() {
  return (
    <div className="min-h-screen bg-white text-[#1e1b2e]">
      {/* Hero */}
      <header className="bg-gradient-to-br from-[#1e1b2e] via-[#2d1f54] to-[#4c1d95] text-white text-center px-5 py-24">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block bg-white/15 border border-white/25 rounded-full px-4 py-1.5 text-xs tracking-wider mb-6">
            メンズエステ・リラクゼーションサロン専用
          </span>
          <h1 className="text-3xl md:text-5xl font-bold leading-snug mb-5">
            店舗運営のすべてを、
            <br />
            <span className="text-violet-300">ひとつの管理画面</span>に。
          </h1>
          <p className="text-white/85 text-base md:text-lg mb-9">
            予約・シフト・売上・精算・顧客カルテ・集客HPまで。
            <br className="hidden md:block" />
            スプレッドシートと手作業の運営から卒業する、オールインワン店舗管理システム「キャス管」。
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={CONTACT_HREF}
              className="rounded-full bg-violet-600 hover:bg-violet-500 transition-colors px-10 py-4 font-bold shadow-lg shadow-violet-900/40"
            >
              無料デモを依頼する
            </a>
            <a
              href="#features"
              className="rounded-full bg-white text-violet-700 hover:bg-violet-50 transition-colors px-10 py-4 font-bold"
            >
              機能を見る
            </a>
          </div>
          <p className="text-white/60 text-xs mt-4">導入相談・デモは無料。スマホだけでも運用できます。</p>
        </div>
      </header>

      {/* Pain */}
      <section className="bg-[#f7f5fb] px-5 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">こんな運営、続けますか？</h2>
          <p className="text-center text-muted-foreground text-sm mb-10">
            小規模サロンの「あるある」を、キャス管はゼロにします。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAINS.map((p) => (
              <div key={p} className="bg-white border rounded-xl p-5 text-sm">
                <span className="text-rose-600 font-bold mr-2">✕</span>
                {p}
              </div>
            ))}
          </div>
          <p className="text-center text-violet-600 text-3xl mt-9 mb-2">▼</p>
          <p className="text-center text-xl font-bold">
            キャス管なら、ぜんぶ <span className="text-violet-600">1つの画面</span> で完結します。
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-5 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">主な機能</h2>
          <p className="text-center text-muted-foreground text-sm mb-10">
            現場のオーナーの要望から生まれた、実戦仕様の機能群。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="border rounded-2xl p-6 hover:shadow-lg transition-shadow">
                  <div className="p-2 rounded-lg bg-violet-100 w-fit mb-3">
                    <Icon size={22} className="text-violet-700" />
                  </div>
                  <span className="inline-block text-[11px] font-bold bg-violet-50 text-violet-700 rounded-full px-2.5 py-0.5 mb-2">
                    {f.tag}
                  </span>
                  <h3 className="font-bold mb-2">{f.title}</h3>
                  <p className="text-[13.5px] text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Strengths */}
      <section className="bg-[#f7f5fb] px-5 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">キャス管が選ばれる理由</h2>
          <p className="text-center text-muted-foreground text-sm mb-10">
            汎用POSでも、予約サイト依存でもない「業態特化」の強み。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STRENGTHS.map((s) => (
              <div key={s.title} className="bg-white rounded-2xl p-7 border-t-4 border-violet-600">
                <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="px-5 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">導入までの流れ</h2>
          <p className="text-center text-muted-foreground text-sm mb-10">最短数日で運用開始できます。</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FLOW.map((step, i) => (
              <div key={step.title} className="border rounded-xl p-6 text-center">
                <div className="w-9 h-9 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center mx-auto mb-3">
                  {i + 1}
                </div>
                <h3 className="font-bold text-sm mb-1.5">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#f7f5fb] px-5 py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">よくある質問</h2>
          <div>
            {FAQS.map((f) => (
              <div key={f.q} className="border-b py-5">
                <p className="font-bold mb-1.5">
                  <span className="text-violet-600">Q. </span>
                  {f.q}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-rose-600 font-bold">A. </span>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-[#2d1f54] to-[#4c1d95] text-white text-center px-5 py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">まずは画面を見てみませんか？</h2>
          <p className="text-white/80 mb-8">
            実際に稼働している店舗の管理画面をベースに、御社の運用に合わせたデモをお見せします。
          </p>
          <a
            href={CONTACT_HREF}
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 hover:bg-violet-500 transition-colors px-10 py-4 font-bold shadow-lg shadow-violet-900/40"
          >
            <Check size={18} />
            無料デモを依頼する
          </a>
        </div>
      </section>

      <footer className="py-7 text-center text-xs text-muted-foreground">
        <p>© 2026 caskan.jp All rights reserved</p>
      </footer>
    </div>
  );
}
