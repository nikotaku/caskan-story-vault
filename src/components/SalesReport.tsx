import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminStore } from "@/hooks/useAdminStore";
import { format, startOfToday, endOfToday, startOfYesterday, endOfYesterday, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface SalesData {
  period: string;
  amount: string;
  reservations: number;
}

export const SalesReport = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([
    { period: "本日", amount: "0円", reservations: 0 },
    { period: "昨日", amount: "0円", reservations: 0 },
    { period: "今月", amount: "0円", reservations: 0 },
    { period: "昨月", amount: "0円", reservations: 0 }
  ]);
  const [loading, setLoading] = useState(true);
  const [monthSales, setMonthSales] = useState(0);
  const [target, setTarget] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  const { storeId, loading: storeLoading } = useAdminStore();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthDate = format(startOfMonth(today), "yyyy-MM-dd");

  useEffect(() => {
    if (!storeLoading) {
      fetchSalesData();
      fetchTarget();
    }
  }, [storeId, storeLoading]);

  const fetchTarget = async () => {
    const { data } = await supabase
      .from("monthly_sales_targets")
      .select("target_revenue")
      .eq("store_id", storeId)
      .eq("month_date", monthDate)
      .maybeSingle();
    setTarget(data?.target_revenue ?? 0);
    setTargetInput(String(data?.target_revenue ?? 0));
  };

  const saveTarget = async () => {
    const amount = Number(targetInput);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("0円以上の目標金額を入力してください");
      return;
    }

    setSavingTarget(true);
    const { error } = await supabase
      .from("monthly_sales_targets")
      .upsert(
        {
          store_id: storeId,
          month_date: monthDate,
          target_revenue: Math.trunc(amount),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,month_date" }
      );
    setSavingTarget(false);

    if (error) {
      console.error("Error saving sales target:", error);
      toast.error("目標金額の保存に失敗しました");
      return;
    }
    setTarget(Math.trunc(amount));
    setEditOpen(false);
    toast.success("目標金額を保存しました");
  };

  const fetchSalesData = async () => {
    try {
      const todayDate = new Date();

      const { data: todayData } = await supabase
        .from('reservations')
        .select('price')
        .eq('store_id', storeId)
        .eq('store_id', storeId)
        .eq('store_id', storeId)
        .eq('store_id', storeId)
        .gte('reservation_date', format(startOfToday(), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfToday(), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      const { data: yesterdayData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', format(startOfYesterday(), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfYesterday(), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      const { data: thisMonthData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', format(startOfMonth(todayDate), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfMonth(todayDate), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      const lastMonth = subMonths(todayDate, 1);
      const { data: lastMonthData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', format(startOfMonth(lastMonth), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      const calc = (data: any[] | null) => ({
        total: data?.reduce((s, i) => s + (i.price || 0), 0) ?? 0,
        count: data?.length ?? 0,
      });

      const t = calc(todayData);
      const y = calc(yesterdayData);
      const m = calc(thisMonthData);
      const lm = calc(lastMonthData);

      setMonthSales(m.total);
      setSalesData([
        { period: "本日", amount: `${t.total.toLocaleString()}円`, reservations: t.count },
        { period: "昨日", amount: `${y.total.toLocaleString()}円`, reservations: y.count },
        { period: "今月", amount: `${m.total.toLocaleString()}円`, reservations: m.count },
        { period: "昨月", amount: `${lm.total.toLocaleString()}円`, reservations: lm.count },
      ]);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <h3 className="font-semibold text-sm mb-4">売上</h3>
          <div className="text-center py-4 text-muted-foreground">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  const rate = target > 0 ? Math.min(100, (monthSales / target) * 100) : 0;

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h3 className="font-semibold text-sm mb-4">売上</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {salesData.map((data, index) => (
            <div key={index} className="space-y-2">
              <div className="text-xs text-muted-foreground">{data.period}</div>
              <div className="text-xl font-medium">{data.amount}</div>
              <div className="text-sm text-primary">
                <span className="text-xs text-muted-foreground mr-2">予約</span>
                {data.reservations}件
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-muted-foreground">
              今月の目標達成率（{year}年{month}月）
            </div>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <Pencil className="w-3 h-3 mr-1" />
                  目標設定
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{year}年{month}月の目標金額</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>目標金額（円）</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    inputMode="numeric"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="例: 3000000"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>キャンセル</Button>
                  <Button onClick={saveTarget} disabled={savingTarget}>
                    {savingTarget ? "保存中..." : "保存"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-end justify-between mb-2">
            <div className="text-2xl font-bold">{rate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">
              {monthSales.toLocaleString()}円 / {target.toLocaleString()}円
            </div>
          </div>
          <Progress value={rate} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
};
