import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, DollarSign, Receipt, Plane } from "lucide-react";
import { toast } from "sonner";

interface Cast {
  id: string;
  name: string;
  photo: string | null;
}

export default function TherapistPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [cast, setCast] = useState<Cast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    const fetchCastByToken = async () => {
      try {
        const { data, error } = await supabase
          .from("casts")
          .select("id, name, photo")
          .eq("access_token", token)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          toast.error("無効なアクセスリンクです");
          navigate("/");
          return;
        }

        setCast(data);
      } catch (error) {
        console.error("Error fetching cast:", error);
        toast.error("データの取得に失敗しました");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchCastByToken();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cast) {
    return null;
  }

  const menuItems = [
    {
      title: "精算はこちら",
      description: "今月の売上と精算情報を確認",
      icon: DollarSign,
      href: "#settlement",
    },
    {
      title: "バック表",
      description: "コース別・オプション別のバック率を確認",
      icon: Receipt,
      href: "#back-rates",
    },
    {
      title: "メニュー表",
      description: "料金表とサービス内容を確認",
      icon: FileText,
      href: "#menu",
    },
    {
      title: "交通費申請",
      description: "交通費の申請を行う",
      icon: Plane,
      href: "#expenses",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {cast.photo && (
              <img
                src={cast.photo}
                alt={cast.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{cast.name}様</h1>
              <p className="text-sm text-muted-foreground">セラピストポータル</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => toast.info("この機能は準備中です")}>
                    開く
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>お知らせ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              現在、お知らせはありません。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
