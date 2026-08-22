import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle } from "lucide-react";
import { useStore } from "@/hooks/useStore";

const STARS = [1, 2, 3, 4, 5];

export default function CustomerReview() {
  const { store, storeId } = useStore();
  const storeName = store?.name ?? "艶華";
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [therapistName, setTherapistName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [allowPublish, setAllowPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError("評価を選択してください"); return; }
    if (!reviewText.trim()) { setError("口コミ内容を入力してください"); return; }
    setSubmitting(true);
    setError("");
    try {
      const { error: err } = await supabase.from("customer_reviews").insert([{
        rating,
        therapist_name: therapistName || null,
        review_text: reviewText,
        allow_publish: allowPublish,
        store_id: storeId, // 表示中の店舗に紐付け（anonはトリガーで店舗解決できないため明示）
      } as any]);
      if (err) throw err;
      setDone(true);
    } catch {
      setError("送信に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-6 bg-white rounded-2xl shadow-md p-8">
          <CheckCircle className="mx-auto text-green-500" size={56} />
          <h1 className="text-xl font-bold">口コミありがとうございました</h1>
          <div className="bg-amber-50 rounded-xl p-5 text-sm text-left space-y-2">
            <p className="font-bold text-amber-700">【キャッシュバック特典】</p>
            <p>この画面をその場でスタッフにご提示ください。</p>
            <p className="font-bold mt-2">▶ その場で <span className="text-amber-600 text-lg">1,000円キャッシュバック</span></p>
            <p className="text-xs text-muted-foreground mt-1">アンケート＋口コミの両方でさらに<strong>3,000円割引</strong>になります</p>
          </div>
          <a
            href="/survey"
            className="block w-full bg-rose-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-rose-700 transition-colors"
          >
            アンケートも答える（さらに2,000円追加割引）
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white border-b py-4 px-4 text-center">
        <p className="text-xs text-muted-foreground">{storeName}</p>
        <h1 className="text-lg font-bold mt-0.5">口コミ投稿</h1>
      </header>

      <main className="max-w-md mx-auto p-4 pt-6">
        <p className="text-sm text-muted-foreground mb-6 text-center">
          ご来店の感想をぜひ投稿してください。<br />いただいた口コミは店舗改善に活用させていただきます。
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 評価 */}
          <div>
            <Label className="text-base font-semibold">総合評価 <span className="text-rose-500">*</span></Label>
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

          {/* 口コミ本文 */}
          <div>
            <Label>口コミ内容 <span className="text-rose-500">*</span></Label>
            <Textarea
              className="mt-1"
              placeholder="施術の感想、雰囲気、スタッフの対応など、自由にご記入ください"
              rows={5}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              required
            />
          </div>

          {/* 公開許可 */}
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={allowPublish}
              onCheckedChange={(v) => setAllowPublish(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              いただいた口コミをホームページや宣伝に使用することを許可する
            </span>
          </label>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="bg-amber-50 rounded-xl p-4 text-sm space-y-1">
            <p className="font-bold text-amber-700">【ご投稿特典】</p>
            <p>投稿完了後に表示される画面をスタッフにご提示で</p>
            <p className="font-bold">▶ その場で <span className="text-amber-600">1,000円キャッシュバック</span></p>
          </div>

          <Button type="submit" className="w-full h-12 text-base" disabled={submitting || rating === 0 || !reviewText.trim()}>
            {submitting ? "送信中..." : "口コミを投稿する"}
          </Button>
        </form>
      </main>
    </div>
  );
}
