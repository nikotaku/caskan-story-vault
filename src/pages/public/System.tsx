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
    <div className="min-h-screen" style={{ backgroundColor: "#f5e8e4" }}>
      {/* Top Contact Bar */}
      <div className="bg-[#d4b5a8] text-white py-2 px-4 flex justify-between items-center text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-white border-y border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/public" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">TOP</div>
              <div className="text-xs text-[#a89586]">トップ</div>
            </Link>
            <Link to="/public/schedule" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SCHEDULE</div>
              <div className="text-xs text-[#a89586]">出勤情報</div>
            </Link>
            <Link to="/public/casts" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">THERAPIST</div>
              <div className="text-xs text-[#a89586]">セラピスト</div>
            </Link>
            <Link to="/page/a" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">PRICING</div>
              <div className="text-xs text-[#a89586]">料金・システム</div>
            </Link>
            <Link to="/public/system" className="px-8 py-4 bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SYSTEM</div>
              <div className="text-xs text-[#a89586]">システム</div>
            </Link>
            <Link to="/public/booking" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">BOOKING</div>
              <div className="text-xs text-[#a89586]">WEB予約</div>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 
            className="text-4xl font-bold mb-8 text-center"
            style={{ 
              color: "#8b7355",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em"
            }}
          >
            SYSTEM - 料金システム
          </h1>

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
      <footer className="py-16 px-4 text-white" style={{ background: "linear-gradient(180deg, #d4b5a8 0%, #c5a89b 100%)" }}>
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <h4 className="font-bold mb-4 text-lg">営業時間</h4>
              <p className="text-white/95">12:00〜26:00</p>
              <p className="text-sm text-white/80">(24:40最終受付)</p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-lg">メニュー</h4>
              <div className="flex flex-col gap-3 text-sm">
                <Link to="/public/casts" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  セラピスト
                </Link>
                <Link to="/public/schedule" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  出勤情報
                </Link>
                <Link to="/page/a" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  料金・システム
                </Link>
                <Link to="/public/system" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  システム
                </Link>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-white/70 pt-10 border-t border-white/20">
            © 2025 全力エステ ZR. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default System;
