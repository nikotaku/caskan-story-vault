import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const System = () => {
  const courses = [
    {
      name: "60分コース",
      price: "¥10,000",
      features: ["全身リラクゼーション", "アロマオイル使用", "フェイシャルケア"],
    },
    {
      name: "90分コース",
      price: "¥15,000",
      features: ["全身リラクゼーション", "アロマオイル使用", "フェイシャルケア", "ヘッドマッサージ"],
      popular: true,
    },
    {
      name: "120分コース",
      price: "¥20,000",
      features: [
        "全身リラクゼーション",
        "アロマオイル使用",
        "フェイシャルケア",
        "ヘッドマッサージ",
        "足つぼマッサージ",
      ],
    },
  ];

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
            <Link to="/public/system" className="text-sm font-medium text-primary transition-colors">
              料金システム
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

      <main className="container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">SYSTEM - 料金システム</h1>

          {/* Courses */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {courses.map((course, index) => (
              <Card
                key={index}
                className={`relative ${
                  course.popular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {course.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
                      人気No.1
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl text-center">{course.name}</CardTitle>
                  <p className="text-3xl font-bold text-center text-primary mt-2">
                    {course.price}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {course.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-6" asChild>
                    <a href="tel:080-3192-1209">予約する</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Info */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>営業時間</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-2">12:00〜26:00（翌2:00）</p>
                <p className="text-sm text-muted-foreground">最終受付 24:40</p>
                <p className="text-sm text-muted-foreground mt-2">年中無休</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>お支払い方法</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>現金</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>クレジットカード</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>電子マネー</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>ご利用上の注意</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>・ご予約はお電話にて承っております</li>
                  <li>・キャンセルの場合は必ずご連絡ください</li>
                  <li>・当日キャンセルの場合、キャンセル料が発生する場合がございます</li>
                  <li>・18歳未満の方のご利用はお断りしております</li>
                  <li>・泥酔状態でのご来店はお断りする場合がございます</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Card className="bg-gradient-to-r from-primary/10 to-accent/10">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">ご予約・お問い合わせ</h2>
                <p className="text-muted-foreground mb-6">
                  お気軽にお電話ください
                </p>
                <Button size="lg" asChild>
                  <a href="tel:080-3192-1209" className="text-lg">
                    080-3192-1209
                  </a>
                </Button>
              </CardContent>
            </Card>
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

export default System;
