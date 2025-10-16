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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/public" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">C</span>
              </div>
              <span className="text-xl font-bold">CASKAN</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/public" className="text-muted-foreground hover:text-foreground transition-colors">
                ホーム
              </Link>
              <Link to="/public/casts" className="text-muted-foreground hover:text-foreground transition-colors">
                キャスト一覧
              </Link>
              <Link to="/public/schedule" className="text-muted-foreground hover:text-foreground transition-colors">
                出勤スケジュール
              </Link>
              <Link to="/public/pricing" className="text-foreground font-semibold">
                料金表
              </Link>
              <Link to="/public/system" className="text-muted-foreground hover:text-foreground transition-colors">
                システム
              </Link>
            </nav>
            <Button size="sm" className="gap-2">
              <Phone size={16} />
              <span className="hidden sm:inline">電話予約</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">料金表</h1>
          <p className="text-muted-foreground text-lg">明瞭会計でご安心いただけます</p>
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
      <footer className="bg-card border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; 2024 CASKAN. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}