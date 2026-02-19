import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw, Calendar, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function EstamaIntegration() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [syncingSchedule, setSyncingSchedule] = useState(false);
  const [syncingProfiles, setSyncingProfiles] = useState(false);
  const [syncingBoth, setSyncingBoth] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenInNewTab = () => {
    window.open('https://estama.jp/login?utm_source=chatgpt.com', '_blank');
  };

  const handleSync = async (syncType: 'schedule' | 'profiles' | 'both') => {
    const setLoading = syncType === 'schedule' ? setSyncingSchedule : syncType === 'profiles' ? setSyncingProfiles : setSyncingBoth;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-estama-schedule', {
        body: { syncType }
      });

      if (error) throw error;

      const parts = [];
      if (data.shiftsProcessed > 0) parts.push(`シフト: ${data.shiftsProcessed}件`);
      if (data.profilesProcessed > 0) parts.push(`プロフィール: ${data.profilesProcessed}件`);

      toast({
        title: "同期完了",
        description: parts.length > 0 ? parts.join('、') : "同期対象のデータがありませんでした",
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "同期エラー",
        description: "同期に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
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
          {/* 同期ボタンエリア */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">エスたま同期</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleSync('schedule')}
                  disabled={syncingSchedule || syncingBoth}
                  variant="outline"
                >
                  {syncingSchedule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                  スケジュール同期
                </Button>
                <Button
                  onClick={() => handleSync('profiles')}
                  disabled={syncingProfiles || syncingBoth}
                  variant="outline"
                >
                  {syncingProfiles ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                  プロフィール同期
                </Button>
                <Button
                  onClick={() => handleSync('both')}
                  disabled={syncingSchedule || syncingProfiles || syncingBoth}
                >
                  {syncingBoth ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  全て同期
                </Button>
                <Button
                  onClick={handleOpenInNewTab}
                  variant="ghost"
                  size="sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  管理画面を開く
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                ※ 公開ページからスケジュール・セラピスト情報を取得します。名前が一致する既存セラピストは更新、存在しない場合は新規作成します。
              </p>
            </CardContent>
          </Card>

          {/* iframe */}
          <div className="h-[calc(100vh-280px)]">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                <CardTitle>Estama管理画面</CardTitle>
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  更新
                </Button>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <iframe
                  key={iframeKey}
                  src="https://estama.jp/login?utm_source=chatgpt.com"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  allow="clipboard-read; clipboard-write"
                  title="Estama Integration"
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
