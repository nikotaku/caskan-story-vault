import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    {
      image: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&q=80",
      title: "全力エステ ZR"
    },
    {
      image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
      title: "癒しのひととき"
    }
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
    <div className="min-h-screen" style={{ backgroundColor: "#E8D5D0" }}>
      {/* Top Info Bar */}
      <div className="bg-[#C5A896] text-white py-2 px-4 text-center text-sm">
        <span>12:00〜26:00(24:40最終受付) </span>
        <a href="tel:080-3192-1209" className="ml-4 hover:underline font-semibold">
          080-3192-1209
        </a>
      </div>

      {/* Large Logo Section */}
      <div className="py-12 text-center relative">
        <div className="relative inline-block">
          <h1 
            className="text-7xl md:text-8xl font-bold tracking-wider"
            style={{
              color: "#D4AF37",
              textShadow: "2px 2px 4px rgba(0,0,0,0.1), 0 0 40px rgba(212, 175, 55, 0.3)",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.15em"
            }}
          >
            ZR
          </h1>
          <p 
            className="text-2xl md:text-3xl mt-2 tracking-widest"
            style={{
              color: "#D4AF37",
              textShadow: "1px 1px 2px rgba(0,0,0,0.1)",
              fontFamily: "'Noto Serif JP', serif"
            }}
          >
            全力エステ
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-y border-[#C5A896]/30 sticky top-0 z-50">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap gap-1 py-3">
            <Link to="/public" className="nav-item px-6 py-2 text-sm font-medium hover:bg-[#C5A896]/20 transition-colors rounded">
              <div className="text-[#8B6F47]">TOP</div>
              <div className="text-xs text-muted-foreground">トップ</div>
            </Link>
            <Link to="/public/system" className="nav-item px-6 py-2 text-sm font-medium hover:bg-[#C5A896]/20 transition-colors rounded">
              <div className="text-[#8B6F47]">SYSTEM</div>
              <div className="text-xs text-muted-foreground">料金システム</div>
            </Link>
            <Link to="/public/schedule" className="nav-item px-6 py-2 text-sm font-medium hover:bg-[#C5A896]/20 transition-colors rounded">
              <div className="text-[#8B6F47]">SCHEDULE</div>
              <div className="text-xs text-muted-foreground">出勤情報</div>
            </Link>
            <Link to="/public/casts" className="nav-item px-6 py-2 text-sm font-medium hover:bg-[#C5A896]/20 transition-colors rounded">
              <div className="text-[#8B6F47]">THERAPIST</div>
              <div className="text-xs text-muted-foreground">セラピスト</div>
            </Link>
            <Link to="/public/pricing" className="nav-item px-6 py-2 text-sm font-medium hover:bg-[#C5A896]/20 transition-colors rounded">
              <div className="text-[#8B6F47]">PRICE</div>
              <div className="text-xs text-muted-foreground">料金表</div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Visual Slider */}
      <div className="container mx-auto px-4 py-8">
        <div className="relative overflow-hidden rounded-lg" style={{ maxHeight: "500px" }}>
          <div className="grid md:grid-cols-2 gap-0 bg-white/50 backdrop-blur-sm">
            {/* Left Side - Image */}
            <div className="relative h-[400px] md:h-[500px] overflow-hidden">
              <img
                src={slides[currentSlide].image}
                alt={slides[currentSlide].title}
                className="w-full h-full object-cover transition-all duration-500"
              />
            </div>
            
            {/* Right Side - Logo and Ambiance */}
            <div className="relative h-[400px] md:h-[500px] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80"
                alt="Spa ambiance"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="text-center">
                  <h2 
                    className="text-6xl font-bold mb-4"
                    style={{
                      color: "#D4AF37",
                      textShadow: "2px 2px 8px rgba(0,0,0,0.5)",
                      fontFamily: "'Noto Serif JP', serif",
                      letterSpacing: "0.1em"
                    }}
                  >
                    ZR
                  </h2>
                  <p 
                    className="text-xl"
                    style={{
                      color: "#D4AF37",
                      textShadow: "1px 1px 4px rgba(0,0,0,0.5)",
                      fontFamily: "'Noto Serif JP', serif"
                    }}
                  >
                    全力エステ
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Slider Controls */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-[#8B6F47]" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full transition-all"
          >
            <ChevronRight className="w-6 h-6 text-[#8B6F47]" />
          </button>

          {/* Slider Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  currentSlide === index ? "bg-[#D4AF37] w-8" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Concept Section */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#8B6F47] mb-2" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              CONCEPT
            </h2>
            <p className="text-sm text-[#8B6F47]/70">コンセプト</p>
          </div>
          <Card className="bg-white/70 backdrop-blur-sm border-[#C5A896]/30">
            <CardContent className="p-8">
              <p className="text-lg text-center leading-relaxed text-[#5D4E37]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                素直で愛嬌があり不器用でも全力心でサービス
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Access Section */}
      <section className="py-16 px-4 bg-white/30">
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/public/schedule">
              <Card className="hover:shadow-xl transition-all cursor-pointer h-full bg-white/80 backdrop-blur-sm border-[#C5A896]/30 hover:border-[#D4AF37]/50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#C5A896] flex items-center justify-center">
                    <span className="text-2xl text-white">📅</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-[#8B6F47]">SCHEDULE</h3>
                  <p className="text-sm text-[#8B6F47]/70">出勤情報</p>
                  <p className="text-xs mt-2 text-muted-foreground">本日の出勤スケジュール</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/public/casts">
              <Card className="hover:shadow-xl transition-all cursor-pointer h-full bg-white/80 backdrop-blur-sm border-[#C5A896]/30 hover:border-[#D4AF37]/50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#C5A896] flex items-center justify-center">
                    <span className="text-2xl text-white">👥</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-[#8B6F47]">THERAPIST</h3>
                  <p className="text-sm text-[#8B6F47]/70">セラピスト</p>
                  <p className="text-xs mt-2 text-muted-foreground">在籍セラピスト紹介</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/public/pricing">
              <Card className="hover:shadow-xl transition-all cursor-pointer h-full bg-white/80 backdrop-blur-sm border-[#C5A896]/30 hover:border-[#D4AF37]/50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#C5A896] flex items-center justify-center">
                    <span className="text-2xl text-white">💰</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-[#8B6F47]">PRICE</h3>
                  <p className="text-sm text-[#8B6F47]/70">料金表</p>
                  <p className="text-xs mt-2 text-muted-foreground">コース・料金案内</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-[#8B6F47]" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            ご予約・お問い合わせ
          </h2>
          <p className="mb-8 text-[#8B6F47]/80">お気軽にお電話ください</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              asChild
              className="min-w-[250px] text-lg py-6"
              style={{
                background: "linear-gradient(135deg, #D4AF37 0%, #C5A896 100%)",
                color: "white"
              }}
            >
              <a href="tel:080-3192-1209">
                📞 080-3192-1209
              </a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-[#8B6F47]/60">営業時間: 12:00〜26:00（24:40最終受付）</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-[#C5A896] text-white">
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4 text-lg">営業時間</h4>
              <p className="text-white/90">12:00〜26:00</p>
              <p className="text-sm text-white/70">(24:40最終受付)</p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-lg">お問い合わせ</h4>
              <p>
                <a href="tel:080-3192-1209" className="hover:text-[#D4AF37] transition-colors text-white/90">
                  TEL: 080-3192-1209
                </a>
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-lg">メニュー</h4>
              <div className="flex flex-col gap-2 text-sm">
                <Link to="/public/casts" className="text-white/80 hover:text-[#D4AF37] transition-colors">
                  セラピスト
                </Link>
                <Link to="/public/schedule" className="text-white/80 hover:text-[#D4AF37] transition-colors">
                  出勤情報
                </Link>
                <Link to="/public/pricing" className="text-white/80 hover:text-[#D4AF37] transition-colors">
                  料金表
                </Link>
                <Link to="/public/system" className="text-white/80 hover:text-[#D4AF37] transition-colors">
                  システム
                </Link>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-white/70 pt-8 border-t border-white/20">
            © 2025 全力エステ ZR. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
