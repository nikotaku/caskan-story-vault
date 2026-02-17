import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";

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

  useEffect(() => { document.title = "全力エステ - システム"; }, []);

  useEffect(() => { fetchPricing(); }, []);

  const fetchPricing = async () => {
    try {
      const [coursesRes, optionsRes] = await Promise.all([
        supabase.from('pricing').select('*').order('duration', { ascending: true }),
        supabase.from('pricing_options').select('*').order('created_at', { ascending: true }),
      ]);
      if (coursesRes.error) throw coursesRes.error;
      if (optionsRes.error) throw optionsRes.error;
      setCourses(coursesRes.data || []);
      setOptions(optionsRes.data || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "#f5e8e4" }}>
      <PublicNavigation />

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#8b7355", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>SYSTEM</h1>
            <p className="text-sm" style={{ color: "#a89586", letterSpacing: "0.1em" }}>料金システム</p>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-5xl font-bold mb-2" style={{ color: "#c9a876", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.1em" }}>全力エステ</h2>
          </div>

          {/* Aroma Oil Course */}
          <div className="mb-10">
            <div className="bg-[#c9a876] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>アロマオイルコース</h3>
            </div>
            <div className="space-y-2">
              {courses.filter(c => c.course_type === 'アロマオイル').map((course, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
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
              {courses.filter(c => c.course_type === '全力').map((course, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
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
              {options.map((opt, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 text-sm">{opt.name}</span>
                    {opt.description && <span className="text-xs text-gray-500">({opt.description})</span>}
                  </div>
                  <span className="text-gray-700 font-bold text-sm">¥{opt.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="mb-10">
            <div className="bg-[#c9a876] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>お支払い</h3>
            </div>
            <div className="space-y-2">
              {['現金', 'クレジット', '電子マネー'].map((m) => (
                <div key={m} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <span className="text-gray-700 text-sm">{m}</span>
                  <span className="text-gray-700 text-sm">◯</span>
                </div>
              ))}
            </div>
          </div>

          {/* Flow */}
          <div className="mb-12">
            <div className="bg-white border-2 border-[#c9a876] rounded-lg p-6">
              <h3 className="text-2xl font-bold text-center mb-6" style={{ color: "#8b7355", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>FLOW</h3>
              <p className="text-sm text-center mb-6" style={{ color: "#a89586" }}>ご利用の流れ</p>
              <div className="space-y-4 text-sm text-gray-700">
                <p className="font-bold mb-1">お電話にて</p>
                <p>・コース・指名をお伝えください</p>
                <p>・ご希望のお時間をお伝えください</p>
                <p>・ご利用場所をお伝えください</p>
              </div>
            </div>
          </div>

          {/* Notice */}
          <div className="mb-12">
            <div className="bg-white border-2 border-[#c9a876] rounded-lg p-6">
              <h3 className="text-2xl font-bold text-center mb-6" style={{ color: "#8b7355", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>NOTICE</h3>
              <p className="text-sm text-center mb-6" style={{ color: "#a89586" }}>ご注意事項</p>
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

          {/* Shop Info */}
          <div className="mb-8">
            <div className="bg-white border-2 border-[#c9a876] rounded-lg p-6">
              <h3 className="text-2xl font-bold text-center mb-6" style={{ color: "#8b7355", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>SHOP</h3>
              <p className="text-sm text-center mb-6" style={{ color: "#a89586" }}>店舗情報</p>
              <div className="space-y-4 text-sm text-gray-700">
                {[['店舗名', '全力エステ'], ['営業時間', '12:00～26:00（24:40最終受付）'], ['定休日', '年中無休'], ['エリア', '出張専門']].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-bold">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:07090941854">
              <Button size="lg" className="gap-2 min-w-[200px] bg-[#c9a876] hover:bg-[#b89766]">
                <Phone size={20} />電話で予約
              </Button>
            </a>
            <Link to="/casts">
              <Button size="lg" variant="outline" className="gap-2 min-w-[200px] border-[#c9a876] text-[#8b7355] hover:bg-[#f5e8e4]">
                <Calendar size={20} />キャスト一覧
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
};

export default System;
