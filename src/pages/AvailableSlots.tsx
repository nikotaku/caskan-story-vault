import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useShopSettings, getBusinessDateFromCache } from "@/hooks/useShopSettings";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Shift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  casts: { name: string };
}

interface Reservation {
  cast_id: string;
  start_time: string;
  duration: number;
}

const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = 10 + i;
  return `${String(hour).padStart(2, "0")}:00`;
});

export default function AvailableSlots() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getBusinessDateFromCache);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCast, setSelectedCast] = useState<string>("all");
  const [casts, setCasts] = useState<{ id: string; name: string }[]>([]);

  const { user, loading: authLoading } = useAuth();
  const { loaded: settingsLoaded, businessToday } = useShopSettings();
  useEffect(() => {
    if (settingsLoaded) setSelectedDate(businessToday);
  }, [settingsLoaded]); // eslint-disable-line
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCasts();
      fetchData();
    }
  }, [user, selectedDate, selectedCast]);

  const fetchCasts = async () => {
    const { data, error } = await supabase
      .from("casts")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (!error) setCasts(data || []);
  };

  const fetchData = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      let shiftsQuery = supabase
        .from("shifts")
        .select("*, casts(name)")
        .eq("shift_date", dateStr);

      if (selectedCast !== "all") {
        shiftsQuery = shiftsQuery.eq("cast_id", selectedCast);
      }

      const { data: shiftsData, error: shiftsError } = await shiftsQuery;
      if (shiftsError) throw shiftsError;

      let resvQuery = supabase
        .from("reservations")
        .select("cast_id, start_time, duration")
        .eq("reservation_date", dateStr)
        .neq("status", "cancelled");

      if (selectedCast !== "all") {
        resvQuery = resvQuery.eq("cast_id", selectedCast);
      }

      const { data: resvData, error: resvError } = await resvQuery;
      if (resvError) throw resvError;

      setShifts(shiftsData || []);
      setReservations(resvData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const isSlotAvailable = (
    castId: string,
    timeStr: string
  ): boolean => {
    const shift = shifts.find((s) => s.cast_id === castId);
    if (!shift) return false;

    const [slotHour, slotMin] = timeStr.split(":").map(Number);
    const slotTime = slotHour * 60 + slotMin;

    const [shiftStartHour, shiftStartMin] = shift.start_time
      .split(":")
      .map(Number);
    const shiftStart = shiftStartHour * 60 + shiftStartMin;

    const [shiftEndHour, shiftEndMin] = shift.end_time.split(":").map(Number);
    const shiftEnd = shiftEndHour * 60 + shiftEndMin;

    if (slotTime < shiftStart || slotTime + 60 > shiftEnd) return false;

    return !reservations.some((res) => {
      if (res.cast_id !== castId) return false;
      const [resHour, resMin] = res.start_time.split(":").map(Number);
      const resStart = resHour * 60 + resMin;
      const resEnd = resStart + res.duration;
      return slotTime < resEnd && slotTime + 60 > resStart;
    });
  };

  const displayCasts =
    selectedCast === "all" ? casts : casts.filter((c) => c.id === selectedCast);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">空き枠</h1>
                <p className="text-muted-foreground">
                  {format(selectedDate, "yyyy年M月d日(E)", { locale: ja })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSelectedDate(addDays(selectedDate, -1))
                  }
                >
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  今日
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSelectedDate(addDays(selectedDate, 1))
                  }
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            </div>

            <Select value={selectedCast} onValueChange={setSelectedCast}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全セラピスト</SelectItem>
                {casts.map((cast) => (
                  <SelectItem key={cast.id} value={cast.id}>
                    {cast.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground">読み込み中...</div>
          ) : displayCasts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              セラピストがいません
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayCasts.map((cast) => {
                const castShift = shifts.find((s) => s.cast_id === cast.id);
                if (!castShift) return null;

                const availableSlots = TIME_SLOTS.filter((time) =>
                  isSlotAvailable(cast.id, time)
                );

                return (
                  <Card key={cast.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{cast.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {castShift.start_time.slice(0, 5)}～
                        {castShift.end_time.slice(0, 5)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {availableSlots.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            空き枠はありません
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {availableSlots.map((time) => (
                              <div
                                key={time}
                                className="text-xs bg-emerald-100 text-emerald-900 p-2 rounded text-center font-semibold"
                              >
                                {time}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
