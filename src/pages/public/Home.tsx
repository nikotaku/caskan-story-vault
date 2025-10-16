import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    "https://cdn2-caskan.com/caskan/img/shop_top_banner/1401_banner_1750253573.png",
    "https://cdn2-caskan.com/caskan/img/shop_top_banner/1401_banner_1750762260.png"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5e8e4" }}>
      {/* Top Contact Bar */}
      <div className="bg-[#d4b5a8] text-white py-2 px-4 flex justify-between items-center text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Hero Section with Large Logo */}
      <div className="relative py-16 text-center" style={{ background: "linear-gradient(180deg, #f5e8e4 0%, #edddd6 100%)" }}>
        <div className="relative inline-block">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[180px] font-bold opacity-10" style={{ color: "#d4a574", fontFamily: "'Noto Serif JP', serif" }}>
            ZR
          </div>
          <h1 
            className="text-8xl md:text-9xl font-bold tracking-wider relative z-10"
            style={{
              color: "#d4a574",
              textShadow: "3px 3px 6px rgba(0,0,0,0.15)",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.2em"
            }}
          >
            ZR
          </h1>
          <p 
            className="text-3xl md:text-4xl mt-4 tracking-widest"
            style={{
              color: "#d4a574",
              textShadow: "2px 2px 4px rgba(0,0,0,0.1)",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.3em"
            }}
          >
            全力エステ
          </p>
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
          </div>
        </div>
      </nav>

      {/* Main Banner Slider */}
      <div className="container mx-auto px-4 py-8">
        <div className="relative overflow-hidden rounded-lg shadow-2xl">
          <AspectRatio ratio={16 / 9}>
            <img
              src={slides[currentSlide]}
              alt="Banner"
              className="w-full h-full object-contain transition-opacity duration-500"
            />
          </AspectRatio>

          {/* Slider Controls */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full transition-all shadow-lg"
          >
            <ChevronLeft className="w-6 h-6 text-[#8b7355]" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-3 rounded-full transition-all shadow-lg"
          >
            <ChevronRight className="w-6 h-6 text-[#8b7355]" />
          </button>

          {/* Slider Indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`transition-all ${
                  currentSlide === index 
                    ? "bg-[#d4a574] w-10 h-3" 
                    : "bg-white/70 hover:bg-white w-3 h-3"
                } rounded-full`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Concept Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 
              className="text-4xl font-bold mb-3"
              style={{ 
                color: "#8b7355",
                fontFamily: "'Noto Serif JP', serif",
                letterSpacing: "0.15em"
              }}
            >
              CONCEPT
            </h2>
            <p className="text-lg text-[#a89586]" style={{ letterSpacing: "0.2em" }}>コンセプト</p>
          </div>
          
          <Card className="bg-gradient-to-br from-[#f5e8e4] to-white border-[#e5d5cc] shadow-xl">
            <CardContent className="p-12">
              <div className="space-y-6 text-center">
                <p 
                  className="text-2xl leading-relaxed"
                  style={{ 
                    color: "#6b5d4f",
                    fontFamily: "'Noto Serif JP', serif",
                    letterSpacing: "0.05em"
                  }}
                >
                  素直で愛嬌があり不器用でも全力心でサービス
                </p>
                
                <div className="pt-8 space-y-4 text-lg" style={{ color: "#8b7355" }}>
                  <p>選び抜かれたビジュアル</p>
                  <p>洗練された施術</p>
                  <p>妥協のない接客</p>
                </div>
                
                <div className="pt-8 space-y-4 text-base leading-relaxed" style={{ color: "#6b5d4f" }}>
                  <p className="font-semibold text-xl" style={{ color: "#d4a574" }}>"全力エステ"は</p>
                  <p>仙台のメンズエステ界における</p>
                  <p className="font-bold text-xl">「頂点」を本気で狙う</p>
                  <p>ハイレベルサロンです。</p>
                  
                  <div className="pt-6">
                    <p>ただ癒すだけじゃない。</p>
                    <p className="pt-2">あなたの五感すべてを圧倒する</p>
                    <p className="font-bold text-2xl pt-2" style={{ color: "#d4a574" }}>「全力の一撃」</p>
                    <p className="pt-2">をご堪能ください。</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-16 px-4" style={{ backgroundColor: "#f5e8e4" }}>
        <div className="container max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/public/schedule">
              <Card className="hover:shadow-2xl transition-all cursor-pointer h-full bg-white border-[#e5d5cc] hover:scale-105 transform">
                <CardContent className="p-10 text-center">
                  <div 
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center text-3xl shadow-lg"
                    style={{ background: "linear-gradient(135deg, #d4a574 0%, #c5956f 100%)" }}
                  >
                    📅
                  </div>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: "#8b7355" }}>SCHEDULE</h3>
                  <p className="text-sm" style={{ color: "#a89586" }}>出勤情報</p>
                  <p className="text-xs mt-3 text-muted-foreground">本日の出勤スケジュール</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/public/casts">
              <Card className="hover:shadow-2xl transition-all cursor-pointer h-full bg-white border-[#e5d5cc] hover:scale-105 transform">
                <CardContent className="p-10 text-center">
                  <div 
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center text-3xl shadow-lg"
                    style={{ background: "linear-gradient(135deg, #d4a574 0%, #c5956f 100%)" }}
                  >
                    👥
                  </div>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: "#8b7355" }}>THERAPIST</h3>
                  <p className="text-sm" style={{ color: "#a89586" }}>セラピスト</p>
                  <p className="text-xs mt-3 text-muted-foreground">在籍セラピスト紹介</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 bg-white">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 
            className="text-4xl font-bold mb-8"
            style={{ 
              color: "#8b7355",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em"
            }}
          >
            ご予約・お問い合わせ
          </h2>
          <p className="text-lg" style={{ color: "#a89586" }}>営業時間: 12:00〜26:00（24:40最終受付）</p>
        </div>
      </section>

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

export default Home;
