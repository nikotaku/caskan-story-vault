import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Ticket } from "lucide-react";
import { useStore } from "@/hooks/useStore";

const STARS = [1, 2, 3, 4, 5];

export default function Survey() {
  const { store, storeId } = useStore();
  const storeName = store?.name ?? "艶華";
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [therapistName, setTherapistName] = useState("");
  const [goodPoints, setGoodPoints] = useState("");
  const [improvement, setImprovement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError("評価を選択してください"); return; }
    setSubmitting(true);
    setError("");
    try {
      const { error: err } = await supabase.from("customer_surveys").insert([{
        rating,
        therapist_name: therapistName || null,
        good_points: goodPoints || null,
        improvement_points: improvement || null,
        store_id: storeId,
      } as any]);
      if (err) throw err;
      // 発行番号（スタッフ確認用の識別子）と発行日時
      const now = new Date();
      setCouponCode(`SV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(now.getTime() % 10000)).padStart(4, "0")}`);
      setIssuedAt(now.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
      setDone(true);
    } catch {
      setError("送信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex flex-col items-center justify-center p-4 gap-5">
        {/* スクショ案内 */}
        <div className="max-w-sm w-full flex items-center justify-center gap-2 text-rose-700 font-bold text-sm">
          <Camera size={18} />
          この画面をスクリーンショットしてください
        </div>

        {/* クーポン券 */}
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-rose-300">
          {/* 券ヘッダー */}
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-center py-4 px-5">
            <div className="flex items-center justify-center gap-1.5 text-xs tracking-widest opacity-90">
              <Ticket size={14} /> COUPON ｜ {storeName}
            </div>
            <p className="mt-1 text-sm font-semibold">アンケートご回答特典</p>
          </div>

          {/* 金額 */}
          <div className="text-center py-6 px-5">
            <p className="text-sm text-muted-foreground">次回ご予約が</p>
            <p className="mt-1">
              <span className="text-5xl font-black text-rose-600">1,000</span>
              <span className="text-xl font-bold text-rose-600 ml-1">円割引</span>
            </p>
          </div>

          {/* 切り取り線 */}
          <div className="relative border-t-2 border-dashed border-rose-200">
            <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-rose-50" />
            <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-rose-50" />
          </div>

          {/* 発行情報 */}
          <div className="px-5 py-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground">発行番号</p>
            <p className="font-mono font-bold tracking-wider">{couponCode}</p>
            <p className="text-[11px] text-muted-foreground mt-1">発行日時：{issuedAt}</p>
          </div>

          {/* 使い方 */}
          <div className="bg-rose-50 px-5 py-4 text-center text-sm">
            <p className="font-bold text-rose-700">次回ご予約時にこの画面をご提示ください</p>
            <p className="text-xs text-muted-foreground mt-1">スタッフがご予約時に確認いたします</p>
          </div>
        </div>

        {/* 口コミ追加割引の導線 */}
        <div className="max-w-sm w-full space-y-2">
          <a
            href="/review"
            className="block w-full bg-rose-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-rose-700 transition-colors"
          >
            口コミも投稿する（さらに2,000円割引）
          </a>
          <p className="text-center text-[11px] text-muted-foreground">
            アンケート＋口コミの両方で合計<strong>3,000円割引</strong>になります
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      <header className="bg-white border-b py-4 px-4 text-center">
        <p className="text-xs text-muted-foreground">{storeName}</p>
        <h1 className="text-lg font-bold mt-0.5">ご利用アンケート</h1>
      </header>

      <main className="max-w-md mx-auto p-4 pt-6">
        <p className="text-sm text-muted-foreground mb-6 text-center">
          より良いサービスのため、ぜひご感想をお聞かせください。
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 評価 */}
          <div>
            <Label className="text-base font-semibold">本日の施術はいかがでしたか？ <span className="text-rose-500">*</span></Label>
            <div className="flex gap-3 mt-3 justify-center">
              {STARS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                >
                  <span className={(hovered || rating) >= s ? "text-yellow-400" : "text-gray-300"}>★</span>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm mt-1 text-muted-foreground">
                {["", "とても残念だった", "残念だった", "普通", "良かった", "とても良かった"][rating]}
              </p>
            )}
          </div>

          {/* 担当者 */}
          <div>
            <Label>担当セラピスト名（任意）</Label>
            <Input
              className="mt-1"
              placeholder="例：はる"
              value={therapistName}
              onChange={(e) => setTherapistName(e.target.value)}
            />
          </div>

          {/* 良かった点 */}
          <div>
            <Label>良かった点・ご感想（任意）</Label>
            <Textarea
              className="mt-1"
              placeholder="技術や接客で良かったところなど、何でもお聞かせください"
              rows={3}
              value={goodPoints}
              onChange={(e) => setGoodPoints(e.target.value)}
            />
          </div>

          {/* 改善点 */}
          <div>
            <Label>改善してほしい点（任意）</Label>
            <Textarea
              className="mt-1"
              placeholder="気になった点があればお聞かせください"
              rows={3}
              value={improvement}
              onChange={(e) => setImprovement(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="bg-rose-50 rounded-xl p-4 text-sm space-y-1">
            <p className="font-bold text-rose-700">【ご回答特典】</p>
            <p>回答後にクーポン券が表示されます。<strong>スクリーンショット</strong>して次回ご予約時にご提示ください。</p>
            <p className="font-bold">▶ 次回 <span className="text-rose-600">1,000円割引</span></p>
          </div>

          <Button type="submit" className="w-full h-12 text-base" disabled={submitting || rating === 0}>
            {submitting ? "送信中..." : "アンケートを送信する"}
          </Button>
        </form>
      </main>
    </div>
  );
}
