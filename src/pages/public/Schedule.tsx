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
  room: string | null;
  notes: string | null;
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
    document.title = "全力エステ - スケジュール";
  }, []);

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
          <Link to="/">
            <img src={caskanLogo} alt="全力エステ" className="h-24 md:h-32 mx-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
          </Link>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-white border-y border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">TOP</div>
              <div className="text-xs text-[#a89586]">トップ</div>
            </Link>
            <Link to="/schedule" className="px-8 py-4 bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SCHEDULE</div>
              <div className="text-xs text-[#a89586]">出勤情報</div>
            </Link>
            <Link to="/casts" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">THERAPIST</div>
              <div className="text-xs text-[#a89586]">セラピスト</div>
            </Link>
            <Link to="/system" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SYSTEM</div>
              <div className="text-xs text-[#a89586]">システム</div>
            </Link>
            <Link to="/booking" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
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

          {/* Calendar Section */}
          <div className="mb-8">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-center">日付を選択</CardTitle>
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
          </div>

          {/* Schedule Title */}
          <h2 className="text-2xl font-bold text-center mb-6" style={{ color: "#8b7355" }}>
            {format(selectedDate, "M月d日（E）", { locale: ja })} の出勤情報
          </h2>

          {/* Shifts Grid */}
          {shifts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  この日の出勤予定はありません
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shifts.map((shift) => (
                <Card 
                  key={shift.id} 
                  className="overflow-hidden hover:shadow-lg transition-shadow duration-300"
                  style={{ borderColor: "#d4b5a8" }}
                >
                  {/* Cast Photo */}
                  <div className="relative w-full h-64 bg-gradient-to-br from-[#f5e8e4] to-[#e5d5cc]">
                    {shift.casts.photo ? (
                      <img
                        src={shift.casts.photo}
                        alt={shift.casts.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl text-[#d4b5a8]">
                          {shift.casts.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <Badge 
                        variant="secondary" 
                        className="bg-white/90 text-[#8b7355] border-[#d4b5a8]"
                      >
                        {shift.casts.type}
                      </Badge>
                    </div>
                  </div>

                  {/* Cast Info */}
                  <CardContent className="p-6">
                    {/* Name */}
                    <h3 className="text-2xl font-bold mb-3 text-center" style={{ color: "#8b7355" }}>
                      {shift.casts.name}
                    </h3>

                    {/* Working Hours */}
                    <div className="mb-4 text-center">
                      <div className="text-sm text-muted-foreground mb-1">出勤時間</div>
                      <div className="text-lg font-semibold" style={{ color: "#d4a574" }}>
                        {shift.start_time.substring(0, 5)} 〜 {shift.end_time.substring(0, 5)}
                      </div>
                    </div>

                    {/* Room Info */}
                    {shift.room && (
                      <div className="mb-4 text-center">
                        <div 
                          className="inline-block px-4 py-2 rounded-md text-sm font-medium"
                          style={{ backgroundColor: "#f5e8e4", color: "#8b7355" }}
                        >
                          ■ {shift.room} ■
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {shift.notes && (
                      <p className="text-sm text-center mb-4 text-muted-foreground">
                        {shift.notes}
                      </p>
                    )}

                    {/* Booking Button */}
                    <Button
                      className="w-full"
                      style={{ 
                        backgroundColor: "#d4a574",
                        color: "white"
                      }}
                      onClick={() => handleBooking(shift.cast_id, shift.casts.name, shift.start_time)}
                    >
                      予約する
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
                <Link to="/casts" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  セラピスト
                </Link>
                <Link to="/schedule" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  出勤情報
                </Link>
                <Link to="/system" className="text-white/85 hover:text-[#d4a574] transition-colors">
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
