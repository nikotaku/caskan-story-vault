import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, parse, addMinutes, startOfMonth, endOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ReservationForm } from "@/components/ReservationForm";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Cast {
  id: string;
  name: string;
  photo: string | null;
}

interface Shift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
}

interface Reservation {
  id: string;
  cast_id: string;
  reservation_date: string;
  start_time: string;
  duration: number;
  customer_name: string;
  customer_phone: string;
  course_name: string;
  course_type: string | null;
  nomination_type: string | null;
  price: number;
  status: string;
  payment_status: string;
  room: string | null;
}

const TIME_START = 10;
const TIME_END = 26; // 翌2:00
const HOUR_WIDTH = 120; // px per hour
const TICK_WIDTH = HOUR_WIDTH / 6; // 10min = 20px
const ROW_HEIGHT = 80;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 border-amber-400 text-amber-900",
  confirmed: "bg-blue-100 border-blue-400 text-blue-900",
  completed: "bg-emerald-100 border-emerald-400 text-emerald-900",
  cancelled: "bg-rose-100 border-rose-300 text-rose-700 opacity-50",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "確認中",
  confirmed: "確定",
  completed: "完了",
  cancelled: "キャンセル",
};

export default function Schedule() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shifts, setShifts] = useState<(Shift & { cast: Cast })[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // form state for new reservation
  const [formData, setFormData] = useState({
    cast_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    nomination_type: "none",
    reservation_date: new Date(),
    start_time: "14:00",
    end_time: "15:00",
    duration: 80,
    room: "",
    course_type: "aroma",
    course_name: "80分 アロマオイルコース",
    selectedOptions: [] as string[],
    price: 12000,
    payment_method: "cash",
    reservation_method: "",
    notes: "",
  });

  const [casts, setCasts] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; address: string | null }[]>([]);
  const [backRates, setBackRates] = useState<any[]>([]);
  const [optionRates, setOptionRates] = useState<any[]>([]);
  const [nominationRates, setNominationRates] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      fetchData();
      fetchFormData();
    }
  }, [user, selectedDate]);

  const fetchFormData = async () => {
    const [{ data: c }, { data: r }, { data: b }, { data: o }, { data: n }] = await Promise.all([
      supabase.from("casts").select("id, name").order("name"),
      supabase.from("rooms").select("id, name, address").eq("is_active", true).order("name"),
      supabase.from("back_rates").select("*"),
      supabase.from("option_rates").select("*"),
      supabase.from("nomination_rates").select("*"),
    ]);
    if (c) setCasts(c);
    if (r) setRooms(r);
    if (b) setBackRates(b);
    if (o) setOptionRates(o);
    if (n) setNominationRates(n);
  };

  const fetchData = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");

    const [{ data: shiftsData }, { data: reservationsData }, { data: monthData }] = await Promise.all([
      supabase
        .from("shifts")
        .select("*, cast:casts(id, name, photo)")
        .eq("shift_date", dateStr),
      supabase
        .from("reservations")
        .select("*")
        .eq("reservation_date", dateStr)
        .neq("status", "cancelled"),
      supabase
        .from("reservations")
        .select("price")
        .gte("reservation_date", monthStart)
        .lte("reservation_date", monthEnd)
        .neq("status", "cancelled"),
    ]);

    setShifts((shiftsData as any) || []);
    setReservations(reservationsData || []);
    setMonthlyTotal((monthData || []).reduce((sum, r: any) => sum + (r.price || 0), 0));
    setLoading(false);
  };

  const dailyTotal = useMemo(
    () => reservations.reduce((sum, r) => sum + (r.price || 0), 0),
    [reservations]
  );

  // Group shifts by cast
  const castRows = useMemo(() => {
    const map = new Map<string, { cast: Cast; shift: Shift & { cast: Cast }; reservations: Reservation[] }>();
    shifts.forEach((s) => {
      if (!map.has(s.cast_id)) {
        map.set(s.cast_id, { cast: s.cast, shift: s, reservations: [] });
      }
    });
    reservations.forEach((r) => {
      const row = map.get(r.cast_id);
      if (row) row.reservations.push(r);
    });
    return Array.from(map.values());
  }, [shifts, reservations]);

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const minutesToPx = (minutes: number) => {
    const startMin = TIME_START * 60;
    return ((minutes - startMin) / 60) * HOUR_WIDTH;
  };

  const hours = Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i);
  const ticks = Array.from({ length: (TIME_END - TIME_START) * 6 }, (_, i) => TIME_START * 60 + i * 10);

  const handleTimelineClick = (castId: string, minutesFromStart: number) => {
    const totalMin = TIME_START * 60 + minutesFromStart;
    const snapped = Math.floor(totalMin / 10) * 10;
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    setFormData((prev) => ({
      ...prev,
      cast_id: castId,
      reservation_date: selectedDate,
      start_time: timeStr,
    }));
    setIsAddOpen(true);
  };

  const handleAddReservation = async () => {
    if (!isAdmin || !user) return;
    try {
      const { error } = await supabase.from("reservations").insert([{
        cast_id: formData.cast_id,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email || null,
        reservation_date: format(formData.reservation_date, "yyyy-MM-dd"),
        start_time: formData.start_time,
        duration: formData.duration,
        course_type: formData.course_type,
        course_name: formData.course_name,
        options: formData.selectedOptions,
        nomination_type: formData.nomination_type === "none" ? null : formData.nomination_type,
        price: formData.price,
        notes: formData.notes || null,
        room: formData.room || null,
        created_by: user.id,
      }]);
      if (error) throw error;
      toast({ title: "予約追加", description: "新しい予約が追加されました" });
      setIsAddOpen(false);
      fetchData();
    } catch {
      toast({ title: "エラー", description: "予約の追加に失敗しました", variant: "destructive" });
    }
  };

  const totalWidth = hours.length * HOUR_WIDTH;

  // Current time indicator
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
  const nowPx = minutesToPx(nowMinutes);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4">
          {/* Header controls */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
                <ChevronLeft size={18} />
              </Button>
              <h1 className="text-xl font-bold min-w-[160px] text-center">
                {format(selectedDate, "yyyy年M月d日 (E)", { locale: ja })}
              </h1>
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                <ChevronRight size={18} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                今日
              </Button>
            </div>

            {isAdmin && (
              <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
                <SheetTrigger asChild>
                  <Button size="sm">
                    <Plus size={16} className="mr-1" />
                    新規予約
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>新しい予約を追加</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <ReservationForm
                      formData={formData}
                      setFormData={setFormData}
                      casts={casts}
                      rooms={rooms}
                      backRates={backRates}
                      optionRates={optionRates}
                      nominationRates={nominationRates}
                      onSubmit={handleAddReservation}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

          {/* Sales summary */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={18} className="text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">本日の売上</div>
                <div className="text-lg sm:text-xl font-bold truncate">
                  ¥{dailyTotal.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {reservations.length}件の予約
                </div>
              </div>
            </Card>
            <Card className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0">
                <CalendarIcon size={18} className="text-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  {format(selectedDate, "M月", { locale: ja })}の売上合計
                </div>
                <div className="text-lg sm:text-xl font-bold truncate">
                  ¥{monthlyTotal.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">月次累計</div>
              </div>
            </Card>
          </div>

          {/* Timechart */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: totalWidth + 140 }}>
                {/* Time header */}
                <div className="flex border-b bg-muted/30 sticky top-0 z-10">
                  <div className="w-[140px] flex-shrink-0 p-2 text-xs font-semibold border-r bg-muted/50 flex items-center">
                    キャスト
                  </div>
                  <div className="flex relative">
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="border-r border-border/40 text-xs text-center font-medium text-muted-foreground relative"
                        style={{ width: HOUR_WIDTH }}
                      >
                        <div className="py-2">{h >= 24 ? h - 24 : h}:00</div>
                        {/* 10-min tick marks */}
                        <div className="absolute bottom-0 left-0 right-0 flex">
                          {[0, 1, 2, 3, 4, 5].map((t) => (
                            <div
                              key={t}
                              className="border-r border-border/20 flex-1"
                              style={{ height: t === 3 ? 6 : 3 }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cast rows */}
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">読み込み中...</div>
                ) : castRows.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    この日の出勤データがありません
                  </div>
                ) : (
                  castRows.map(({ cast, shift, reservations: castRes }) => {
                    const shiftStartMin = timeToMinutes(shift.start_time);
                    const shiftEndMin = timeToMinutes(shift.end_time);
                    const shiftLeft = minutesToPx(shiftStartMin);
                    const shiftWidth = ((shiftEndMin - shiftStartMin) / 60) * HOUR_WIDTH;

                    return (
                      <div key={cast.id} className="flex border-b hover:bg-accent/20 transition-colors" style={{ height: ROW_HEIGHT }}>
                        {/* Cast info */}
                        <div className="w-[140px] flex-shrink-0 p-2 border-r flex items-center gap-2 bg-card">
                          {cast.photo ? (
                            <img src={cast.photo} alt={cast.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {cast.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{cast.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {shift.start_time.slice(0, 5)}~{shift.end_time.slice(0, 5)}
                            </div>
                            {shift.room && (
                              <div className="text-[10px] text-primary font-medium">{shift.room}</div>
                            )}
                          </div>
                        </div>

                        {/* Timeline area */}
                        <div
                          className="flex-1 relative cursor-crosshair"
                          onClick={(e) => {
                            if (!isAdmin) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const minutesFromStart = (x / HOUR_WIDTH) * 60;
                            handleTimelineClick(cast.id, minutesFromStart);
                          }}
                        >
                          {/* 10-min grid lines */}
                          {ticks.map((tickMin) => {
                            const isHour = tickMin % 60 === 0;
                            const is30 = tickMin % 30 === 0;
                            return (
                              <div
                                key={tickMin}
                                className={cn(
                                  "absolute top-0 bottom-0 border-r",
                                  isHour ? "border-border/40" : is30 ? "border-border/25" : "border-border/10"
                                )}
                                style={{ left: minutesToPx(tickMin) }}
                              />
                            );
                          })}

                          {/* Shift background bar */}
                          <div
                            className="absolute top-1 bottom-1 bg-primary/5 border border-primary/20 rounded"
                            style={{ left: shiftLeft, width: shiftWidth }}
                          />

                          {/* Reservation blocks */}
                          {castRes.map((res) => {
                            const resStartMin = timeToMinutes(res.start_time);
                            const resLeft = minutesToPx(resStartMin);
                            const resWidth = (res.duration / 60) * HOUR_WIDTH;
                            const statusClass = STATUS_COLORS[res.status] || STATUS_COLORS.pending;

                            const endTime = format(
                              addMinutes(parse(res.start_time, "HH:mm:ss", new Date()), res.duration),
                              "HH:mm"
                            );

                            return (
                              <div
                                key={res.id}
                                className={cn(
                                  "absolute top-1 bottom-1 rounded border-l-4 px-1.5 py-0.5 overflow-hidden cursor-pointer hover:shadow-md transition-shadow",
                                  statusClass
                                )}
                                style={{ left: resLeft, width: Math.max(resWidth, 60) }}
                                title={`${res.customer_name} | ${res.course_name} | ¥${res.price.toLocaleString()}`}
                              >
                                <div className="text-[10px] font-bold leading-tight">
                                  {res.start_time.slice(0, 5)}~{endTime}
                                </div>
                                <div className="text-xs font-semibold truncate leading-tight">
                                  {res.customer_name}
                                </div>
                                <div className="text-[10px] truncate leading-tight">
                                  {res.duration}分 ¥{res.price.toLocaleString()}
                                </div>
                                {res.nomination_type && (
                                  <div className="text-[9px] font-medium truncate">
                                    {res.nomination_type === "honshimei" ? "本指名" : res.nomination_type === "photo" ? "写真指名" : res.nomination_type}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Current time indicator */}
                          {isToday && nowMinutes >= TIME_START * 60 && nowMinutes <= TIME_END * 60 && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                              style={{ left: nowPx }}
                            >
                              <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>

          {/* Legend */}
          <div className="flex gap-4 mt-3 flex-wrap text-xs">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <div className={cn("w-3 h-3 rounded border-l-2", STATUS_COLORS[key])} />
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-auto py-4 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-muted-foreground">© 2025 caskan.jp All rights reserved</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
