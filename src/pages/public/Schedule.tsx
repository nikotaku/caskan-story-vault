import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { ChatBot } from "@/components/ChatBot";

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  cast_id: string;
  casts: {
    name: string;
    photo: string | null;
    type: string;
    status: string;
  };
}

const Schedule = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchShifts();

    const channel = supabase
      .channel('public-shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts'
        },
        () => {
          fetchShifts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          *,
          casts (
            name,
            photo,
            type,
            status
          )
        `)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error("Error fetching shifts:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const todayShifts = shifts.filter(shift => shift.shift_date === selectedDateStr);

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
            <Link to="/public/pricing" className="text-sm font-medium hover:text-primary transition-colors">
              料金表
            </Link>
            <Link to="/public/system" className="text-sm font-medium hover:text-primary transition-colors">
              システム
            </Link>
            <Link to="/public/schedule" className="text-sm font-medium text-primary transition-colors">
              出勤情報
            </Link>
            <Link to="/public/casts" className="text-sm font-medium hover:text-primary transition-colors">
              セラピスト
            </Link>
            <Link to="/public/booking" className="text-sm font-medium hover:text-primary transition-colors">
              WEB予約
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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">SCHEDULE - 出勤情報</h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Calendar */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>日付を選択</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ja}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            {/* Schedule List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {format(selectedDate, "M月d日（E）", { locale: ja })} の出勤
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {todayShifts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        この日の出勤予定はありません
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {todayShifts.map((shift) => (
                        <Card key={shift.id} className="overflow-hidden">
                          <div className="flex">
                            <div className="w-24 h-24 relative flex-shrink-0">
                              {shift.casts.photo ? (
                                <img
                                  src={shift.casts.photo}
                                  alt={shift.casts.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                                  <span className="text-2xl text-muted-foreground">
                                    {shift.casts.name.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <CardContent className="flex-1 p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold">{shift.casts.name}</h3>
                                    <Badge variant="outline">{shift.casts.type}</Badge>
                                    <Badge
                                      className={`${getStatusColor(shift.casts.status)} text-white`}
                                    >
                                      {getStatusText(shift.casts.status)}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {shift.start_time.slice(0, 5)} 〜 {shift.end_time.slice(0, 5)}
                                  </p>
                                </div>
                                <Button asChild size="sm">
                                  <Link to={`/public/casts/${shift.cast_id}`}>
                                    詳細
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t mt-12">
        <div className="container max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          © 2025 全力エステ ZR. All rights reserved.
        </div>
      </footer>

      {/* Chat Bot */}
      <ChatBot />
    </div>
  );
};

export default Schedule;
