import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function EstamaIntegration() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
          <div className="h-[calc(100vh-108px)]">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                <CardTitle>Estama連携</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    更新
                  </Button>
                  <Button
                    onClick={handleOpenInNewTab}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    新しいタブで開く
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

            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>注意：</strong> この統合はiframeを使用しています。一部の機能が制限される場合があります。
                完全な機能を使用する場合は「新しいタブで開く」ボタンをクリックしてください。
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
