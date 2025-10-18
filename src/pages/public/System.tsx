import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import caskanLogo from "@/assets/caskan-logo.png";

interface PricingCourse {
  duration: number;
  standard_price: number;
  premium_price: number;
  vip_price: number;
  course_type: string;
}

interface PricingOption {
  name: string;
  price: number;
  description: string | null;
}

const System = () => {
  const [courses, setCourses] = useState<PricingCourse[]>([]);
  const [options, setOptions] = useState<PricingOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const { data: coursesData, error: coursesError } = await supabase
        .from('pricing')
        .select('*')
        .order('duration', { ascending: true });

      if (coursesError) throw coursesError;

      const { data: optionsData, error: optionsError } = await supabase
        .from('pricing_options')
        .select('*')
        .order('created_at', { ascending: true });

      if (optionsError) throw optionsError;

      setCourses(coursesData || []);
      setOptions(optionsData || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5e8e4" }}>
      {/* Top Contact Bar */}
      <div className="bg-[#d4b5a8] text-white py-2 px-4 flex justify-between items-center text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white py-6">
        <div className="container mx-auto text-center">
          <Link to="/public">
            <img src={caskanLogo} alt="全力エステ" className="h-16 mx-auto" />
          </Link>
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Page Title */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <h1 
              className="text-3xl font-bold mb-2"
              style={{ 
                color: "#8b7355",
                fontFamily: "'Noto Serif JP', serif",
                letterSpacing: "0.2em"
              }}
            >
              SYSTEM
            </h1>
            <p className="text-sm" style={{ color: "#a89586", letterSpacing: "0.1em" }}>料金システム</p>
          </div>

          {/* Logo/Brand */}
          <div className="text-center mb-12">
            <h2 
              className="text-5xl font-bold mb-2"
              style={{ 
                color: "#c9a876",
                fontFamily: "'Noto Serif JP', serif",
                letterSpacing: "0.1em"
              }}
            >
              全力エステ
            </h2>
          </div>

          {/* Aroma Oil Course */}
          <div className="mb-10">
            <div className="bg-[#c9a876] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>アロマオイルコース</h3>
            </div>
            <div className="space-y-2">
              {courses.filter(c => c.course_type === 'アロマオイル').map((course, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <span className="text-gray-700 text-sm">{course.duration}min</span>
                  <span className="text-gray-700 font-bold text-sm">¥{course.standard_price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Zenryoku Course */}
          <div className="mb-10">
            <div className="bg-[#c9a876] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>全力コース</h3>
            </div>
            <div className="space-y-2">
              {courses.filter(c => c.course_type === '全力').map((course, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <span className="text-gray-700 text-sm">{course.duration}min</span>
                  <span className="text-gray-700 font-bold text-sm">¥{course.standard_price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="mb-10">
            <div className="bg-[#c9a876] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>オプションメニュー</h3>
            </div>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 text-sm">{option.name}</span>
                    {option.description && (
                      <span className="text-xs text-gray-500">({option.description})</span>
                    )}
                  </div>
                  <span className="text-gray-700 font-bold text-sm">¥{option.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="mb-10">
            <div className="bg-[#c9a876] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>お支払い</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700 text-sm">現金</span>
                <span className="text-gray-700 text-sm">◯</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700 text-sm">クレジット</span>
                <span className="text-gray-700 text-sm">◯</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                <span className="text-gray-700 text-sm">電子マネー</span>
                <span className="text-gray-700 text-sm">◯</span>
              </div>
            </div>
          </div>

          {/* Flow Section */}
          <div className="mb-12">
            <div className="bg-white border-2 border-[#c9a876] rounded-lg p-6">
              <h3 
                className="text-2xl font-bold text-center mb-6"
                style={{ 
                  color: "#8b7355",
                  fontFamily: "'Noto Serif JP', serif",
                  letterSpacing: "0.2em"
                }}
              >
                FLOW
              </h3>
              <p className="text-sm text-center mb-6" style={{ color: "#a89586", letterSpacing: "0.1em" }}>ご利用の流れ</p>
              
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <p className="font-bold mb-1">お電話にて</p>
                  <p>・コース・指名をお伝えください</p>
                  <p>・ご希望のお時間をお伝えください</p>
                  <p>・ご利用場所をお伝えください</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notice Section */}
          <div className="mb-12">
            <div className="bg-white border-2 border-[#c9a876] rounded-lg p-6">
              <h3 
                className="text-2xl font-bold text-center mb-6"
                style={{ 
                  color: "#8b7355",
                  fontFamily: "'Noto Serif JP', serif",
                  letterSpacing: "0.2em"
                }}
              >
                NOTICE
              </h3>
              <p className="text-sm text-center mb-6" style={{ color: "#a89586", letterSpacing: "0.1em" }}>ご注意事項</p>
              
              <div className="space-y-3 text-sm text-gray-700">
                <p>・全てのコースに消費税が含まれております</p>
                <p>・表示価格は全て税込み価格となります</p>
                <p>・ご予約のキャンセルは前日まで無料、当日は50%、無断キャンセルは100%のキャンセル料が発生いたします</p>
                <p>・セラピストの指名は無料です</p>
                <p>・延長は10分単位で承っております</p>
                <p>・お支払いは現金、クレジットカード、電子マネーをご利用いただけます</p>
                <p>・風俗店ではございません</p>
                <p>・18歳未満の方のご利用はお断りしております</p>
                <p>・泥酔状態でのご利用はお断りする場合がございます</p>
                <p>・セラピストへの迷惑行為は固くお断りいたします</p>
              </div>
            </div>
          </div>

          {/* Shop Section */}
          <div className="mb-8">
            <div className="bg-white border-2 border-[#c9a876] rounded-lg p-6">
              <h3 
                className="text-2xl font-bold text-center mb-6"
                style={{ 
                  color: "#8b7355",
                  fontFamily: "'Noto Serif JP', serif",
                  letterSpacing: "0.2em"
                }}
              >
                SHOP
              </h3>
              <p className="text-sm text-center mb-6" style={{ color: "#a89586", letterSpacing: "0.1em" }}>店舗情報</p>
              
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-bold">店舗名</span>
                  <span>全力エステ</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-bold">営業時間</span>
                  <span>12:00～26:00（24:40最終受付）</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-bold">定休日</span>
                  <span>年中無休</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-bold">エリア</span>
                  <span>出張専門</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2 min-w-[200px] bg-[#c9a876] hover:bg-[#b89766]">
              <Phone size={20} />
              電話で予約
            </Button>
            <Link to="/public/casts">
              <Button size="lg" variant="outline" className="gap-2 min-w-[200px] border-[#c9a876] text-[#8b7355] hover:bg-[#f5e8e4]">
                <Calendar size={20} />
                キャスト一覧
              </Button>
            </Link>
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
