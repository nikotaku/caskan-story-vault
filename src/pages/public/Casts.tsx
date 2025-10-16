import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Search } from "lucide-react";

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
}

const Casts = () => {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchCasts();

    const channel = supabase
      .channel('public-casts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'casts'
        },
        () => {
          fetchCasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from("casts")
        .select("*")
        .order("rating", { ascending: false });

      if (error) throw error;
      setCasts(data || []);
    } catch (error) {
      console.error("Error fetching casts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCasts = casts.filter((cast) => {
    const matchesSearch = cast.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || cast.type === typeFilter;
    const matchesStatus = statusFilter === "all" || cast.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

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
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">THERAPIST - セラピスト</h1>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="名前で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="タイプで絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのタイプ</SelectItem>
                  <SelectItem value="premium">プレミアム</SelectItem>
                  <SelectItem value="standard">スタンダード</SelectItem>
                  <SelectItem value="新人">新人</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="ステータスで絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのステータス</SelectItem>
                  <SelectItem value="waiting">待機中</SelectItem>
                  <SelectItem value="working">接客中</SelectItem>
                  <SelectItem value="offline">退勤</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Casts Grid */}
          {filteredCasts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">該当するセラピストが見つかりませんでした</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCasts.map((cast) => (
                <Card key={cast.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    {cast.photo ? (
                      <img
                        src={cast.photo}
                        alt={cast.name}
                        className="w-full h-64 object-cover"
                      />
                    ) : (
                      <div className="w-full h-64 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-4xl text-muted-foreground">
                          {cast.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <Badge
                      className={`absolute top-2 right-2 ${getStatusColor(cast.status)} text-white`}
                    >
                      {getStatusText(cast.status)}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold">{cast.name}</h3>
                      <Badge variant="outline">{cast.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">{cast.age}歳</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{cast.rating}</span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-primary">¥{cast.price.toLocaleString()}</p>
                    {cast.profile && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {cast.profile}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <Button asChild className="w-full">
                      <Link to={`/public/casts/${cast.id}`}>
                        詳細を見る
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
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

export default Casts;
