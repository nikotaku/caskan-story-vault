import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      
      // Group shifts by cast_id to avoid duplicate displays
      const groupedShifts = (shiftsResult.data || []).reduce((acc, shift) => {
        if (!acc[shift.cast_id]) {
          acc[shift.cast_id] = shift;
        }
        return acc;
      }, {} as Record<string, Shift>);
      
      setShifts(Object.values(groupedShifts));
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
    navigate(`/booking?castId=${castId}&date=${dateStr}&time=${time}`);
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
      <div className="bg-[#d4b5a8] text-white py-2 px-4 text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white py-6 border-b border-[#e5d5cc]">
        <div className="container mx-auto text-center">
          <Link to="/">
            <img src={caskanLogo} alt="全力エステ" className="h-20 md:h-24 mx-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
          </Link>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-white border-b border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/" className="px-6 py-3 text-[#8b7355] hover:bg-[#f5e8e4] transition-colors text-sm">
              店舗トップ
            </Link>
            <Link to="/system" className="px-6 py-3 text-[#8b7355] hover:bg-[#f5e8e4] transition-colors text-sm">
              料金システム
            </Link>
            <Link to="/casts" className="px-6 py-3 text-[#8b7355] hover:bg-[#f5e8e4] transition-colors text-sm">
              セラピスト
            </Link>
            <Link to="/schedule" className="px-6 py-3 text-[#8b7355] bg-[#f5e8e4] transition-colors text-sm border-b-2 border-[#d4a574]">
              出勤表
            </Link>
            <Link to="/access" className="px-6 py-3 text-[#8b7355] hover:bg-[#f5e8e4] transition-colors text-sm">
              アクセス
            </Link>
            <Link to="/booking" className="px-6 py-3 text-[#8b7355] hover:bg-[#f5e8e4] transition-colors text-sm">
              WEB予約
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative py-16 bg-gradient-to-br from-[#f5e8e4] to-[#e5d5cc]">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-widest" style={{ color: "#8b7355" }}>
            SCHEDULE
          </h1>
          <p className="text-xl" style={{ color: "#a89586" }}>出勤日</p>
        </div>
      </div>

      <main className="container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* View Toggle */}
          <div className="flex justify-center gap-4 mb-8">
            <Button 
              className="bg-[#d4a574] hover:bg-[#c5966a] text-white font-semibold px-8 py-3"
            >
              日付で見る
            </Button>
            <Button 
              variant="outline" 
              className="border-[#d4a574] text-[#8b7355] hover:bg-[#f5e8e4] px-8 py-3"
            >
              セラピスト別に見る
            </Button>
          </div>

          {/* Week Navigation */}
          <div className="mb-8 bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                className="text-[#8b7355] hover:bg-[#f5e8e4]"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 7);
                  setSelectedDate(newDate);
                }}
              >
                ← 前の1週間
              </Button>
              <Button 
                variant="ghost" 
                className="text-[#8b7355] hover:bg-[#f5e8e4]"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 7);
                  setSelectedDate(newDate);
                }}
              >
                次の1週間 →
              </Button>
            </div>
            
            {/* Week Days */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date(selectedDate);
                date.setDate(date.getDate() - date.getDay() + i);
                const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`p-3 rounded-lg text-center transition-colors ${
                      isSelected 
                        ? 'bg-[#d4a574] text-white' 
                        : 'bg-[#f5e8e4] text-[#8b7355] hover:bg-[#e5d5cc]'
                    }`}
                  >
                    <div className="text-xs mb-1">
                      {format(date, "M/d", { locale: ja })}
                    </div>
                    <div className="text-sm font-semibold">
                      ({format(date, "E", { locale: ja })})
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule Info */}
          <div className="mb-6" style={{ color: "#8b7355" }}>
            <p className="text-lg">
              出勤セラピスト： <span className="font-bold" style={{ color: "#d4a574" }}>{shifts.length}人</span>
            </p>
          </div>

          {/* Shifts Grid */}
          {shifts.length === 0 ? (
            <Card className="bg-white shadow-md">
              <CardContent className="p-12 text-center">
                <p className="text-[#a89586] text-lg">
                  この日の出勤予定はありません
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shifts.map((shift) => (
                <Card 
                  key={shift.id} 
                  className="bg-white overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105"
                  style={{ borderColor: "#d4b5a8" }}
                >
                  {/* Cast Photo */}
                  <div className="relative w-full h-80 bg-gradient-to-br from-[#f5e8e4] to-[#e5d5cc]">
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
                    
                    {/* Time Badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <div className="text-white font-bold text-lg">
                        {shift.start_time.substring(0, 5)} 〜 {shift.end_time.substring(0, 5)}
                      </div>
                    </div>
                  </div>

                  {/* Cast Info */}
                  <CardContent className="p-4">
                    {/* Name */}
                    <h3 className="text-2xl font-bold mb-2 text-center" style={{ color: "#8b7355" }}>
                      {shift.casts.name}
                    </h3>

                    {/* Type Badge */}
                    <div className="text-center mb-3">
                      <Badge className="bg-[#d4a574]/20 text-[#8b7355] border-[#d4a574]/50">
                        {shift.casts.type}
                      </Badge>
                    </div>

                    {/* Room Info */}
                    {shift.room && (
                      <div className="mb-3 text-center">
                        <span className="text-[#a89586] text-sm">■ {shift.room} ■</span>
                      </div>
                    )}

                    {/* Notes */}
                    {shift.notes && (
                      <p className="text-sm text-center mb-4 text-[#a89586]">
                        {shift.notes}
                      </p>
                    )}

                    {/* Booking Status */}
                    <div className="text-center mb-3">
                      <span className="inline-block px-6 py-2 bg-green-600 text-white rounded-full text-sm font-semibold">
                        ○ ご案内可能
                      </span>
                    </div>

                    {/* View Detail Button */}
                    <Button
                      className="w-full bg-[#d4a574] hover:bg-[#c5966a] text-white font-semibold"
                      onClick={() => handleBooking(shift.cast_id, shift.casts.name, shift.start_time)}
                    >
                      詳細を見る / 予約する
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-4 text-white mt-16" style={{ background: "linear-gradient(180deg, #d4b5a8 0%, #c5a89b 100%)" }}>
        <div className="container max-w-6xl mx-auto text-center">
          <div className="mb-6">
            <p className="text-lg mb-2">営業時間: 12:00〜26:00 (24:40最終受付)</p>
            <p className="text-sm">定休日: 年中無休</p>
          </div>
          <div className="text-sm text-white/80">
            © 2025 全力エステ 仙台. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Chat Bot */}
      <ChatBot />
    </div>
  );
};

export default Schedule;
