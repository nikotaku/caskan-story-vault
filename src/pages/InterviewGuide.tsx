import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, MapPin, Clock, Train, ShieldCheck, Loader2,
  Home, IdCard, Camera, AlertTriangle, Sparkles, Check, ChevronDown,
  KeyRound, Footprints, Archive, Tablet, type LucideIcon,
} from "lucide-react";

/**
 * 面談用（画面共有）ページ。ビデオ通話で候補者に画面共有しながら、
 * 店舗詳細・ルーム環境・注意点を説明する社内用資料。
 * 施術マニュアルと店舗詳細をもとに構成。縦スクロール・大きめ文字で見やすく。
 */

export default function InterviewGuide() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    document.title = "艶華｜面談資料";
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, navigate, user]);

  if (authLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-gray-50 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="認証を確認中" />
      </div>
    );
  }

  const Section = ({ id, icon: Icon, title, sub, children, tone = "rose" }: {
    id?: string; icon: LucideIcon; title: string; sub?: string; children: React.ReactNode; tone?: "rose" | "amber" | "gray";
  }) => {
    const toneMap: Record<string, string> = {
      rose: "from-rose-500 to-pink-500",
      amber: "from-amber-500 to-orange-500",
      gray: "from-gray-600 to-gray-700",
    };
    return (
      <section id={id} className="px-5 py-10 border-b border-gray-100">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${toneMap[tone]} flex items-center justify-center shrink-0 shadow-sm`}>
              <Icon size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">{title}</h2>
              {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
          </div>
          {children}
        </div>
      </section>
    );
  };

  // key-value 行
  const KV = ({ k, v, hl }: { k: string; v: React.ReactNode; hl?: boolean }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{k}</span>
      <span className={`text-sm text-right ${hl ? "font-bold text-rose-600" : "font-medium text-gray-800"}`}>{v}</span>
    </div>
  );

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 ${className}`}>{children}</div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <button
        onClick={() => navigate("/staff")}
        className="fixed top-3 left-3 z-50 flex items-center gap-1 text-xs bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow text-gray-500 hover:text-gray-800 print:hidden"
      >
        <ArrowLeft size={13} /> 管理画面へ
      </button>

      {/* HERO */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-gray-900 via-rose-900 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <Sparkles className="absolute top-16 left-10" size={40} />
          <Sparkles className="absolute bottom-24 right-12" size={32} />
        </div>
        <div className="relative">
          <p className="text-xs tracking-[0.4em] text-rose-300 mb-4">ENKA SENDAI</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">艶華</h1>
          <p className="text-sm text-gray-300 mb-8">メンズエステ｜面談資料</p>
          <p className="text-base md:text-lg leading-relaxed text-gray-100 max-w-md mx-auto">
            仙台メンズエステの「頂点」を本気で狙う<br />ハイレベルサロン。
          </p>
          <div className="mt-10 inline-flex flex-col items-center gap-1 animate-bounce text-rose-200">
            <span className="text-xs">スクロールしてご説明します</span>
            <ChevronDown size={22} />
          </div>
        </div>
      </section>

      {/* コンセプト */}
      <Section icon={Sparkles} title="店舗コンセプト" tone="rose">
        <Card className="py-5">
          <p className="text-sm leading-relaxed text-gray-700">
            愛嬌があり、素直さや頑張る姿勢。<br />
            選び抜かれたビジュアル、洗練された施術、妥協のない接客。<br /><br />
            “艶華”は、和を基調とした上品さとおもてなしを大切にするハイレベルサロンです。<br />
            施術だけでなく、また会いたいと思っていただける<span className="font-bold text-rose-600">「特別なひととき」</span>をお届けします。
          </p>
        </Card>
      </Section>

      {/* 店舗概要 */}
      <Section icon={MapPin} title="店舗概要" tone="gray">
        <Card>
          <KV k="店舗名" v="艶華" />
          <KV k="業種" v="メンズエステ" />
          <KV k="営業時間" v="12:00〜26:00（25:00最終受付）" />
          <KV k="所在地" v="宮城県仙台市" />
          <KV k="HP" v={<a href="https://enka-salon.jp/" target="_blank" rel="noreferrer" className="text-rose-500 underline">enka-salon.jp</a>} />
        </Card>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Card className="py-4 text-center px-2">
            <Train size={18} className="text-rose-500 mx-auto mb-1" />
            <p className="text-xs text-gray-400">サンルーム</p>
            <p className="text-sm font-bold mt-0.5">勾当台公園駅<br /><span className="text-xs font-medium text-gray-500">徒歩3分</span></p>
          </Card>
          <Card className="py-4 text-center px-2">
            <Train size={18} className="text-rose-500 mx-auto mb-1" />
            <p className="text-xs text-gray-400">ラズルーム</p>
            <p className="text-sm font-bold mt-0.5">北四番丁駅<br /><span className="text-xs font-medium text-gray-500">徒歩8分</span></p>
          </Card>
          <Card className="py-4 text-center px-2">
            <Train size={18} className="text-rose-500 mx-auto mb-1" />
            <p className="text-xs text-gray-400">インルーム</p>
            <p className="text-sm font-bold mt-0.5">北四番丁駅<br /><span className="text-xs font-medium text-gray-500">徒歩3分</span></p>
          </Card>
        </div>
      </Section>

      {/* 各ルームの住所と鍵（施術マニュアルより） */}
      <Section icon={MapPin} title="各ルームの住所・アクセス・鍵" sub="施術マニュアルより" tone="amber">
        <div className="space-y-4">
          {[
            {
              name: "サンルーム",
              zip: "〒980-0803",
              address: "仙台市 青葉区 国分町 3-6-13 アルモニー勾当台 203",
              access: [
                "地下鉄南北線／勾当台公園駅前 徒歩3分",
                "仙台駅西口タクシー乗り場から車で7分",
              ],
              keyNote: "建物正面入り口のキーボックスに鍵があります",
            },
            {
              name: "ラズルーム",
              zip: "〒980-0821",
              address: "宮城県仙台市青葉区春日町 11-12 ラジュール仙台（L'AZURE SENDAI）",
              access: [
                "地下鉄南北線／北四番丁駅 徒歩8分",
                "地下鉄東西線／大町西公園駅 徒歩13分",
                "地下鉄南北線／広瀬通駅 徒歩19分",
              ],
              keyNote: "建物脇のキーボックスに鍵があります",
            },
            {
              name: "インルーム",
              zip: "〒980-0802",
              address: "宮城県仙台市青葉区二日町 11-15 In-Towner二日町 201号",
              access: [
                "地下鉄南北線／北四番丁駅 徒歩3分",
                "JR線／仙台駅 徒歩25分",
              ],
              keyNote: "建物脇の配管に付いたキーボックスに鍵があります",
            },
          ].map((room) => (
            <Card key={room.name} className="py-4">
              <p className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                <Home size={16} className="text-amber-500" />{room.name}
              </p>
              <p className="text-xs text-gray-400">{room.zip}</p>
              <p className="text-sm font-medium text-gray-800 mb-2">{room.address}</p>
              <ul className="space-y-1 text-xs text-gray-500 mb-3">
                {room.access.map((a) => (
                  <li key={a} className="flex items-center gap-1.5">
                    <Train size={12} className="text-rose-400 shrink-0" />{a}
                  </li>
                ))}
              </ul>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-800">
                <p className="font-bold flex items-center gap-1.5 mb-1"><KeyRound size={13} />鍵の案内</p>
                <p>{room.keyNote}</p>
                <p className="mt-1">キーボックスは <span className="font-bold">【1209】</span> で解除 ／ 閉める時は <span className="font-bold">【0000】</span> に戻す</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* 勤務・待機 */}
      <Section icon={Clock} title="勤務・待機時間" tone="rose">
        <Card>
          <KV k="待機開始" v="12:00 または 13:00" />
          <KV k="勤務時間" v="12時間勤務" hl />
          <KV k="相談" v="勤務時間の相談可" />
        </Card>
      </Section>

      {/* 報酬条件は公開・画面共有資料へ載せず、契約前に個別説明する */}
      <Section icon={ShieldCheck} title="報酬・保証条件" tone="rose">
        <Card className="py-5">
          <p className="text-sm leading-relaxed text-gray-700">
            報酬の仕組み、支払い方法、控除、保証、交通費などの条件は、面談後に個別の資料でご説明します。
            内容をご確認いただき、契約前に双方で合意します。
          </p>
        </Card>
      </Section>

      {/* ルーム環境 */}
      <Section icon={Home} title="ルーム環境・設備" sub="各ルーム共通" tone="gray">
        <div className="flex flex-wrap gap-2">
          {[
            "WiFi", "冷蔵庫", "電子レンジ", "布団セット", "ケトル", "電気毛布",
            "置型ヒーター", "ドラム洗濯機", "ドライヤー", "ヘアアイロン",
            "ホットアイマスク", "貸出MB", "iPad", "お出迎え着",
          ].map((x) => (
            <span key={x} className="text-sm bg-white border border-gray-200 rounded-full px-3 py-1.5 flex items-center gap-1">
              <Check size={13} className="text-rose-500" />{x}
            </span>
          ))}
        </div>

        {/* 備え付け設備の使い方（全力BOOKより） */}
        <div className="space-y-3 mt-5">
          <Card className="py-4">
            <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Footprints size={16} className="text-rose-500" />サンダル（各ルーム合計3足）
            </p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-white border border-gray-300 shrink-0" />セラピスト用（白）</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-800 shrink-0" />お客様用❶（黒）</li>
              <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-white border border-gray-300 shrink-0" />お客様用❷（白）</li>
            </ul>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
              ❷の白サンダルは、施術後などオイルがついている時専用で使います。
            </p>
          </Card>

          <Card className="py-4">
            <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Archive size={16} className="text-rose-500" />レジスターBOX
            </p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {["釣り銭・預かり金 保管袋", "店落ち投函用封筒", "ボールペン・マッキー"].map((x, i) => (
                <li key={x} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  {x}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
              釣り銭はセラピストご用意です。千円札×10枚ほどお持ちください。
            </p>
          </Card>

          <Card className="py-4">
            <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Tablet size={16} className="text-rose-500" />店舗備え付け iPad
            </p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex items-center gap-2"><Check size={14} className="text-rose-500 shrink-0" />ボタンひとつで音楽再生</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-rose-500 shrink-0" />メニュー表の表示（お客様への提示用）</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-rose-500 shrink-0" />清掃チェックシートの送信</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-rose-500 shrink-0" />誓約書の記入（電子ペーパー）</li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* 持ち物・準備 */}
      <Section icon={IdCard} title="持ち物・準備" tone="rose">
        <Card>
          <KV k="身分証" v="顔写真付き身分証" hl />
          <KV k="釣り銭" v={<>セラピストご準備<br /><span className="text-xs text-gray-400">千円札×10枚ほど</span></>} />
          <KV k="衣装" v="持ち込み可" />
        </Card>
      </Section>

      {/* 写真提出 */}
      <Section icon={Camera} title="ご提出いただく写真" tone="amber">
        <Card className="py-4">
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              "バストアップ",
              "くびれがわかる写真",
              "肩から足首までの全身写真",
              "鏡での自撮り写真",
              "自信のある部位",
            ].map((x, i) => (
              <li key={x} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                {x}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">
            派遣確定から24時間以内に、HP・X作成用の使用可能な写真を必ずお送りください。
          </p>
        </Card>
      </Section>

      {/* 注意点 */}
      <Section icon={AlertTriangle} title="注意点（必ずご確認ください）" tone="gray">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
          <div className="flex gap-2">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 font-medium leading-relaxed">
              裏引き行為が発覚した場合、<span className="font-bold">保証カット・交通費支給なし・即退店</span>となります。
            </p>
          </div>
          <div className="border-t border-red-200 pt-3 text-sm text-red-800">
            <p className="font-bold mb-1">保証カットの対象</p>
            <p>クレーム / 遅刻・早退 / 清掃不十分</p>
          </div>
        </div>
      </Section>

      <footer className="py-10 text-center text-xs text-gray-400">
        艶華 ｜ 面談資料
      </footer>
    </div>
  );
}
