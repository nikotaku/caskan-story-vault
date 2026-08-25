import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MonthTarget {
  month_date: string;
  target_revenue: number;
}

export default function SalesMonthlySalesTarget() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [targets, setTargets] = useState<MonthTarget[]>([]);
  const [reports, setReports] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMonth, setNewMonth] = useState(format(new Date(), "yyyy-MM"));
  const [newTarget, setNewTarget] = useState<number>(0);

  const { user, loading: authLoading } = useAuth();
  const { storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !storeLoading) fetchAll();
  }, [user, storeId, storeLoading]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [targetsRes, reportsRes] = await Promise.all([
        supabase
          .from("monthly_sales_targets")
          .select("month_date,target_revenue")
          .eq("store_id", storeId)
          .order("month_date", { ascending: false }),
        supabase
          .from("monthly_reports")
          .select("month_date,revenue")
          .eq("store_id", storeId)
          .order("month_date", { ascending: false })
          .limit(24),
      ]);
      if (targetsRes.error) throw targetsRes.error;
      if (reportsRes.error) throw reportsRes.error;
      setTargets((targetsRes.data || []) as MonthTarget[]);
      const rmap: Record<string, number> = {};
      (reportsRes.data || []).forEach((r: any) => { rmap[r.month_date] = r.revenue || 0; });
      setReports(rmap);
    } catch (error) {
      console.error("Error fetching targets:", error);
      toast.error("売上目標の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const getTargetAmount = (t: MonthTarget) => t.target_revenue ?? 0;

  const handleSave = async (monthDate: string) => {
    if (!Number.isFinite(editValue) || editValue < 0) {
      toast.error("0円以上の目標金額を入力してください");
      return;
    }
    try {
      const { error } = await supabase
        .from("monthly_sales_targets")
        .upsert(
          {
            store_id: storeId,
            month_date: monthDate,
            target_revenue: editValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "store_id,month_date" }
        );
      if (error) throw error;
      toast.success("保存しました");
      setEditingMonth(null);
      fetchAll();
    } catch (error) {
      console.error("Error saving target:", error);
      toast.error("保存に失敗しました");
    }
  };

  const handleAdd = async () => {
    if (!newMonth) {
      toast.error("対象月を選択してください");
      return;
    }
    if (!Number.isFinite(newTarget) || newTarget < 0) {
      toast.error("0円以上の目標金額を入力してください");
      return;
    }
    const monthDate = `${newMonth}-01`;
    try {
      const { error } = await supabase
        .from("monthly_sales_targets")
        .upsert(
          {
            store_id: storeId,
            month_date: monthDate,
            target_revenue: newTarget,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "store_id,month_date" }
        );
      if (error) throw error;
      toast.success("追加しました");
      setShowAddForm(false);
      setNewTarget(0);
      fetchAll();
    } catch (error) {
      console.error("Error adding target:", error);
      toast.error("追加に失敗しました");
    }
  };

  const totalTarget = targets.reduce((sum, t) => sum + getTargetAmount(t), 0);
  const totalActual = targets.reduce((sum, t) => sum + (reports[t.month_date] || 0), 0);
  const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">月別売上目標</h1>
              <p className="text-muted-foreground">月ごとの売上目標設定と達成状況</p>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={16} className="mr-1.5" />月を追加
            </Button>
          </div>

          {showAddForm && (
            <Card className="mb-6">
              <CardHeader><CardTitle>月を追加</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>対象月</Label>
                    <Input
                      type="month"
                      value={newMonth}
                      onChange={(e) => setNewMonth(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>目標売上（円）</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      inputMode="numeric"
                      value={newTarget}
                      onChange={(e) => setNewTarget(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAdd}>保存</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>キャンセル</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">目標合計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{totalTarget.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">実績合計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{totalActual.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">達成率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${achievement >= 100 ? "text-green-600" : "text-red-600"}`}>
                  {achievement.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground">読み込み中...</div>
          ) : targets.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                データがありません。「月を追加」から目標を設定してください。
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">年月</th>
                        <th className="text-left py-3 px-4 font-semibold">目標</th>
                        <th className="text-left py-3 px-4 font-semibold">実績</th>
                        <th className="text-left py-3 px-4 font-semibold">達成率</th>
                        <th className="text-left py-3 px-4 font-semibold">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((target) => {
                        const targetAmt = getTargetAmount(target);
                        const actual = reports[target.month_date] || 0;
                        const rate = targetAmt > 0 ? (actual / targetAmt) * 100 : 0;
                        const d = new Date(target.month_date + "T00:00:00");
                        return (
                          <tr key={target.month_date} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 font-semibold">
                              {d.getFullYear()}年{String(d.getMonth() + 1).padStart(2, "0")}月
                            </td>
                            <td className="py-3 px-4">
                              {editingMonth === target.month_date ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  inputMode="numeric"
                                  value={editValue}
                                  onChange={(e) => setEditValue(Number(e.target.value))}
                                  className="w-32"
                                  autoFocus
                                />
                              ) : (
                                `¥${targetAmt.toLocaleString()}`
                              )}
                            </td>
                            <td className="py-3 px-4">¥{actual.toLocaleString()}</td>
                            <td className={`py-3 px-4 font-semibold ${rate >= 100 ? "text-green-600" : "text-red-600"}`}>
                              {targetAmt > 0 ? `${rate.toFixed(1)}%` : "—"}
                            </td>
                            <td className="py-3 px-4">
                              {editingMonth === target.month_date ? (
                                <div className="flex gap-1.5">
                                  <Button size="sm" onClick={() => handleSave(target.month_date)}>
                                    <Check size={13} />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingMonth(null)}>
                                    <X size={13} />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingMonth(target.month_date);
                                    setEditValue(targetAmt);
                                  }}
                                >
                                  <Pencil size={13} />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
