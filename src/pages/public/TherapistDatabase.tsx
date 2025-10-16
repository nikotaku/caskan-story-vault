import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TherapistDatabase = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/public" className="flex items-center space-x-2">
            <img src="/src/assets/caskan-logo.png" alt="Logo" className="h-8 w-auto" />
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link to="/public" className="text-sm font-medium hover:text-primary transition-colors">
              トップ
            </Link>
            <Link to="/page/a" className="text-sm font-medium hover:text-primary transition-colors">
              料金・システム
            </Link>
            <Link to="/public/schedule" className="text-sm font-medium hover:text-primary transition-colors">
              出勤情報
            </Link>
            <Link to="/public/casts" className="text-sm font-medium hover:text-primary transition-colors">
              セラピスト
            </Link>
            <Link to="/public/therapist-database" className="text-sm font-medium text-primary transition-colors">
              セラピストDB
            </Link>
          </nav>
          <Button asChild>
            <a href="tel:080-3192-1209">
              電話予約
            </a>
          </Button>
        </div>
      </header>

      <main className="container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">セラピストデータベース</h1>

          {/* Notion Embed */}
          <div className="w-full" style={{ height: 'calc(100vh - 200px)' }}>
            <iframe
              src="https://www.notion.so/20af9507f0cf809cae97d5be86e589e6?v=27df9507f0cf80a2ab6be385d8570292&pvs=4"
              className="w-full h-full border-0 rounded-lg shadow-lg"
              title="セラピストデータベース"
            />
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>※データベースの表示に時間がかかる場合があります</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t mt-12">
        <div className="container max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          © 2025 全力エステ ZR. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default TherapistDatabase;
