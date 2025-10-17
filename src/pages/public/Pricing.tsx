import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Calendar, CreditCard, Clock, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface PricingCourse {
  duration: number;
  standard_price: number;
  premium_price: number;
  vip_price: number;
}

interface PricingOption {
  name: string;
  price: number;
  description: string | null;
}

export default function Pricing() {
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
            <Link to="/public/system" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
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
      <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 
            className="text-4xl font-bold mb-4"
            style={{ 
              color: "#8b7355",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em"
            }}
          >
            PRICING - 料金表
          </h1>
          <p className="text-lg" style={{ color: "#a89586" }}>明瞭会計でご安心いただけます</p>
        </div>

        {/* Rank Description */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="text-primary" />
              ランクについて
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-border">
                <Badge variant="secondary" className="mb-2">スタンダード</Badge>
                <p className="text-sm text-muted-foreground">
                  リーズナブルな価格で高品質なサービスをご提供します
                </p>
              </div>
              <div className="p-4 rounded-lg border border-primary/50 bg-primary/5">
                <Badge className="mb-2">プレミアム</Badge>
                <p className="text-sm text-muted-foreground">
                  経験豊富なキャストによる上質なひとときをお楽しみください
                </p>
              </div>
              <div className="p-4 rounded-lg border border-primary bg-primary/10">
                <Badge variant="default" className="mb-2">VIP</Badge>
                <p className="text-sm text-muted-foreground">
                  最高級のおもてなしで特別な時間を演出いたします
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Base Pricing Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>基本料金</CardTitle>
            <CardDescription>コース時間とランクによる料金表</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4">コース時間</th>
                    <th className="text-right py-3 px-4">スタンダード</th>
                    <th className="text-right py-3 px-4">プレミアム</th>
                    <th className="text-right py-3 px-4">VIP</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course, index) => (
                    <tr key={index} className="border-b border-border hover:bg-muted/50">
                      <td className="py-4 px-4 font-medium">{course.duration}分</td>
                      <td className="py-4 px-4 text-right">¥{course.standard_price.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right">¥{course.premium_price.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right">¥{course.vip_price.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="text-primary" />
                オプション料金
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <span className="font-medium">{option.name}</span>
                      {option.description && (
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      )}
                    </div>
                    <span className="text-primary font-bold">¥{option.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="text-primary" />
                お支払い方法
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <div>
                  <p className="font-medium">現金</p>
                  <p className="text-sm text-muted-foreground">料金後払い制</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <div>
                  <p className="font-medium">クレジットカード</p>
                  <p className="text-sm text-muted-foreground">VISA・Master・JCB・AMEX</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <div>
                  <p className="font-medium">電子マネー</p>
                  <p className="text-sm text-muted-foreground">各種対応可能</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">ご注意事項</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 表示価格はすべて税込みです</p>
            <p>• 延長料金はランクにより異なります</p>
            <p>• キャンセル料は前日50%、当日100%となります</p>
            <p>• 交通費は別途発生する場合がございます（エリアにより異なります）</p>
            <p>• 詳細はお電話にてお問い合わせください</p>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">ご予約・お問い合わせ</h2>
            <p className="text-muted-foreground">お気軽にお電話ください</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="gap-2 min-w-[200px]">
              <Phone size={20} />
              電話で予約
            </Button>
            <Link to="/public/casts">
              <Button size="lg" variant="outline" className="gap-2 min-w-[200px]">
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
}