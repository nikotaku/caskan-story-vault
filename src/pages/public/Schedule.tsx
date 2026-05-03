import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ChatBot } from "@/components/ChatBot";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { SectionHeading } from "@/components/public/SectionHeading";

// Shift and Reservation interfaces
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

interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
}

const Schedule = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    document.title = "全力エステ - スケジュール";
  }, []);

  useEffect(() => {
    fetchData();

    const shiftsChannel = supabase
      .channel('public-shifts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => fetchData())
      .subscribe();

    const reservationsChannel = supabase
      .channel('public-reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
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
        supabase.from("shifts").select(`*, casts (name, photo, type, status)`).eq("shift_date", selectedDateStr).order("start_time", { ascending: true }),
        supabase.rpc("get_reservation_slots", { p_date: selectedDateStr, p_cast_id: null }),
      ]);
      if (shiftsResult.error) throw shiftsResult.error;
      if (reservationsResult.error) throw reservationsResult.error;
      const groupedShifts = (shiftsResult.data || []).reduce((acc, shift) => {
        if (!acc[shift.cast_id]) acc[shift.cast_id] = shift;
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
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "#f5e8e4" }}>
      <PublicNavigation />

      {/* Hero Section */}
      <div className="relative py-16 bg-gradient-to-br from-[#f5e8e4] to-[#e5d5cc]">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-widest" style={{ color: "#8b7355" }}>SCHEDULE</h1>
          <p className="text-xl" style={{ color: "#a89586" }}>出勤日</p>
        </div>
      </div>

      <main className="container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* View Toggle */}
          <div className="flex justify-center gap-4 mb-8">
            <Button className="bg-[#d4a574] hover:bg-[#c5966a] text-white font-semibold px-8 py-3">日付で見る</Button>
            <Button variant="outline" className="border-[#d4a574] text-[#8b7355] hover:bg-[#f5e8e4] px-8 py-3">セラピスト別に見る</Button>
          </div>

          {/* Week Navigation */}
          <div className="mb-8 bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" className="text-[#8b7355] hover:bg-[#f5e8e4]" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); }}>← 前の1週間</Button>
              <Button variant="ghost" className="text-[#8b7355] hover:bg-[#f5e8e4]" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); }}>次の1週間 →</Button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date(selectedDate);
                date.setDate(date.getDate() - date.getDay() + i);
                const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                return (
                  <button key={i} onClick={() => setSelectedDate(date)} className={`p-3 rounded-lg text-center transition-colors ${isSelected ? 'bg-[#d4a574] text-white' : 'bg-[#f5e8e4] text-[#8b7355] hover:bg-[#e5d5cc]'}`}>
                    <div className="text-xs mb-1">{format(date, "M/d", { locale: ja })}</div>
                    <div className="text-sm font-semibold">({format(date, "E", { locale: ja })})</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6" style={{ color: "#8b7355" }}>
            <p className="text-lg">出勤セラピスト： <span className="font-bold" style={{ color: "#d4a574" }}>{shifts.length}人</span></p>
          </div>

          {shifts.length === 0 ? (
            <Card className="bg-white shadow-md">
              <CardContent className="p-12 text-center">
                <p className="text-[#a89586] text-lg">この日の出勤予定はありません</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shifts.map((shift) => (
                <Card key={shift.id} className="bg-white overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105" style={{ borderColor: "#d4b5a8" }}>
                  <div className="relative w-full h-80 bg-gradient-to-br from-[#f5e8e4] to-[#e5d5cc]">
                    {shift.casts.photo ? (
                      <img src={shift.casts.photo} alt={shift.casts.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl text-[#d4b5a8]">{shift.casts.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <div className="text-white font-bold text-lg">{shift.start_time.substring(0, 5)} 〜 {shift.end_time.substring(0, 5)}</div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="text-2xl font-bold mb-2 text-center" style={{ color: "#8b7355" }}>{shift.casts.name}</h3>
                    <div className="text-center mb-3">
                      <Badge className="bg-[#d4a574]/20 text-[#8b7355] border-[#d4a574]/50">{shift.casts.type}</Badge>
                    </div>
                    {shift.room && <div className="mb-3 text-center"><span className="text-[#a89586] text-sm">■ {shift.room} ■</span></div>}
                    {shift.notes && <p className="text-sm text-center mb-4 text-[#a89586]">{shift.notes}</p>}
                    <div className="text-center mb-3">
                      <span className="inline-block px-6 py-2 bg-green-600 text-white rounded-full text-sm font-semibold">○ ご案内可能</span>
                    </div>
                    <Button className="w-full bg-[#d4a574] hover:bg-[#c5966a] text-white font-semibold" onClick={() => handleBooking(shift.cast_id, shift.casts.name, shift.start_time)}>
                      詳細を見る / 予約する
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
      <ChatBot />
    </div>
  );
};

export default Schedule;
