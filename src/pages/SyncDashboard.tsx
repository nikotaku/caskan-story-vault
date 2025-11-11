import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Calendar, Users, CheckCircle2, XCircle, Clock, Activity } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const SyncDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  // 最新のシフト情報を取得
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, casts(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  // キャスト情報を取得
  const { data: casts } = useQuery({
    queryKey: ['casts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('casts')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // 手動同期を実行
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-estama-schedule', {
        body: {}
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`同期完了: ${data.shiftsProcessed}件のシフトを処理しました`);
      queryClient.invalidateQueries({ queryKey: ['shifts-all'] });
    },
    onError: (error: Error) => {
      toast.error(`同期エラー: ${error.message}`);
    }
  });

  // 統計情報の計算
  const stats = {
    totalShifts: shifts?.length || 0,
    todayShifts: shifts?.filter(s => s.shift_date === format(new Date(), 'yyyy-MM-dd')).length || 0,
    totalCasts: casts?.length || 0,
    lastSync: shifts?.[0]?.created_at ? new Date(shifts[0].created_at) : null
  };

  // 今日以降のシフトをグループ化
  const upcomingShifts = shifts?.filter(s => s.shift_date >= format(new Date(), 'yyyy-MM-dd')) || [];
  const shiftsByDate = upcomingShifts.reduce((acc, shift) => {
    const date = shift.shift_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, typeof shifts>);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="md:ml-[180px] pt-[60px] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">同期ダッシュボード</h1>
              <p className="text-muted-foreground mt-1">エスタマとのスケジュール同期状況</p>
            </div>
            <Button 
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              size="lg"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? '同期中...' : '今すぐ同期'}
            </Button>
          </div>

          {/* 統計カード */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総シフト数</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalShifts}</div>
                <p className="text-xs text-muted-foreground">登録済みシフト</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">本日のシフト</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayShifts}</div>
                <p className="text-xs text-muted-foreground">出勤予定</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">登録キャスト</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCasts}</div>
                <p className="text-xs text-muted-foreground">総キャスト数</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">最終同期</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.lastSync ? format(stats.lastSync, 'HH:mm') : '--:--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.lastSync ? format(stats.lastSync, 'M月d日', { locale: ja }) : '同期なし'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 自動同期情報 */}
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              自動同期が30分ごとに実行されています。次回の自動同期まであと最大30分です。
            </AlertDescription>
          </Alert>

          {/* 今後のシフト一覧 */}
          <Card>
            <CardHeader>
              <CardTitle>今後のシフト</CardTitle>
              <CardDescription>直近のスケジュール（日付別）</CardDescription>
            </CardHeader>
            <CardContent>
              {shiftsLoading ? (
                <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
              ) : Object.keys(shiftsByDate).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  シフトが登録されていません
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(shiftsByDate).slice(0, 7).map(([date, dateShifts]) => (
                    <div key={date} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-base">
                          {format(new Date(date), 'M月d日(E)', { locale: ja })}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {dateShifts.length}名出勤
                        </span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {dateShifts.map((shift: any) => (
                          <div 
                            key={shift.id} 
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium">{shift.casts?.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={shift.status === 'scheduled' ? 'default' : 'secondary'}
                            >
                              {shift.status === 'scheduled' ? '予定' : shift.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* キャスト一覧 */}
          <Card>
            <CardHeader>
              <CardTitle>登録キャスト</CardTitle>
              <CardDescription>エスタマから同期されるキャスト情報</CardDescription>
            </CardHeader>
            <CardContent>
              {!casts ? (
                <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {casts.map((cast) => (
                    <div 
                      key={cast.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        {cast.photo && (
                          <img 
                            src={cast.photo} 
                            alt={cast.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium">{cast.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">{cast.type}</p>
                        </div>
                      </div>
                      <Badge variant={cast.status === 'online' ? 'default' : 'secondary'}>
                        {cast.status === 'online' ? 'オンライン' : 'オフライン'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SyncDashboard;
