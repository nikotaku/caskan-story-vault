import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Calendar, ArrowLeft, Phone } from "lucide-react";

interface Cast {
  id: string;
  name: string;
  age: number;
  type: string;
  status: string;
  rating: number;
  photo: string | null;
  price: number;
  profile: string | null;
  measurements: string | null;
  waiting_time: string | null;
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
            <Link to="/public/system" className="text-sm font-medium hover:text-primary transition-colors">
              料金システム
            </Link>
            <Link to="/public/schedule" className="text-sm font-medium hover:text-primary transition-colors">
              出勤情報
            </Link>
            <Link to="/public/casts" className="text-sm font-medium text-primary transition-colors">
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
                        {cast.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{cast.age}歳</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{cast.rating}</span>
                      </div>
                    </div>
                  </div>

                  {cast.measurements && (
                    <div>
                      <h3 className="font-bold mb-2">スリーサイズ</h3>
                      <p className="text-muted-foreground">{cast.measurements}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold mb-2">料金</h3>
                    <p className="text-2xl font-bold text-primary">
                      ¥{cast.price.toLocaleString()}
                    </p>
                  </div>

                  {cast.waiting_time && cast.status === "waiting" && (
                    <div>
                      <h3 className="font-bold mb-2">案内可能時間</h3>
                      <p className="text-lg text-green-600 font-medium">
                        {cast.waiting_time}
                      </p>
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
      <footer className="py-8 px-4 border-t mt-12">
        <div className="container max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          © 2025 全力エステ ZR. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default CastDetail;
