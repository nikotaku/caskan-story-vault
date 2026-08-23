import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, DoorOpen, Ban, MessageCircleHeart, HandHeart, RotateCcw, ListChecks } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface ManualItem {
  id: string;
  title: string;
  points?: string[];
  note?: string;
}

interface SubSection {
  subTitle: string;
  items: ManualItem[];
}

interface ManualSection {
  id: string;
  title: string;
  icon: any;
  intro?: string;
  numbered?: boolean;
  items?: ManualItem[];
  subSections?: SubSection[];
}

// 出典: 旧入店ガイドブック（施術編）
const SECTIONS: ManualSection[] = [
  {
    id: "flow",
    title: "入室から退室までの流れ",
    icon: DoorOpen,
    numbered: true,
    items: [
      { id: "flow-1", title: "入室時", points: ["手を繋ぐ", "バッグを持つ", "触れる"] },
      { id: "flow-2", title: "ドリンク出し", points: ["体を寄せる", "膝立ちで説明する", "谷間やパンツが見えるか見えないかの角度で"] },
      { id: "flow-3", title: "前着替え", points: ["脱がせてあげる", "畳んであげる", "紙パンツは“履かせる”"] },
      { id: "flow-4", title: "前シャワー", points: ["スポンジを開けて泡立てておく", "シャワーを出しておく", "アメニティの説明"] },
      { id: "flow-5", title: "紙パンツを履かせる", points: ["履かせてあげることで優位な立場が作れる", "お触りなどの発生も少なくなる", "子供のように扱うこと"] },
      { id: "flow-6", title: "施術", points: ["お客様にあぐらをかかせる", "バックハグの形", "ここでアイスブレイク"] },
      { id: "flow-7", title: "後シャワー", points: ["施術後用のサンダルを用意", "タオルを洗面所に置く", "ルームを綺麗にしておく"] },
      { id: "flow-8", title: "後着替え", points: ["ノーパン・ノーブラで", "お尻をお客さん側に向けて", "マットの掃除をする"] },
      { id: "flow-9", title: "オンオフの切り替え", points: ["可愛い女から“エロい女”に変身する", "照明の調整", "メイクの手直し（暗いところでは濃いめにすると良い）", "髪型 — 人はギャップに弱い"] },
      { id: "flow-10", title: "気温確認・タオルワーク", points: ["「部屋の温度はいかがですか？」などの確認を", "施術してない箇所はタオルをかける/かけないの確認をしながら、客に合わせて心地の良い状態をキープ"] },
    ],
  },
  {
    id: "dont",
    title: "“あえて”やらない事リスト",
    icon: Ban,
    items: [
      { id: "dont-1", title: "手作り名刺・お菓子などのプレゼント", note: "家庭を持つ人からしたらゴミ。とっておきの日だけにしていた方が吉" },
      { id: "dont-2", title: "Xに食べ物の写真", note: "Xはインスタではない。女漁りの場です。服屋に刺身があってもわざわざ買わない" },
      { id: "dont-3", title: "夜出勤", note: "眠い・だるい・疲れる、客が怖い、メンヘラは避けるべし" },
      { id: "dont-4", title: "中途半端なリアクション", note: "「すご〜い！」「さすが！」しか言えない人は切り上げよう。熱く語った先には強い絆が生まれる" },
    ],
  },
  {
    id: "tips",
    title: "接客のコツ",
    icon: MessageCircleHeart,
    items: [
      { id: "tips-1", title: "お話の最初はパターン化しておく", points: ["A. お仕事お休み or 途中ですか", "B. 今日は〇〇（天気・行事）ですね", "C. すごくお若いですね（本当に若く見える人に）", "D. よくお店を利用されるのですか", "E. 今回はXを見てくれたんですか"] },
      { id: "tips-2", title: "店のプロフィールは嘘だと正直に言う", note: "そして自分の都合の良い嘘プロフィールを言う（医療事務や受付など知ってる業界だとなおよし）" },
      { id: "tips-3", title: "人の悪口・相談事は言わない", note: "相手は癒されに来ている。しかも金を払って" },
      { id: "tips-4", title: "ムカつく・イヤイヤ期の人", note: "とにかくその人の言い分を最後まで聴く。傾聴・共感で大体の人は満足。流されない鉄の心は捨てない。ヤバイ人は通報" },
      { id: "tips-5", title: "目が無くなるまで笑う", note: "おキレる人ほど実は苦笑い。ちょっとオーバーに、でも声は控えめに。割り箸を噛んで会話できないレベルの口角で" },
    ],
  },
  {
    id: "massage",
    title: "マッサージ・お礼の要点",
    icon: HandHeart,
    subSections: [
      {
        subTitle: "マッサージに入る前のポイント",
        items: [
          { id: "mas-pre-1", title: "自己紹介・カウンセリング・ヒアリング", note: "鏡に向いてもらってあぐらにさせ、後ろからハグをしながら手を握り、挨拶やお疲れ・好きなところ・カウンセリングやヒアリングを取る" },
          { id: "mas-pre-2", title: "膝立ちの状態から壁に手をつかせ後ろからまさぐる", note: "コンディション確認しながらコミュニケーション&マッサージ" },
          { id: "mas-pre-3", title: "うつ伏せにさせる", note: "覆い被さって耳元で『よろしくお願いします／それでは始めていきますね』とささやく" },
          { id: "mas-pre-4", title: "タオルをかけて軽く指圧やストレッチ", note: "タオルワーク。冬場は露出部分に施術までタオルを。ストレッチは密着度が高くメリット多い" },
        ],
      },
      {
        subTitle: "オイル — うつ伏せ時のポイント",
        items: [
          { id: "mas-pr-1", title: "左脚オイル・右脚オイル", note: "足元から太ももの付け根までリンパドレナージュ。ターン時は鼠蹊部をゆっくり。圧は体重を乗せて" },
          { id: "mas-pr-2", title: "背中・肩", note: "エロ無しでも疲れている部分なのでしっかりマッサージ" },
          { id: "mas-pr-3", title: "カエル脚", note: "ゆっくりロングストローク。単調にせず片手は鼠蹊部・片手は胸あたり、脚も使い驚きと感動を" },
          { id: "mas-pr-4", title: "四つん這い", note: "尾骶骨あたりからオイルを大量に。膝下にタオルを敷く。辛い場合は太ももの上に腰を落としてもらう" },
          { id: "mas-pr-5", title: "抱きつき施術", note: "上体を起こし正座の上に座らせ、後ろから腕ごとハグするような状態でまさぐり施術" },
        ],
      },
      {
        subTitle: "オイル — 仰向け時のポイント",
        items: [
          { id: "mas-sup-1", title: "デコルテ", note: "頭上で正座の体制で施術。股の間に顔を挟むと良い" },
          { id: "mas-sup-2", title: "おっぱいスタンプ", note: "客の顔にタオルをかけてから胸を顔面に。タオル不要の方もいるので確認" },
          { id: "mas-sup-3", title: "スパイダー", note: "シックスナインの体制。お触り防止に客の腕を足先と膝の間に入れるとガードできる" },
          { id: "mas-sup-4", title: "背面騎乗位・正面騎乗位", note: "腰を動かしながら脚や鼠蹊部、反転してデコルテや鼠蹊部" },
          { id: "mas-sup-5", title: "M字開脚", note: "客をM字開脚させ鼠蹊部を集中施術。自分もM字開脚して見て楽しませる" },
          { id: "mas-sup-6", title: "マーメイド", note: "添い寝のような体制で足を絡ませスリスリ。手の施術も同時に。足技が重要" },
        ],
      },
      {
        subTitle: "上級編",
        items: [
          { id: "mas-adv-1", title: "手のマッサージ", note: "オキシトシンが分泌。手に触れる回数が多いほど印象深くリピートに繋がる" },
          { id: "mas-adv-2", title: "ハグ", note: "正面/後ろ/寝ながら/最初と最後。鼓動を確認するくらいの意識で。手も握るとさらに良い" },
          { id: "mas-adv-3", title: "鏡に映る自分", note: "客は常に鏡越しの自分を見ている。身体のライン・表情・動作を意識" },
          { id: "mas-adv-4", title: "オイルをたくさん使う", note: "1接客ボトル1本。大事な時に強弱を。カエル・カニ・四つん這い・マーメイド・M字開脚の時など" },
          { id: "mas-adv-5", title: "マッサージのオンオフ", note: "最悪なのは中途半端で力加減も微妙なペタペタ。流す/エロくさせるをはっきり" },
          { id: "mas-adv-6", title: "衣装チェンジ", note: "初めから着替えるより、少しずつ・着替える姿を見せると良い" },
          { id: "mas-adv-7", title: "名前をたくさん言う", note: "『〇〇さん、すごい凝ってますね』とか" },
          { id: "mas-adv-8", title: "耳元でのささやき", note: "非日常な体験を" },
          { id: "mas-adv-9", title: "お礼のメッセージ", note: "効果絶大。理想は手書き。直接渡すのは野暮なので、手書きを写真でツイートがベスト" },
        ],
      },
    ],
  },
];

const STORAGE_KEY = "service_manual_checks";

function collectIds(): string[] {
  const ids: string[] = [];
  for (const s of SECTIONS) {
    s.items?.forEach((i) => ids.push(i.id));
    s.subSections?.forEach((ss) => ss.items.forEach((i) => ids.push(i.id)));
  }
  return ids;
}

export default function CustomerServiceManual() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecks(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

  const toggle = (id: string) => {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetChecks = () => {
    setChecks({});
    localStorage.removeItem(STORAGE_KEY);
  };

  const allIds = collectIds();
  const doneCount = allIds.filter((id) => checks[id]).length;
  const progress = allIds.length ? Math.round((doneCount / allIds.length) * 100) : 0;

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div>読み込み中...</div></div>;
  }

  const renderItem = (item: ManualItem, numbered: boolean, index?: number) => (
    <div key={item.id} className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
      <Checkbox
        id={item.id}
        checked={!!checks[item.id]}
        onCheckedChange={() => toggle(item.id)}
        className="mt-0.5"
      />
      <label htmlFor={item.id} className="flex-1 cursor-pointer">
        <div className="flex items-center gap-2">
          {numbered && index !== undefined && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
              {index + 1}
            </span>
          )}
          <span className={`font-medium text-sm ${checks[item.id] ? "line-through text-muted-foreground" : ""}`}>
            {item.title}
          </span>
        </div>
        {item.points && (
          <ul className="mt-1 ml-1 space-y-0.5">
            {item.points.map((p, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                <span className="text-primary/60">・</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        {item.note && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.note}</p>}
      </label>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 mt-0.5">
              <ClipboardCheck size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">接客マニュアル兼チェックリスト</h1>
              <p className="text-sm text-muted-foreground mt-1">入店ガイドブック（施術編）。各項目はチェックして進捗管理できます。</p>
            </div>
          </div>

          {/* Progress */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <ListChecks size={16} className="text-primary" />
                  チェック進捗
                </span>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{doneCount} / {allIds.length}</Badge>
                  <Button variant="ghost" size="sm" onClick={resetChecks} className="h-7 text-xs">
                    <RotateCcw size={13} className="mr-1" />
                    リセット
                  </Button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Icon size={18} className="text-primary" />
                    {section.title}
                  </CardTitle>
                  {section.intro && <p className="text-sm text-muted-foreground">{section.intro}</p>}
                </CardHeader>
                <CardContent>
                  {section.items && (
                    <div>
                      {section.items.map((item, i) => renderItem(item, !!section.numbered, i))}
                    </div>
                  )}
                  {section.subSections && (
                    <div className="space-y-5">
                      {section.subSections.map((ss) => (
                        <div key={ss.subTitle}>
                          <h3 className="text-sm font-bold text-foreground/80 mb-1 pb-1 border-b-2 border-primary/20">
                            {ss.subTitle}
                          </h3>
                          <div>
                            {ss.items.map((item) => renderItem(item, false))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <footer className="mt-8 py-4 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs text-muted-foreground">© 2025 caskan.jp All rights reserved</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
