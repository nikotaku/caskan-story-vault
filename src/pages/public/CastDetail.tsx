import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Calendar, ArrowLeft, Phone } from "lucide-react";
import caskanLogo from "@/assets/caskan-logo.png";

interface Cast {
  id: string;
  name: string;
  type: string;
  status: string;
  photo: string | null;
  photos: string[] | null;
  profile: string | null;
  room: string | null;
  x_account: string | null;
  execution_date_start: string | null;
  execution_date_end: string | null;
}

const CastDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cast, setCast] = useState<Cast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCastDetail();
    }
  }, [id]);

  const fetchCastDetail = async () => {
    try {
      const { data, error } = await supabase
        .from("casts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setCast(data);
    } catch (error) {
      console.error("Error fetching cast detail:", error);
      navigate("/public/casts");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "working":
        return "bg-green-500";
      case "waiting":
        return "bg-yellow-500";
      case "offline":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "working":
        return "接客中";
      case "waiting":
        return "待機中";
      case "offline":
        return "退勤";
      default:
        return status;
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

  if (!cast) {
    return null;
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
            <Link to="/public/casts" className="px-8 py-4 bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
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

      <main className="container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/public/casts")}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            セラピスト一覧に戻る
          </Button>

          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Photo */}
              <div className="relative">
                {cast.photo ? (
                  <img
                    src={cast.photo}
                    alt={cast.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full min-h-[400px] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <span className="text-6xl text-muted-foreground">
                      {cast.name.charAt(0)}
                    </span>
                  </div>
                )}
                <Badge
                  className={`absolute top-4 right-4 ${getStatusColor(cast.status)} text-white text-lg px-4 py-2`}
                >
                  {getStatusText(cast.status)}
                </Badge>
              </div>

              {/* Info */}
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <h1 className="text-3xl font-bold">{cast.name}</h1>
                      <Badge variant="outline" className="text-base">
                        {cast.room || cast.type}
                      </Badge>
                    </div>
                  </div>

                  {(cast.execution_date_start || cast.execution_date_end) && (
                    <div>
                      <h3 className="font-bold mb-2">実行期間</h3>
                      <p className="text-muted-foreground">
                        {cast.execution_date_start && new Date(cast.execution_date_start).toLocaleDateString('ja-JP')}
                        {cast.execution_date_end && ` → ${new Date(cast.execution_date_end).toLocaleDateString('ja-JP')}`}
                      </p>
                    </div>
                  )}

                  {cast.x_account && (
                    <div>
                      <h3 className="font-bold mb-2">Xアカウント</h3>
                      <a 
                        href={cast.x_account} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {cast.x_account}
                      </a>
                    </div>
                  )}

                  {cast.profile && (
                    <div>
                      <h3 className="font-bold mb-2">プロフィール</h3>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {cast.profile}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 pt-4">
                    <Button asChild className="w-full" size="lg">
                      <a href="tel:080-3192-1209">
                        <Phone className="mr-2 h-5 w-5" />
                        電話で予約する
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="w-full" size="lg">
                      <Link to="/public/schedule">
                        <Calendar className="mr-2 h-5 w-5" />
                        スケジュールを見る
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
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

export default CastDetail;
