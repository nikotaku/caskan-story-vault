import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Top Contact Bar */}
      <div className="bg-[#2a2a2a] text-white py-2 px-4 text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-[#2a2a2a] py-6 border-b border-[#3a3a3a]">
        <div className="container mx-auto text-center">
          <Link to="/">
            <img src={caskanLogo} alt="全力エステ" className="h-20 md:h-24 mx-auto object-contain brightness-0 invert" />
          </Link>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-[#2a2a2a] border-b border-[#3a3a3a] sticky top-0 z-50">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/" className="px-6 py-3 text-white/80 hover:text-white hover:bg-[#3a3a3a] transition-colors text-sm">
              店舗トップ
            </Link>
            <Link to="/system" className="px-6 py-3 text-white/80 hover:text-white hover:bg-[#3a3a3a] transition-colors text-sm">
              料金システム
            </Link>
            <Link to="/casts" className="px-6 py-3 text-white/80 hover:text-white hover:bg-[#3a3a3a] transition-colors text-sm">
              セラピスト
            </Link>
            <Link to="/schedule" className="px-6 py-3 text-yellow-500 bg-[#3a3a3a] transition-colors text-sm border-b-2 border-yellow-500">
              出勤表
            </Link>
            <Link to="/booking" className="px-6 py-3 text-white/80 hover:text-white hover:bg-[#3a3a3a] transition-colors text-sm">
              WEB予約
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative py-20 bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a]">
        <div className="container mx-auto text-center">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 tracking-widest">
            SCHEDULE
          </h1>
          <p className="text-xl text-white/70">出勤日</p>
        </div>
      </div>

      <main className="container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* View Toggle */}
          <div className="flex justify-center gap-4 mb-8">
            <Button 
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-3"
            >
              日付で見る
            </Button>
            <Button 
              variant="outline" 
              className="border-white/30 text-white hover:bg-white/10 px-8 py-3"
            >
              セラピスト別に見る
            </Button>
          </div>

          {/* Week Navigation */}
          <div className="mb-8 bg-[#2a2a2a] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-[#3a3a3a]"
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
                className="text-white hover:bg-[#3a3a3a]"
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
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-[#1a1a1a] text-white hover:bg-[#3a3a3a]'
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
          <div className="text-white mb-6">
            <p className="text-lg">
              出勤セラピスト： <span className="text-yellow-500 font-bold">{shifts.length}人</span>
            </p>
          </div>

          {/* Shifts Grid */}
          {shifts.length === 0 ? (
            <div className="bg-[#2a2a2a] rounded-lg p-12 text-center">
              <p className="text-white/70 text-lg">
                この日の出勤予定はありません
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shifts.map((shift) => (
                <div 
                  key={shift.id} 
                  className="bg-[#2a2a2a] rounded-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  {/* Cast Photo */}
                  <div className="relative w-full h-80 bg-[#1a1a1a]">
                    {shift.casts.photo ? (
                      <img
                        src={shift.casts.photo}
                        alt={shift.casts.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl text-white/30">
                          {shift.casts.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    
                    {/* Time Badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <div className="text-yellow-500 font-bold text-lg">
                        {shift.start_time.substring(0, 5)} 〜 {shift.end_time.substring(0, 5)}
                      </div>
                    </div>
                  </div>

                  {/* Cast Info */}
                  <div className="p-4">
                    {/* Name */}
                    <h3 className="text-2xl font-bold mb-2 text-white text-center">
                      {shift.casts.name}
                    </h3>

                    {/* Type Badge */}
                    <div className="text-center mb-3">
                      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
                        {shift.casts.type}
                      </Badge>
                    </div>

                    {/* Room Info */}
                    {shift.room && (
                      <div className="mb-3 text-center">
                        <span className="text-white/60 text-sm">■ {shift.room} ■</span>
                      </div>
                    )}

                    {/* Notes */}
                    {shift.notes && (
                      <p className="text-sm text-center mb-4 text-white/60">
                        {shift.notes}
                      </p>
                    )}

                    {/* Booking Status */}
                    <div className="text-center">
                      <span className="inline-block px-6 py-2 bg-green-600 text-white rounded-full text-sm font-semibold">
                        ○ ご案内可能
                      </span>
                    </div>

                    {/* View Detail Button */}
                    <Button
                      className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                      onClick={() => handleBooking(shift.cast_id, shift.casts.name, shift.start_time)}
                    >
                      詳細を見る / 予約する
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-4 bg-[#0a0a0a] text-white/60 border-t border-[#2a2a2a] mt-16">
        <div className="container max-w-6xl mx-auto text-center">
          <div className="mb-6">
            <p className="text-lg mb-2">営業時間: 12:00〜26:00 (24:40最終受付)</p>
            <p className="text-sm">定休日: 年中無休</p>
          </div>
          <div className="text-sm">
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
