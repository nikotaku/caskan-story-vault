import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ChatBot } from "@/components/ChatBot";
import caskanLogo from "@/assets/caskan-logo.png";

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

interface Reservation {
  id: string;
  cast_id: string;
  reservation_date: string;
  start_time: string;
  duration: number;
}

const Schedule = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();

    const shiftsChannel = supabase
      .channel('public-shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const reservationsChannel = supabase
      .channel('public-reservations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shiftsChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      
      const [shiftsResult, reservationsResult] = await Promise.all([
        supabase
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
          .eq("shift_date", selectedDateStr)
          .order("start_time", { ascending: true }),
        supabase
          .from("reservations")
          .select("id, cast_id, reservation_date, start_time, duration")
          .eq("reservation_date", selectedDateStr)
      ]);

      if (shiftsResult.error) throw shiftsResult.error;
      if (reservationsResult.error) throw reservationsResult.error;
      
      setShifts(shiftsResult.data || []);
      setReservations(reservationsResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 営業時間: 12:00〜26:00（翌2:00まで）
  const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = 12 + i;
    return hour < 24 ? `${hour}:00` : `${hour - 24}:00`;
  });

  const isTimeSlotBooked = (castId: string, time: string) => {
    return reservations.some(res => {
      const resHour = parseInt(res.start_time.split(':')[0]);
      const slotHour = parseInt(time.split(':')[0]);
      const duration = res.duration / 60; // 分を時間に変換
      
      return res.cast_id === castId && 
             slotHour >= resHour && 
             slotHour < resHour + duration;
    });
  };

  const isTimeSlotInShift = (shift: Shift, time: string) => {
    const slotHour = parseInt(time.split(':')[0]);
    const startHour = parseInt(shift.start_time.split(':')[0]);
    const endHour = parseInt(shift.end_time.split(':')[0]);
    
    if (endHour < startHour) {
      return slotHour >= startHour || slotHour < endHour;
    }
    return slotHour >= startHour && slotHour < endHour;
  };

  const handleBooking = (castId: string, castName: string, time: string) => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    navigate(`/public/booking?castId=${castId}&date=${dateStr}&time=${time}`);
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
            <Link to="/public/schedule" className="px-8 py-4 bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
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

      <main className="container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 
            className="text-4xl font-bold mb-8 text-center"
            style={{ 
              color: "#8b7355",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em"
            }}
          >
            SCHEDULE - 出勤情報
          </h1>

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

            {/* Timetable */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {format(selectedDate, "M月d日（E）", { locale: ja })} の出勤タイムテーブル
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {shifts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        この日の出勤予定はありません
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border border-[#d4b5a8] bg-[#f5e8e4] p-2 text-left min-w-[120px]">
                              セラピスト
                            </th>
                            {timeSlots.map((time) => (
                              <th key={time} className="border border-[#d4b5a8] bg-[#f5e8e4] p-2 text-center min-w-[80px] text-xs">
                                {time}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {shifts.map((shift) => (
                            <tr key={shift.id}>
                              <td className="border border-[#d4b5a8] p-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-20 h-20 relative flex-shrink-0 rounded-full overflow-hidden">
                                    {shift.casts.photo ? (
                                      <img
                                        src={shift.casts.photo}
                                        alt={shift.casts.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                                        <span className="text-lg text-muted-foreground">
                                          {shift.casts.name.charAt(0)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-base">{shift.casts.name}</div>
                                    <Badge variant="outline" className="text-xs">{shift.casts.type}</Badge>
                                  </div>
                                </div>
                              </td>
                              {timeSlots.map((time) => {
                                const inShift = isTimeSlotInShift(shift, time);
                                const isBooked = isTimeSlotBooked(shift.cast_id, time);
                                
                                return (
                                  <td 
                                    key={time} 
                                    className={`border border-[#d4b5a8] p-1 text-center ${
                                      !inShift ? 'bg-gray-100' : isBooked ? 'bg-red-100' : 'bg-green-50'
                                    }`}
                                  >
                                    {inShift && !isBooked && (
                                      <Button
                                        size="sm"
                                        className="text-xs px-2 py-1 h-auto"
                                        onClick={() => handleBooking(shift.cast_id, shift.casts.name, time)}
                                      >
                                        予約
                                      </Button>
                                    )}
                                    {inShift && isBooked && (
                                      <span className="text-xs text-red-600 font-semibold">予約済</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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

      {/* Chat Bot */}
      <ChatBot />
    </div>
  );
};

export default Schedule;
