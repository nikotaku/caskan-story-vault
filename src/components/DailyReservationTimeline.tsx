import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { Card } from "@/components/ui/card";

interface Cast {
  id: string;
  name: string;
  photo: string | null;
  room: string | null;
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
  price: number;
  payment_status: string;
}

interface DayData {
  date: Date;
  shifts: (Shift & { cast: Cast })[];
  reservations: Reservation[];
}

const ROOMS = ["インroom", "ラスroom"];
const TIME_START = 13;
const TIME_END = 25;

export const DailyReservationTimeline = () => {
  const [todayData, setTodayData] = useState<DayData | null>(null);
  const [tomorrowData, setTomorrowData] = useState<DayData | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = new Date();
    const tomorrow = addDays(today, 1);

    const todayStr = format(today, "yyyy-MM-dd");
    const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

    // Fetch shifts with cast info
    const { data: shiftsData } = await supabase
      .from("shifts")
      .select(`
        *,
        cast:casts(id, name, photo, room)
      `)
      .in("shift_date", [todayStr, tomorrowStr]);

    // Fetch reservations
    const { data: reservationsData } = await supabase
      .from("reservations")
      .select("*")
      .in("reservation_date", [todayStr, tomorrowStr]);

    const todayShifts = shiftsData?.filter(s => s.shift_date === todayStr) || [];
    const tomorrowShifts = shiftsData?.filter(s => s.shift_date === tomorrowStr) || [];
    const todayReservations = reservationsData?.filter(r => r.reservation_date === todayStr) || [];
    const tomorrowReservations = reservationsData?.filter(r => r.reservation_date === tomorrowStr) || [];

    setTodayData({
      date: today,
      shifts: todayShifts as any,
      reservations: todayReservations,
    });

    setTomorrowData({
      date: tomorrow,
      shifts: tomorrowShifts as any,
      reservations: tomorrowReservations,
    });
  };

  const getTimePosition = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = TIME_START * 60;
    const endMinutes = TIME_END * 60;
    return ((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
  };

  const getReservationHeight = (duration: number) => {
    const totalMinutes = (TIME_END - TIME_START) * 60;
    return (duration / totalMinutes) * 100;
  };

  const renderDayColumn = (dayData: DayData | null) => {
    if (!dayData) return null;

    return (
      <div className="flex-1">
        <div className="text-center mb-4 font-bold text-lg">
          {format(dayData.date, "M/d (E)", { locale: ja })}
        </div>
        <div className="flex gap-2">
          {ROOMS.map((room) => {
            const roomShifts = dayData.shifts.filter(
              (s) => (s.room || s.cast.room) === room
            );

            return (
              <div key={room} className="flex-1">
                <div className="text-sm font-semibold mb-2 text-center bg-muted/50 p-2 rounded">
                  {room}
                </div>
                <div className="relative" style={{ height: "800px" }}>
                  {/* Time grid lines */}
                  {Array.from({ length: TIME_END - TIME_START + 1 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-t border-border/30"
                      style={{ top: `${(i / (TIME_END - TIME_START)) * 100}%` }}
                    >
                      <span className="text-xs text-muted-foreground ml-1">
                        {TIME_START + i}:00
                      </span>
                    </div>
                  ))}

                  {/* Shifts and Reservations */}
                  {roomShifts.map((shift) => {
                    const shiftReservations = dayData.reservations.filter(
                      (r) => r.cast_id === shift.cast_id
                    );

                    return (
                      <div
                        key={shift.id}
                        className="absolute left-0 right-0 px-1"
                        style={{
                          top: `${getTimePosition(shift.start_time)}%`,
                        }}
                      >
                        {/* Cast info */}
                        <div className="flex items-center gap-1 mb-1">
                          {shift.cast.photo && (
                            <img
                              src={shift.cast.photo}
                              alt={shift.cast.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          )}
                          <div className="text-xs">
                            <div className="font-semibold">{shift.cast.name}</div>
                            <div className="text-muted-foreground">
                              {shift.start_time.slice(0, 5)}~{shift.end_time.slice(0, 5)}
                            </div>
                          </div>
                        </div>

                        {/* Reservations */}
                        {shiftReservations.map((reservation) => (
                          <Card
                            key={reservation.id}
                            className="p-2 mb-1 text-xs"
                            style={{
                              backgroundColor:
                                reservation.payment_status === "paid"
                                  ? "hsl(var(--primary) / 0.2)"
                                  : "hsl(var(--secondary) / 0.2)",
                              minHeight: `${Math.max(getReservationHeight(reservation.duration), 60)}px`,
                            }}
                          >
                            <div className="font-semibold">
                              {reservation.start_time.slice(0, 5)}~
                              {format(
                                addDays(
                                  parse(reservation.start_time, "HH:mm:ss", new Date()),
                                  0
                                ).getTime() + reservation.duration * 60000,
                                "HH:mm"
                              )}
                            </div>
                            <div>{reservation.customer_name}</div>
                            <div>{reservation.duration}分</div>
                            <div className="font-semibold">
                              ¥{reservation.price.toLocaleString()}{" "}
                              {reservation.payment_status === "paid" ? "現" : "未"}
                            </div>
                          </Card>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">本日・明日の予約状況</h2>
      <div className="flex gap-4 overflow-x-auto">
        {renderDayColumn(todayData)}
        {renderDayColumn(tomorrowData)}
      </div>
    </div>
  );
};
