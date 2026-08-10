import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";

interface Review {
  id: string;
  rating: number;
  therapist_name: string | null;
  review_text: string;
  allow_publish: boolean;
  is_published: boolean;
  created_at: string;
  reviewer_name: string | null;
  review_title: string | null;
  reviewed_at: string | null;
  source_provider: string | null;
}

export default function ReviewsAdmin() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published">("all");
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("customer_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReviews((data as Review[]) || []);
        setLoading(false);
      });
  }, [user]);

  const togglePublish = async (id: string, current: boolean) => {
    const next = !current;
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_published: next } : r));
    const { error } = await supabase
      .from("customer_reviews")
      .update({ is_published: next })
      .eq("id", id);
    if (error) {
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_published: current } : r));
      toast.error("更新に失敗しました");
    } else {
      toast.success(next ? "HPに公開しました" : "非公開にしました");
    }
  };

  const displayed = filter === "published" ? reviews.filter((r) => r.is_published) : reviews;
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1)
    : "-";
  const publishedCount = reviews.filter((r) => r.is_published).length;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">口コミ一覧</h1>
          <p className="text-muted-foreground text-sm mb-6">
            スイッチをONにするとHPの口コミページに表示されます
          </p>

          {/* サマリー */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">件数</p>
                <p className="text-3xl font-bold mt-1">{reviews.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">平均評価</p>
                <p className="text-3xl font-bold mt-1">★ {avg}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">HP公開中</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{publishedCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* フィルター */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setFilter("published")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === "published" ? "bg-green-600 text-white" : "bg-muted hover:bg-muted/80"
              }`}
            >
              公開中のみ ({publishedCount})
            </button>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground">読み込み中...</p>
          ) : displayed.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                {filter === "published" ? "HP公開中の口コミがありません" : "まだ口コミがありません"}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {displayed.map((r) => (
                <Card key={r.id} className={r.is_published ? "border-green-200" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-bold">
                            <span className="text-yellow-400">{"★".repeat(Math.round(Number(r.rating)))}</span>
                            <span className="text-gray-300">{"★".repeat(5 - Math.round(Number(r.rating)))}</span>
                            <span className="ml-1 text-xs text-muted-foreground">{Number(r.rating).toFixed(1)}</span>
                          </span>
                          {r.therapist_name && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              {r.therapist_name}
                            </span>
                          )}
                          {r.allow_publish && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                              掲載許可あり
                            </Badge>
                          )}
                          {r.source_provider === "estama" && (
                            <Badge variant="outline" className="text-xs text-pink-600 border-pink-200">
                              エスたま同期
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(r.created_at), "M/d(E) HH:mm", { locale: ja })}
                          </span>
                        </div>
                        {(r.reviewer_name || r.reviewed_at) && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {r.reviewer_name || "お客様"}{r.reviewed_at ? ` ・ ${r.reviewed_at.replace(/-/g, "/")}` : ""}
                          </p>
                        )}
                        {r.review_title && <p className="text-sm font-bold mb-1">{r.review_title}</p>}
                        <p className="text-sm whitespace-pre-wrap">{r.review_text}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <Switch
                          checked={r.is_published}
                          onCheckedChange={() => togglePublish(r.id, r.is_published)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {r.is_published ? "公開中" : "非公開"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
