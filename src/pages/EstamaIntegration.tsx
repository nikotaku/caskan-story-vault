import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Calendar, Users, Loader2, Upload, Image } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function EstamaIntegration() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [syncing, setSyncing] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleRefresh = () => setIframeKey(prev => prev + 1);

  const handleOpenInNewTab = () => {
    window.open('https://estama.jp/login?utm_source=chatgpt.com', '_blank');
  };

  // こちらのデータをエスたまに反映（マスタデータはこちら）

  // エスたまにデータをプッシュ
  const handlePush = async (pushType: 'schedule' | 'profiles' | 'photos' | 'all') => {
    setSyncing(`push-${pushType}`);
    try {
      const { data, error } = await supabase.functions.invoke('push-to-estama', {
        body: { pushType }
      });
      if (error) throw error;

      const parts = [];
      if (data.schedulesUpdated > 0) parts.push(`スケジュール: ${data.schedulesUpdated}件`);
      if (data.profilesUpdated > 0) parts.push(`プロフィール: ${data.profilesUpdated}件`);
      if (data.photosUploaded > 0) parts.push(`写真: ${data.photosUploaded}枚`);
      if (data.errors?.length > 0) parts.push(`エラー: ${data.errors.length}件`);

      toast({
        title: data.success ? "更新完了" : "一部エラー",
        description: parts.length > 0 ? parts.join('、') : "対象データなし",
        variant: data.errors?.length > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error('Push error:', error);
      toast({ title: "更新エラー", description: "エスたまへの更新に失敗しました", variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) return null;

  const isLoading = (key: string) => syncing === key;
  const LoadingIcon = ({ loading }: { loading: boolean }) => 
    loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-6 md:ml-[240px]">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                エスたまへ反映（マスタ: こちら）
              </CardTitle>
              <p className="text-xs text-muted-foreground">当システムのデータをエスたまに反映します</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handlePush('schedule')}
                  disabled={!!syncing}
                  variant="outline"
                  size="sm"
                >
                  <LoadingIcon loading={isLoading('push-schedule')} />
                  {!isLoading('push-schedule') && <Calendar className="w-4 h-4 mr-2" />}
                  スケジュール
                </Button>
                <Button
                  onClick={() => handlePush('profiles')}
                  disabled={!!syncing}
                  variant="outline"
                  size="sm"
                >
                  <LoadingIcon loading={isLoading('push-profiles')} />
                  {!isLoading('push-profiles') && <Users className="w-4 h-4 mr-2" />}
                  プロフィール
                </Button>
                <Button
                  onClick={() => handlePush('photos')}
                  disabled={!!syncing}
                  variant="outline"
                  size="sm"
                >
                  <LoadingIcon loading={isLoading('push-photos')} />
                  {!isLoading('push-photos') && <Image className="w-4 h-4 mr-2" />}
                  写真
                </Button>
                <Button
                  onClick={() => handlePush('all')}
                  disabled={!!syncing}
                  size="sm"
                >
                  <LoadingIcon loading={isLoading('push-all')} />
                  {!isLoading('push-all') && <Upload className="w-4 h-4 mr-2" />}
                  全て反映
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* iframe */}
          <div className="h-[calc(100vh-360px)]">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                <CardTitle className="text-base">Estama管理画面</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={handleRefresh} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleOpenInNewTab} variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
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
