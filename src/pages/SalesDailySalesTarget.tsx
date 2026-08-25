import { useEffect, useState } from "react";
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
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface DailySalesTarget {
  target_date: string;
  target_amount: number;
}

const yen = (value: number) => "¥" + value.toLocaleString();

export default function SalesDailySalesTarget() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [targets, setTargets] = useState<DailySalesTarget[]>([]);
  const [actualByDate, setActualByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newTarget, setNewTarget] = useState(0);

  const { user, loading: authLoading } = useAuth();
  const { storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !storeLoading) {
      fetchTargets();
    }
  }, [user, storeId, storeLoading]);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("daily_sales_targets")
        .select("target_date,target_amount")
        .eq("store_id", storeId)
        .order("target_date", { ascending: false })
        .limit(60);

      if (error) throw error;

      const targetRows = (data || []) as DailySalesTarget[];
      setTargets(targetRows);

      if (targetRows.length === 0) {
        setActualByDate({});
        return;
      }

      const dates = targetRows.map((target) => target.target_date).sort();
      const { data: reservations, error: reservationsError } = await supabase
        .from("reservations")
        .select("reservation_date,price")
        .eq("store_id", storeId)
        .gte("reservation_date", dates[0])
        .lte("reservation_date", dates[dates.length - 1])
        .in("status", ["confirmed", "completed"]);

      if (reservationsError) throw reservationsError;

      const nextActual: Record<string, number> = {};
      for (const reservation of reservations || []) {
        const date = reservation.reservation_date;
        nextActual[date] = (nextActual[date] || 0) + (reservation.price || 0);
      }
      setActualByDate(nextActual);
    } catch (error) {
      console.error("Error fetching daily sales targets:", error);
      toast.error("日別売上目標の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const persistTarget = async (targetDate: string, amount: number) => {
    if (!targetDate) {
      toast.error("対象日を選択してください");
      return false;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("0円以上の目標金額を入力してください");
      return false;
    }

    setSaving(true);
    const { error } = await supabase
      .from("daily_sales_targets")
      .upsert(
        {
          store_id: storeId,
          target_date: targetDate,
          target_amount: Math.trunc(amount),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,target_date" }
      );
    setSaving(false);

    if (error) {
      console.error("Error saving daily sales target:", error);
      toast.error("日別売上目標の保存に失敗しました");
      return false;
    }

    await fetchTargets();
    return true;
  };

  const handleSave = async (targetDate: string) => {
    if (await persistTarget(targetDate, editValue)) {
      setEditingDate(null);
      toast.success("保存しました");
    }
  };

  const handleAdd = async () => {
    if (await persistTarget(newDate, newTarget)) {
      setShowAddForm(false);
      setNewTarget(0);
      toast.success("追加しました");
    }
  };

  const totalTarget = targets.reduce((sum, target) => sum + (target.target_amount || 0), 0);
  const totalActual = targets.reduce(
    (sum, target) => sum + (actualByDate[target.target_date] || 0),
    0
  );
  const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">日別売上目標</h1>
              <p className="text-muted-foreground">日ごとの売上目標設定と達成状況</p>
            </div>
            <Button onClick={() => setShowAddForm((open) => !open)}>
              <Plus size={16} className="mr-1.5" />
              日付を追加
            </Button>
          </div>

          {showAddForm ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>日別目標を追加</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="daily-target-date">対象日</Label>
                    <Input
                      id="daily-target-date"
                      type="date"
                      value={newDate}
                      onChange={(event) => setNewDate(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="daily-target-amount">目標売上（円）</Label>
                    <Input
                      id="daily-target-amount"
                      type="number"
                      min="0"
                      step="1000"
                      inputMode="numeric"
                      value={newTarget}
                      onChange={(event) => setNewTarget(Number(event.target.value))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAdd} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    disabled={saving}
                  >
                    キャンセル
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">目標合計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{yen(totalTarget)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">実績合計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{yen(totalActual)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">達成率</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={
                    "text-2xl font-bold " +
                    (achievement >= 100 ? "text-green-600" : "text-red-600")
                  }
                >
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
                データがありません。「日付を追加」から目標を設定してください。
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">日付</th>
                        <th className="text-left py-3 px-4 font-semibold">目標</th>
                        <th className="text-left py-3 px-4 font-semibold">実績</th>
                        <th className="text-left py-3 px-4 font-semibold">達成率</th>
                        <th className="text-left py-3 px-4 font-semibold">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((target) => {
                        const actual = actualByDate[target.target_date] || 0;
                        const rate =
                          target.target_amount > 0
                            ? (actual / target.target_amount) * 100
                            : 0;
                        return (
                          <tr
                            key={target.target_date}
                            className="border-b hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 px-4 font-semibold">
                              {format(parseISO(target.target_date), "yyyy/MM/dd(E)", {
                                locale: ja,
                              })}
                            </td>
                            <td className="py-3 px-4">
                              {editingDate === target.target_date ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  inputMode="numeric"
                                  value={editValue}
                                  onChange={(event) =>
                                    setEditValue(Number(event.target.value))
                                  }
                                  className="w-32"
                                  autoFocus
                                />
                              ) : (
                                yen(target.target_amount || 0)
                              )}
                            </td>
                            <td className="py-3 px-4">{yen(actual)}</td>
                            <td
                              className={
                                "py-3 px-4 font-semibold " +
                                (rate >= 100 ? "text-green-600" : "text-red-600")
                              }
                            >
                              {target.target_amount > 0 ? rate.toFixed(1) + "%" : "—"}
                            </td>
                            <td className="py-3 px-4">
                              {editingDate === target.target_date ? (
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSave(target.target_date)}
                                    disabled={saving}
                                    aria-label="日別目標を保存"
                                  >
                                    <Check size={13} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingDate(null)}
                                    disabled={saving}
                                    aria-label="編集をキャンセル"
                                  >
                                    <X size={13} />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingDate(target.target_date);
                                    setEditValue(target.target_amount);
                                  }}
                                  aria-label="日別目標を編集"
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
