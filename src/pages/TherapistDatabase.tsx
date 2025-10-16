import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useState } from "react";

const TherapistDatabase = () => {
  const { user, loading, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">アクセス権限がありません</h1>
          <p className="text-muted-foreground mb-4">このページは管理者のみアクセス可能です</p>
          <Button asChild>
            <Link to="/">トップページに戻る</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1">
        <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="container py-8 px-4 ml-0 md:ml-[180px]">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">セラピストデータベース</h1>

            {/* Notion Embed */}
            <div className="w-full bg-white rounded-lg shadow-lg" style={{ height: 'calc(100vh - 250px)' }}>
              <iframe
                src="https://cherry-worm-418.notion.site/204f9507f0cf818ea0c6e2602c100b36?pvs=143"
                className="w-full h-full border-0 rounded-lg"
                title="セラピストデータベース"
              />
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>※データベースの表示に時間がかかる場合があります</p>
              <p className="mt-2">このページは管理者のみアクセス可能です</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TherapistDatabase;
