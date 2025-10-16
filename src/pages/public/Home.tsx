import { Link } from "react-router-dom";
import { Calendar, Users, DollarSign, MapPin, Newspaper, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/5">
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
            <Link to="/public/pricing" className="text-sm font-medium hover:text-primary transition-colors">
              料金表
            </Link>
            <Link to="/public/system" className="text-sm font-medium hover:text-primary transition-colors">
              システム
            </Link>
            <Link to="/public/schedule" className="text-sm font-medium hover:text-primary transition-colors">
              出勤情報
            </Link>
            <Link to="/public/casts" className="text-sm font-medium hover:text-primary transition-colors">
              セラピスト
            </Link>
          </nav>
          <Button asChild>
            <a href="tel:080-3192-1209">
              電話予約
            </a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20" />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            全力エステ ZR
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-muted-foreground">
            素直で愛嬌があり不器用でも全力心でサービス
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" asChild>
              <Link to="/public/casts">
                セラピスト一覧
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="tel:080-3192-1209">
                電話予約: 080-3192-1209
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Concept Section */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">CONCEPT - コンセプト</h2>
          <Card>
            <CardContent className="p-8">
              <p className="text-lg text-center leading-relaxed">
                素直で愛嬌があり不器用でも全力心でサービス<br />
                お客様に最高のリラクゼーション体験を提供いたします
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 px-4 bg-accent/5">
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/public/schedule" className="block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold mb-2">出勤情報</h3>
                  <p className="text-muted-foreground">本日の出勤スケジュール</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/public/casts" className="block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold mb-2">セラピスト</h3>
                  <p className="text-muted-foreground">在籍セラピスト紹介</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/public/pricing" className="block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="p-6 text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold mb-2">料金表</h3>
                  <p className="text-muted-foreground">コース・料金案内</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">営業時間</h4>
              <p className="text-muted-foreground">12:00〜26:00</p>
              <p className="text-sm text-muted-foreground">(24:40最終受付)</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">お問い合わせ</h4>
              <p className="text-muted-foreground">
                <a href="tel:080-3192-1209" className="hover:text-primary transition-colors">
                  TEL: 080-3192-1209
                </a>
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">メニュー</h4>
              <div className="flex flex-col gap-2 text-sm">
                <Link to="/public/casts" className="text-muted-foreground hover:text-primary transition-colors">
                  セラピスト
                </Link>
                <Link to="/public/schedule" className="text-muted-foreground hover:text-primary transition-colors">
                  出勤情報
                </Link>
                <Link to="/public/pricing" className="text-muted-foreground hover:text-primary transition-colors">
                  料金表
                </Link>
                <Link to="/public/system" className="text-muted-foreground hover:text-primary transition-colors">
                  システム
                </Link>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground pt-8 border-t">
            © 2025 全力エステ ZR. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
