import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReferralReward {
  id: string;
  name: string;
  amount: number;
  note: string | null;
  is_active: boolean;
}

export default function SystemReferralRewards() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", amount: 0, note: "" });

  const { user, loading: authLoading } = useAuth();
  const { storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("referral_rewards")
      .select("*")
      .eq("store_id", storeId)
      .order("name");
    if (error) {
      toast({ variant: "destructive", title: "エラー", description: "広告費の取得に失敗しました" });
    } else {
      setRewards(data || []);
    }
    setLoading(false);
  }, [storeId, toast]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !storeLoading) fetchRewards();
  }, [user, storeLoading, fetchRewards]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("referral_rewards").insert([{
        name: formData.name,
        amount: formData.amount,
        note: formData.note || null,
        store_id: storeId,
      }]);
      if (error) throw error;
      setFormData({ name: "", amount: 0, note: "" });
      setShowForm(false);
      fetchRewards();
    } catch (error) {
      toast({ variant: "destructive", title: "エラー", description: error instanceof Error ? error.message : "追加に失敗しました" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    try {
      const { error } = await supabase
        .from("referral_rewards")
        .delete()
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw error;
      fetchRewards();
    } catch (error) {
      toast({ variant: "destructive", title: "エラー", description: error instanceof Error ? error.message : "削除に失敗しました" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">広告費</h1>
              <p className="text-muted-foreground">セラピストの紹介報酬ルール（予約1本あたりの金額）を管理。適用はキャスト管理画面から選択します。</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus size={16} className="mr-2" />追加
            </Button>
          </div>

          {showForm && (
            <Card className="mb-6">
              <CardHeader><CardTitle>紹介報酬ルールを追加</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>ルール名</Label>
                      <Input placeholder="例: ○○媒体 紹介報酬" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div>
                      <Label>予約1本あたりの金額（円）</Label>
                      <Input type="number" min="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <Label>備考</Label>
                    <Textarea placeholder="例: 入店後3ヶ月のみ適用" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} rows={2} className="mt-1" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">保存</Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center text-muted-foreground">読み込み中...</div>
          ) : rewards.length === 0 ? (
            <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">紹介報酬ルールがありません</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {rewards.map((reward) => (
                <Card key={reward.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold">{reward.name}</div>
                        <p className="text-sm text-muted-foreground">予約1本あたり ¥{(reward.amount || 0).toLocaleString()}</p>
                        {reward.note && (
                          <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1 inline-block">{reward.note}</p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(reward.id)}>
                        <Trash2 size={14} />
                      </Button>
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
