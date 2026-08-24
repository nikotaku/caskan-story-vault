import { useState, useEffect } from "react";
import { TrendingUp, Users, DollarSign, Calendar, ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleSheetPanel } from "@/components/GoogleSheetPanel";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { SalesReport } from "@/components/SalesReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ja } from "date-fns/locale";

interface Stats {
  totalReservations: number;
  totalSales: number;
  totalCasts: number;
}

interface ExpenseStats {
  miscExpenses: number;
  accommodationFee: number;
  transportationFee: number;
}

interface CastStats {
  name: string;
  sales: number;
  workDays: number;
}

export default function Report() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalReservations: 0,
    totalSales: 0,
    totalCasts: 0,
  });
  const [castStats, setCastStats] = useState<CastStats[]>([]);
  const [expenseStats, setExpenseStats] = useState<ExpenseStats>({ miscExpenses: 0, accommodationFee: 0, transportationFee: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const isCurrentMonth = format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchCastStats();
      fetchExpenseStats();
    }
  }, [user, selectedMonth]);

  const fetchStats = async () => {
    try {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('price, status, reservation_date')
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate)
        .in('status', ['confirmed', 'completed']);

      if (resError) throw resError;

      const totalSales = reservations?.reduce((sum, r) => sum + r.price, 0) || 0;
      const totalReservations = reservations?.length || 0;

      const { data: casts, error: castError } = await supabase
        .from('casts')
        .select('id')
        .eq('is_active', true);

      if (castError) throw castError;

      const totalCasts = casts?.length || 0;

      setStats({
        totalReservations,
        totalSales,
        totalCasts,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseStats = async () => {
    const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('daily_clearances' as any)
      .select('misc_expenses, accommodation_fee, transportation_fee')
      .gte('date', startDate)
      .lte('date', endDate);
    const rows = (data as any[]) ?? [];
    setExpenseStats({
      miscExpenses: rows.reduce((s, r) => s + (r.misc_expenses ?? 0), 0),
      accommodationFee: rows.reduce((s, r) => s + (r.accommodation_fee ?? 0), 0),
      transportationFee: rows.reduce((s, r) => s + (r.transportation_fee ?? 0), 0),
    });
  };

  const fetchCastStats = async () => {
    try {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('cast_id, price, casts(name)')
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate)
        .in('status', ['confirmed', 'completed']);

      if (resError) throw resError;

      // キャストごとに売上を集計
      const castSalesMap = new Map<string, { name: string; sales: number; count: number }>();
      
      reservations?.forEach(r => {
        if (r.casts && Array.isArray(r.casts) && r.casts[0]) {
          const castName = r.casts[0].name;
          const current = castSalesMap.get(castName) || { name: castName, sales: 0, count: 0 };
          castSalesMap.set(castName, {
            name: castName,
            sales: current.sales + r.price,
            count: current.count + 1,
          });
        }
      });

      // 売上順にソート
      const sortedStats = Array.from(castSalesMap.values())
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10)
        .map(c => ({
          name: c.name,
          sales: c.sales,
          workDays: c.count,
        }));

      setCastStats(sortedStats);
    } catch (error) {
      console.error('Error fetching cast stats:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-6 md:ml-[240px]">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">レポート</h1>
                <p className="text-muted-foreground">売上・予約・キャストの統計</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setSelectedMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm font-medium w-28 text-center">
                  {format(selectedMonth, "yyyy年M月", { locale: ja })}
                </span>
                <Button variant="outline" size="icon" onClick={() => setSelectedMonth((m) => addMonths(m, 1))} disabled={isCurrentMonth}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <SalesReport />

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">総売上</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">¥{stats.totalSales.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">予約確定分のみ</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">予約数</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalReservations}件</div>
                  <p className="text-xs text-muted-foreground mt-1">確定・完了分</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">在籍キャスト</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalCasts}名</div>
                </CardContent>
              </Card>
            </div>

            {/* Expense Summary */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">雑費合計</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">¥{expenseStats.miscExpenses.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">日別清算より集計</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">宿泊費合計</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">¥{expenseStats.accommodationFee.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">日別清算より集計</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">交通費合計</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">¥{expenseStats.transportationFee.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">日別清算より集計</p>
                </CardContent>
              </Card>
            </div>

            {/* Cast Rankings */}
            <Card>
              <CardHeader>
                <CardTitle>キャスト別売上ランキング（{format(selectedMonth, "yyyy年M月", { locale: ja })}）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {castStats.map((cast, index) => (
                    <div key={cast.name} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-lg">{cast.name}</div>
                        <div className="text-sm text-muted-foreground">
                          <span>出勤: {cast.workDays}日</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xl">¥{cast.sales.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{format(selectedMonth, "M月")}の売上</div>
                      </div>
                    </div>
                  ))}
                  {castStats.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      データがありません
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="mt-6">
              <Tabs defaultValue="db">
                <TabsList>
                  <TabsTrigger value="db">DBレポート</TabsTrigger>
                  <TabsTrigger value="sheet" className="gap-1.5">
                    <Table2 size={13} />Googleスプレッドシート
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="sheet" className="mt-4">
                  <GoogleSheetPanel source="reports" />
                </TabsContent>
                <TabsContent value="db" />
              </Tabs>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
