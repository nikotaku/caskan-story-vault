import { Link } from "react-router-dom";
import { useEffect } from "react";
import { MapPin, Train, Clock, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaXTwitter, FaLine } from "react-icons/fa6";
import { ChatBot } from "@/components/ChatBot";
import caskanLogo from "@/assets/caskan-logo.png";

const Access = () => {
  useEffect(() => {
    document.title = "全力エステ - アクセス";
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5e8e4" }}>
      {/* Top Contact Bar */}
      <div className="bg-[#d4b5a8] text-white py-2 px-4 flex justify-between items-center text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Hero Section with Logo */}
      <div className="relative py-12 text-center" style={{ background: "linear-gradient(180deg, #f5e8e4 0%, #edddd6 100%)" }}>
        <div className="container mx-auto">
          <img 
            src={caskanLogo} 
            alt="全力エステ" 
            className="h-32 md:h-48 mx-auto object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-white border-y border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">TOP</div>
              <div className="text-xs text-[#a89586]">トップ</div>
            </Link>
            <Link to="/schedule" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SCHEDULE</div>
              <div className="text-xs text-[#a89586]">出勤情報</div>
            </Link>
            <Link to="/casts" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">THERAPIST</div>
              <div className="text-xs text-[#a89586]">セラピスト</div>
            </Link>
            <Link to="/system" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SYSTEM</div>
              <div className="text-xs text-[#a89586]">システム</div>
            </Link>
            <Link to="/access" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">ACCESS</div>
              <div className="text-xs text-[#a89586]">アクセス</div>
            </Link>
            <Link to="/booking" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">BOOKING</div>
              <div className="text-xs text-[#a89586]">WEB予約</div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4" style={{ color: "#8b7355" }}>
            ACCESS
          </h1>
          <p className="text-center text-[#a89586] mb-12 text-lg">アクセス</p>

          {/* Shop Information Card */}
          <Card className="mb-8 border-[#e5d5cc]" style={{ backgroundColor: "#ffffff" }}>
            <CardHeader>
              <CardTitle className="text-2xl" style={{ color: "#8b7355" }}>店舗情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "#d4a574" }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#8b7355" }}>住所</h3>
                  <p className="text-[#6b5b4a]">〒150-0042</p>
                  <p className="text-[#6b5b4a]">東京都渋谷区宇田川町</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Train className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "#d4a574" }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#8b7355" }}>最寄り駅</h3>
                  <p className="text-[#6b5b4a]">JR渋谷駅 徒歩5分</p>
                  <p className="text-[#6b5b4a]">東京メトロ各線 渋谷駅 徒歩5分</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Clock className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "#d4a574" }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#8b7355" }}>営業時間</h3>
                  <p className="text-[#6b5b4a]">12:00〜26:00</p>
                  <p className="text-sm text-[#a89586]">（24:40最終受付）</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Phone className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: "#d4a574" }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: "#8b7355" }}>電話番号</h3>
                  <p className="text-[#6b5b4a]">03-XXXX-XXXX</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map */}
          <Card className="mb-8 border-[#e5d5cc]" style={{ backgroundColor: "#ffffff" }}>
            <CardHeader>
              <CardTitle className="text-2xl" style={{ color: "#8b7355" }}>地図</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[400px] bg-[#f5e8e4] rounded-lg flex items-center justify-center">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.747799295891!2d139.69845631525835!3d35.66174238019847!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188ca8277a9da9%3A0x98294c24e87d4f0!2z5rih6LC35Yy6!5e0!3m2!1sja!2sjp!4v1699999999999!5m2!1sja!2sjp"
                  width="100%"
                  height="100%"
                  style={{ border: 0, borderRadius: "0.5rem" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="店舗地図"
                />
              </div>
            </CardContent>
          </Card>

          {/* Access Notice */}
          <Card className="border-[#e5d5cc]" style={{ backgroundColor: "#fff9f5" }}>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 text-lg" style={{ color: "#8b7355" }}>アクセスに関して</h3>
              <ul className="space-y-2 text-[#6b5b4a]">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>詳細な場所は予約確定後にご案内いたします</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>お車でのご来店の場合、近隣のコインパーキングをご利用ください</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>迷われた際はお気軽にお電話ください</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Call to Action Section */}
      <div className="py-16 text-center" style={{ backgroundColor: "#edddd6" }}>
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8" style={{ color: "#8b7355" }}>
            ご予約・お問い合わせ
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="gap-2 px-8 py-6 text-lg"
              style={{ 
                backgroundColor: "#00B900",
                color: "white"
              }}
              onClick={() => window.open('https://line.me/', '_blank')}
            >
              <FaLine className="w-6 h-6" />
              LINEで予約
            </Button>
            <Button
              size="lg"
              className="gap-2 px-8 py-6 text-lg"
              style={{ 
                backgroundColor: "#1DA1F2",
                color: "white"
              }}
              onClick={() => window.open('https://twitter.com/', '_blank')}
            >
              <FaXTwitter className="w-6 h-6" />
              Xをフォロー
            </Button>
          </div>
          <div className="mt-8">
            <Link to="/booking">
              <Button
                size="lg"
                className="px-8 py-6 text-lg"
                style={{ 
                  backgroundColor: "#d4a574",
                  color: "white"
                }}
              >
                WEB予約はこちら
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#8b7355] text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">全力エステ</h3>
              <p className="text-sm opacity-90">営業時間: 12:00〜26:00</p>
              <p className="text-sm opacity-90">(24:40最終受付)</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">メニュー</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Link to="/" className="hover:opacity-80">トップ</Link>
                <Link to="/schedule" className="hover:opacity-80">出勤情報</Link>
                <Link to="/casts" className="hover:opacity-80">セラピスト</Link>
                <Link to="/system" className="hover:opacity-80">システム</Link>
                <Link to="/access" className="hover:opacity-80">アクセス</Link>
                <Link to="/booking" className="hover:opacity-80">WEB予約</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/20 text-center text-sm opacity-80">
            <p>© 2024 全力エステ. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ChatBot />
    </div>
  );
};

export default Access;
