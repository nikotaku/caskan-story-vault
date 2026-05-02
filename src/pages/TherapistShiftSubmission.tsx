import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

interface Cast {
  id: string;
  name: string;
  photo: string | null;
}

const SHIFT_TYPES = [
  { id: "early1", label: "早番❶", start: "11:00", end: "15:00", emoji: "🌅" },
  { id: "early2", label: "早番❷", start: "12:00", end: "17:00", emoji: "☀️" },
  { id: "late1", label: "遅番❶", start: "16:00", end: "23:00", emoji: "🌆" },
  { id: "late2", label: "遅番❷", start: "18:00", end: "23:00", emoji: "🌙" },
  { id: "full", label: "通し", start: "11:00", end: "23:00", emoji: "💪" },
];

const WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function TherapistShiftSubmission() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [cast, setCast] = useState<Cast | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selections, setSelections] = useState<Record<string, string>>({}); // dateStr -> shiftType id

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_cast_by_access_token", { p_token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          toast.error("無効なアクセスリンクです");
          navigate("/");
          return;
        }
        setCast(row as Cast);
      } catch (e) {
        console.error(e);
        toast.error("読み込みに失敗しました");
        navigate("/");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDay = getDay(startOfMonth(currentMonth));

  const setShift = (dateStr: string, shiftId: string) => {
    setSelections(prev => {
      if (prev[dateStr] === shiftId) {
        const { [dateStr]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dateStr]: shiftId };
    });
  };

  const handleSubmit = async () => {
    if (!token) return;
    const shifts = Object.entries(selections).map(([date, shiftId]) => {
      const t = SHIFT_TYPES.find(s => s.id === shiftId)!;
      return { shift_date: date, start_time: t.start, end_time: t.end };
    });
    if (shifts.length === 0) {
      toast.error("シフトを選択してください");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_therapist_shifts", {
        p_token: token,
        p_shifts: shifts as any,
      });
      if (error) throw error;
      toast.success(`${data ?? shifts.length}件のシフトを提出しました`);
      setSelections({});
    } catch (e: any) {
      console.error(e);
      toast.error(e.message === "invalid_token" ? "アクセストークンが無効です" : "提出に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cast) return null;

  const selectedCount = Object.keys(selections).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/therapist/${token}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />戻る
          </Button>
          {cast.photo && <img src={cast.photo} alt={cast.name} className="h-10 w-10 rounded-full object-cover" />}
          <div>
            <h1 className="text-lg font-bold">{cast.name}様</h1>
            <p className="text-xs text-muted-foreground">シフト提出</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">シフト種類を選んで日付をタップ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              下のカレンダーで日付をタップ → シフト種類を選択。同じシフトをもう一度タップで取消。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SHIFT_TYPES.map(s => (
                <div key={s.id} className="text-xs px-2 py-2 border rounded-md text-center bg-muted/30">
                  <div className="font-bold">{s.emoji} {s.label}</div>
                  <div className="text-muted-foreground">{s.start}〜{s.end}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
                <ChevronLeft className="h-4 w-4" />前月
              </Button>
              <CardTitle className="text-base">{format(currentMonth, "yyyy年M月", { locale: ja })}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                次月<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEK_DAYS.map((d, i) => (
                <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const sel = selections[dateStr];
                const t = sel ? SHIFT_TYPES.find(s => s.id === sel) : null;
                return (
                  <div key={dateStr} className="border rounded-md p-1 min-h-[64px] flex flex-col">
                    <div className="text-xs font-bold mb-1">{format(day, "d")}</div>
                    <div className="flex flex-wrap gap-0.5">
                      {SHIFT_TYPES.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setShift(dateStr, s.id)}
                          className={`text-[10px] px-1 rounded ${sel === s.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                          title={s.label}
                        >
                          {s.emoji}
                        </button>
                      ))}
                    </div>
                    {t && <div className="text-[10px] text-primary mt-1 truncate">{t.label}</div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm p-3">
        <div className="container mx-auto max-w-3xl flex items-center justify-between gap-3">
          <Badge variant="secondary">選択中: {selectedCount}日</Badge>
          <Button onClick={handleSubmit} disabled={submitting || selectedCount === 0}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            シフトを提出
          </Button>
        </div>
      </div>
    </div>
  );
}
