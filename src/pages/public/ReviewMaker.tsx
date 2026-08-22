import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Sparkles, RefreshCw, Check, ExternalLink } from "lucide-react";

/**
 * メンエス系口コミサイト（men-esthe.jp 等）へ投稿するための
 * 6項目フォーム → 約400字の口コミを自動生成するページ。
 * 生成はクライアント側のテンプレート組み立てで完結（AI不使用・即時・無料）。
 */

interface Form {
  therapistName: string;
  // 1. スタイル
  bodyType: string;
  bust: string;
  skin: string;
  // 2. 容姿
  atmosphere: string;
  gap: string;
  // 3. 料金・オプション
  course: string;
  total: string;
  options: string;
  // 4. 施術の流れ
  hand: string;
  mood: string;
  closeness: string;
  serviceNote: string;
  // 5. 暴発の詳細
  bakuhatsu: string;
  bakuhatsuFee: string;
  bakuhatsuNote: string;
  // 6. 再訪
  revisit: string;
  revisitNote: string;
}

const EMPTY: Form = {
  therapistName: "",
  bodyType: "", bust: "", skin: "",
  atmosphere: "", gap: "",
  course: "", total: "", options: "",
  hand: "", mood: "", closeness: "", serviceNote: "",
  bakuhatsu: "", bakuhatsuFee: "", bakuhatsuNote: "",
  revisit: "", revisitNote: "",
};

const BODY_TYPES = ["スレンダー", "モデル体型", "普通体型", "グラマー", "むっちり", "細身で華奢"];
const BUSTS = ["控えめで可愛い", "普通サイズ", "大きめ", "かなり大きい（巨乳）", "形が綺麗"];
const SKINS = ["すべすべ", "モチモチ", "きめ細かい", "なめらかで触り心地抜群", "白くて綺麗"];
const ATMOSPHERES = ["可愛い系", "綺麗系", "清楚系", "美人系", "ギャル系", "癒し系", "色っぽい系"];
const GAPS = ["写真以上に可愛かった", "写真通りで安心", "写真より断然魅力的", "想像以上のレベル", "実物の方が断然良い"];
const HANDS = ["とても丁寧", "施術が上手", "力加減が絶妙", "気持ちよくて寝そう", "ツボを的確に押さえる"];
const MOODS = ["終始リラックスできた", "会話も楽しかった", "距離が近くて癒された", "ずっと笑顔で対応", "緊張がほぐれた"];
const CLOSENESS = ["かなり密着", "程よい密着", "しっかり密着", "全身を使った密着"];
const BAKUHATSU = ["なし（健全）", "SKRあり", "HRあり", "SKR・HR両方あり"];
const BAKUHATSU_FEE = ["無料サービス", "有料", "金額交渉あり", "—"];
const REVISIT = ["絶対にまた行きたい", "また指名したい", "機会があれば再訪したい", "リピート確定", "周りにもおすすめしたい"];

export default function ReviewMaker() {
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const generate = () => {
    const f = form;
    const name = f.therapistName.trim() || "担当";
    const s: string[] = [];

    // 導入 + 容姿（2）
    const intro: string[] = [`${name}さんを指名させていただきました。`];
    if (f.atmosphere) intro.push(`第一印象は${f.atmosphere}な雰囲気で、`);
    if (f.gap) intro.push(`HP写真と比べても${f.gap}でした。`);
    else if (f.atmosphere) intro.push(`とても素敵な方でした。`);
    s.push(intro.join(""));

    // スタイル（1）
    const style: string[] = [];
    if (f.bodyType) style.push(`スタイルは${f.bodyType}`);
    if (f.bust) style.push(`、胸は${f.bust}`);
    if (f.skin) style.push(`、肌質も${f.skin}で触り心地が最高`);
    if (style.length) s.push(style.join("") + "でした。");

    // 料金・オプション（3）
    const price: string[] = [];
    if (f.course) price.push(`${f.course}を利用`);
    if (f.total) price.push(`、トータルで${Number(f.total).toLocaleString()}円ほど`);
    if (f.options) price.push(`。オプションは${f.options}を付けました`);
    if (price.length) s.push(price.join("") + "。料金以上の満足度でした。");

    // 施術の流れ（4）
    const svc: string[] = [];
    if (f.hand) svc.push(`施術は${f.hand}`);
    if (f.closeness) svc.push(`、${f.closeness}してくれて`);
    if (f.mood) svc.push(`${f.mood}です`);
    if (svc.length) s.push(svc.join("") + "。雰囲気も良く、終始気持ちよく過ごせました。");
    if (f.serviceNote.trim()) s.push(f.serviceNote.trim());

    // 暴発の詳細（5）
    if (f.bakuhatsu && f.bakuhatsu !== "なし（健全）") {
      const bk: string[] = [`サービス面では${f.bakuhatsu}`];
      if (f.bakuhatsuFee && f.bakuhatsuFee !== "—") bk.push(`（${f.bakuhatsuFee}）`);
      bk.push("でした。");
      s.push(bk.join(""));
      if (f.bakuhatsuNote.trim()) s.push(f.bakuhatsuNote.trim());
    } else if (f.bakuhatsu === "なし（健全）") {
      s.push("健全店なので安心して施術を受けられました。");
    }

    // 再訪（6）
    const re: string[] = [];
    if (f.revisit) re.push(`${f.revisit}と思えるお店・セラピストさんです。`);
    if (f.revisitNote.trim()) re.push(f.revisitNote.trim());
    if (!re.length) re.push("総合的に大満足で、また伺いたいと思いました。");
    s.push(re.join(""));

    s.push(`${name}さん、ありがとうございました！`);

    let text = s.join("");

    // 400字程度に調整（短い場合は締めの一文を足す）
    if (text.length < 360) {
      text += " 受付から施術まで全体的に丁寧で、リピートしたくなる素晴らしい時間でした。気になっている方にはぜひおすすめしたいお店です。";
    }
    setResult(text);
    setCopied(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const SelField = ({ label, k, opts, required }: { label: string; k: keyof Form; opts: string[]; required?: boolean }) => (
    <div>
      <Label className="text-sm">{label}{required && <span className="text-rose-500"> *</span>}</Label>
      <Select value={form[k]} onValueChange={(v) => set(k, v)}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="選択してください" /></SelectTrigger>
        <SelectContent>
          {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white border-b py-4 px-4 text-center">
        <p className="text-xs text-muted-foreground">艶華</p>
        <h1 className="text-lg font-bold mt-0.5">口コミ自動作成ツール</h1>
      </header>

      <main className="max-w-md mx-auto p-4 pt-6">
        <p className="text-sm text-muted-foreground mb-6 text-center">
          下の項目を選ぶだけで、約400字の口コミが自動で完成します。<br />
          完成したらコピーして、メンエス口コミサイトに貼り付けてください。
        </p>

        <div className="space-y-6">
          {/* セラピスト名 */}
          <div>
            <Label className="text-sm">担当セラピスト名 <span className="text-rose-500">*</span></Label>
            <Input className="mt-1" placeholder="例：はる" value={form.therapistName} onChange={(e) => set("therapistName", e.target.value)} />
          </div>

          {/* 1. スタイル */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-bold text-amber-700">① スタイル</p>
            <SelField label="体型" k="bodyType" opts={BODY_TYPES} />
            <SelField label="胸" k="bust" opts={BUSTS} />
            <SelField label="肌質" k="skin" opts={SKINS} />
          </section>

          {/* 2. 容姿 */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-bold text-amber-700">② 容姿</p>
            <SelField label="雰囲気・顔の印象" k="atmosphere" opts={ATMOSPHERES} />
            <SelField label="HP写真とのギャップ" k="gap" opts={GAPS} />
          </section>

          {/* 3. 料金・オプション */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-bold text-amber-700">③ 料金・オプション</p>
            <div>
              <Label className="text-sm">利用コース</Label>
              <Input className="mt-1" placeholder="例：90分コース" value={form.course} onChange={(e) => set("course", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">支払った総額（円）</Label>
              <Input className="mt-1" type="number" inputMode="numeric" placeholder="例：22000" value={form.total} onChange={(e) => set("total", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">オプション</Label>
              <Input className="mt-1" placeholder="例：パウダー、鼠径部リンパ" value={form.options} onChange={(e) => set("options", e.target.value)} />
            </div>
          </section>

          {/* 4. 施術の流れ */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-bold text-amber-700">④ 施術の流れ</p>
            <SelField label="手つき" k="hand" opts={HANDS} />
            <SelField label="密着度" k="closeness" opts={CLOSENESS} />
            <SelField label="雰囲気" k="mood" opts={MOODS} />
            <div>
              <Label className="text-sm">自由メモ（任意）</Label>
              <Textarea className="mt-1" rows={2} placeholder="その他、施術中に感じたこと" value={form.serviceNote} onChange={(e) => set("serviceNote", e.target.value)} />
            </div>
          </section>

          {/* 5. 暴発の詳細 */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-bold text-amber-700">⑤ サービス内容（暴発の有無）</p>
            <SelField label="SKR / HR" k="bakuhatsu" opts={BAKUHATSU} />
            <SelField label="料金（無料・有料）" k="bakuhatsuFee" opts={BAKUHATSU_FEE} />
            <div>
              <Label className="text-sm">詳細・交渉メモ（任意）</Label>
              <Textarea className="mt-1" rows={2} placeholder="具体的な流れや金額交渉の詳細など" value={form.bakuhatsuNote} onChange={(e) => set("bakuhatsuNote", e.target.value)} />
            </div>
          </section>

          {/* 6. 再訪 */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-bold text-amber-700">⑥ 再訪意欲</p>
            <SelField label="また行きたいか" k="revisit" opts={REVISIT} />
            <div>
              <Label className="text-sm">一言（任意）</Label>
              <Input className="mt-1" placeholder="例：next も絶対指名します！" value={form.revisitNote} onChange={(e) => set("revisitNote", e.target.value)} />
            </div>
          </section>

          <Button onClick={generate} disabled={!form.therapistName.trim()} className="w-full h-12 text-base">
            <Sparkles size={18} className="mr-2" />口コミを自動生成する
          </Button>

          {/* 生成結果 */}
          {result && (
            <div className="bg-white rounded-xl border-2 border-amber-300 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-amber-700">完成した口コミ</p>
                <span className="text-xs text-muted-foreground">{result.length}文字</span>
              </div>
              <Textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={11}
                className="text-sm leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">※ そのまま貼り付けてもOK。自然になるよう自由に編集できます。</p>
              <div className="flex gap-2">
                <Button onClick={copy} className="flex-1" variant={copied ? "secondary" : "default"}>
                  {copied ? <><Check size={16} className="mr-1.5" />コピーしました</> : <><Copy size={16} className="mr-1.5" />コピーする</>}
                </Button>
                <Button onClick={generate} variant="outline" title="作り直す">
                  <RefreshCw size={16} />
                </Button>
              </div>
              <a
                href="https://men-esthe.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full bg-rose-600 text-white py-3 rounded-xl font-semibold hover:bg-rose-700 transition-colors text-sm"
              >
                <ExternalLink size={16} />口コミサイトを開いて投稿する
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
