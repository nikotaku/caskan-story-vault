import { useState, useEffect } from "react";
import { TrendingUp, Users, DollarSign, Calendar, Star } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalReservations: number;
  totalSales: number;
  totalCasts: number;
  avgRating: number;
}

interface CastStats {
  name: string;
  sales: number;
  rating: number;
  workDays: number;
}

export default function Report() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalReservations: 0,
    totalSales: 0,
    totalCasts: 0,
    avgRating: 0,
  });
  const [castStats, setCastStats] = useState<CastStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

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
    }
  }, [user, period]);

  const fetchStats = async () => {
    try {
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('price, status')
        .in('status', ['confirmed', 'completed']);

      if (resError) throw resError;

      const totalSales = reservations?.reduce((sum, r) => sum + r.price, 0) || 0;
      const totalReservations = reservations?.length || 0;

      const { data: casts, error: castError } = await supabase
        .from('casts')
        .select('rating');

      if (castError) throw castError;

      const totalCasts = casts?.length || 0;
      const avgRating = casts && casts.length > 0
        ? casts.reduce((sum, c) => sum + c.rating, 0) / casts.length
        : 0;

      setStats({
        totalReservations,
        totalSales,
        totalCasts,
        avgRating: Math.round(avgRating * 10) / 10,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCastStats = async () => {
    try {
      const { data: casts, error } = await supabase
        .from('casts')
        .select('name, rating, month_sales, work_days')
        .order('month_sales', { ascending: false })
        .limit(10);

      if (error) throw error;

      setCastStats(casts?.map(c => ({
        name: c.name,
        sales: c.month_sales,
        rating: c.rating,
        workDays: c.work_days,
      })) || []);
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
              
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">今週</SelectItem>
                  <SelectItem value="month">今月</SelectItem>
                  <SelectItem value="year">今年</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">平均評価</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgRating}</div>
                </CardContent>
              </Card>
            </div>

            {/* Cast Rankings */}
            <Card>
              <CardHeader>
                <CardTitle>キャスト別売上ランキング（今月）</CardTitle>
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
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Star size={14} fill="currentColor" className="text-yellow-500" />
                            {cast.rating}
                          </span>
                          <span>出勤: {cast.workDays}日</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xl">¥{cast.sales.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">今月の売上</div>
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
          </div>
        </main>
      </div>
    </div>
  );
}
