import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { driveImgUrl } from "@/lib/drive";
import { useStore } from "@/hooks/useStore";
import { format, addDays, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock } from "lucide-react";

interface Shift {
  id: string;
  cast_id: string;
  start_time: string;
  end_time: string;
  casts: {
    id: string;
    name: string;
    photo: string | null;
    age: number | null;
    height: number | null;
    cup_size: string | null;
    bust: number | null;
    waist: number | null;
    hip: number | null;
  };
}

const DAYS = 7;

export function WeeklyScheduleWidget() {
  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const { storeId, loading: storeLoading } = useStore();

  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));

  useEffect(() => {
    if (storeLoading) return;
    fetchShifts();
  }, [selectedDate, storeLoading, storeId]);

  const fetchShifts = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data } = await supabase
      .from("shifts")
      .select("id,cast_id,start_time,end_time,casts(id,name,photo,age,height,cup_size,bust,waist,hip)")
      .eq("shift_date", dateStr)
      .eq("store_id", storeId)
      .order("start_time", { ascending: true });

    // deduplicate by cast_id, filter hidden
    const seen = new Set<string>();
    const unique: Shift[] = [];
    for (const sh of (data || []) as any[]) {
      if (sh.casts?.is_visible === false) continue;
      if (seen.has(sh.cast_id)) continue;
      seen.add(sh.cast_id);
      unique.push(sh as Shift);
    }
    setShifts(unique);
    setLoading(false);
  };

  const statsLabel = (c: Shift["casts"]) => {
    const parts: string[] = [];
    if (c.height) parts.push(`T${c.height}`);
    if (c.bust && c.cup_size) parts.push(`${c.bust}(${c.cup_size})`);
    else if (c.cup_size) parts.push(`(${c.cup_size})`);
    if (c.waist) parts.push(`${c.waist}`);
    if (c.hip) parts.push(`${c.hip}`);
    return parts.join("・");
  };

  return (
    <section className="py-5 md:py-8" style={{ background: "linear-gradient(180deg, #2e2b29 0%, #3a3330 100%)" }}>
      <div className="container mx-auto max-w-6xl px-3 md:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] tracking-widest text-[var(--pub-accent,#c6a15b)] mb-0.5">WEEKLY SCHEDULE</p>
            <h2 className="text-base md:text-lg font-bold tracking-wider text-white">週間出勤予定</h2>
          </div>
          <Link
            to="/schedule"
            className="text-xs text-[var(--pub-accent,#c6a15b)] border border-[var(--pub-accent-a50,#c6a15b80)] px-2.5 py-1 rounded hover:bg-[var(--pub-accent-a10,#c6a15b1a)] transition"
          >
            一覧を見る ▶
          </Link>
        </div>

        {/* Day Tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {days.map((d) => {
            const isSel = format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
            const isToday = format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
            const dow = format(d, "E", { locale: ja });
            const isSun = d.getDay() === 0;
            const isSat = d.getDay() === 6;
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className={`shrink-0 flex flex-col items-center rounded-full w-12 h-12 justify-center transition-all text-center ${
                  isSel
                    ? "bg-[var(--pub-accent,#c6a15b)] text-white"
                    : "bg-white/10 hover:bg-white/20 text-white/80"
                }`}
              >
                {isToday ? (
                  <span className="text-[9px] leading-none mb-0.5">本日</span>
                ) : (
                  <span className={`text-[9px] leading-none mb-0.5 ${isSun ? "text-red-300" : isSat ? "text-blue-300" : ""}`}>
                    {format(d, "M/d")}
                  </span>
                )}
                <span className={`text-[10px] font-semibold ${isSun ? (isSel ? "" : "text-red-300") : isSat ? (isSel ? "" : "text-blue-300") : ""}`}>
                  {dow}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="aspect-[3/4] bg-white/10 rounded animate-pulse" />
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <p className="text-center text-[var(--pub-text-muted,#a3987f)] py-8 text-sm">この日の出勤予定はありません</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {shifts.map((shift) => {
              const c = shift.casts;
              const stats = statsLabel(c);
              return (
                <Link
                  key={shift.id}
                  to={`/casts/${c.id}`}
                  className="group block"
                >
                  <div className="relative rounded overflow-hidden bg-[#2a2320]">
                    {/* Photo */}
                    <div className="aspect-[3/4]">
                      {c.photo ? (
                        <img
                          src={driveImgUrl(c.photo, 300)}
                          alt={c.name}
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl text-[var(--pub-accent-a40,#c6a15b66)]">
                          {c.name.charAt(0)}
                        </div>
                      )}
                      {/* Time overlay */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-1 px-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <Clock size={8} className="text-[var(--pub-accent,#c6a15b)] shrink-0" />
                          <span className="text-[9px] text-white font-medium leading-tight">
                            {shift.start_time.slice(0,5)}〜{shift.end_time.slice(0,5)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Info below photo */}
                  <div className="mt-1 px-0.5">
                    <p className="text-[11px] font-bold text-white truncate leading-tight">
                      {c.name}{c.age ? `(${c.age}歳)` : ""}
                    </p>
                    {stats && (
                      <p className="text-[9px] text-[var(--pub-text-muted,#a3987f)] truncate leading-tight mt-0.5">{stats}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
