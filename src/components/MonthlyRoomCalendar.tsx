import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Shift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  notes: string | null;
}

interface Reservation {
  id: string;
  cast_id: string;
  reservation_date: string;
  start_time: string;
  duration: number;
}

interface Cast {
  id: string;
  name: string;
}

interface MonthlyRoomCalendarProps {
  shifts: Shift[];
  reservations: Reservation[];
  casts: Cast[];
}

export const MonthlyRoomCalendar = ({ shifts, reservations, casts }: MonthlyRoomCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateText, setTemplateText] = useState("");
  const { toast } = useToast();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const getRoomAvailability = (date: Date, room: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayShifts = shifts.filter(s => s.shift_date === dateStr && s.room === room);
    const dayReservations = reservations.filter(r => r.reservation_date === dateStr);

    if (dayShifts.length === 0) return { available: false, booked: 0, total: 0 };

    let totalHours = 0;
    let bookedHours = 0;

    dayShifts.forEach(shift => {
      const startHour = parseInt(shift.start_time.split(':')[0]);
      const endHour = parseInt(shift.end_time.split(':')[0]);
      const shiftHours = endHour > startHour ? endHour - startHour : 24 - startHour + endHour;
      totalHours += shiftHours;

      const shiftReservations = dayReservations.filter(r => r.cast_id === shift.cast_id);
      shiftReservations.forEach(res => {
        bookedHours += res.duration / 60;
      });
    });

    return {
      available: totalHours > 0,
      booked: bookedHours,
      total: totalHours,
    };
  };

  const getDayShifts = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts.filter(s => s.shift_date === dateStr);
  };

  const generateScoutTemplate = () => {
    const monthStr = format(currentMonth, "yyyy年M月", { locale: ja });
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    let template = `${monthStr}のルーム空き状況\n\n`;
    template += "【インルーム】\n";
    
    const inRoomAvailability: string[] = [];
    monthDays.forEach(day => {
      const availability = getRoomAvailability(day, "インルーム");
      if (availability.available && availability.booked < availability.total) {
        const dateStr = format(day, "M/d(E)", { locale: ja });
        const availableHours = availability.total - availability.booked;
        inRoomAvailability.push(`${dateStr} ${availableHours}時間空き`);
      }
    });
    
    if (inRoomAvailability.length > 0) {
      template += inRoomAvailability.join("\n") + "\n";
    } else {
      template += "空きなし\n";
    }
    
    template += "\n【ラスルーム】\n";
    
    const lasRoomAvailability: string[] = [];
    monthDays.forEach(day => {
      const availability = getRoomAvailability(day, "ラスルーム");
      if (availability.available && availability.booked < availability.total) {
        const dateStr = format(day, "M/d(E)", { locale: ja });
        const availableHours = availability.total - availability.booked;
        lasRoomAvailability.push(`${dateStr} ${availableHours}時間空き`);
      }
    });
    
    if (lasRoomAvailability.length > 0) {
      template += lasRoomAvailability.join("\n") + "\n";
    } else {
      template += "空きなし\n";
    }
    
    template += "\n※詳細な時間帯についてはお問い合わせください。";
    
    setTemplateText(template);
    setShowTemplateDialog(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(templateText);
    toast({
      title: "コピーしました",
      description: "テンプレートがクリップボードにコピーされました",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft size={16} />
          </Button>
          <h3 className="text-lg font-semibold">
            {format(currentMonth, "yyyy年M月", { locale: ja })}
          </h3>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight size={16} />
          </Button>
        </div>
        
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={generateScoutTemplate}>
              <FileText size={16} className="mr-2" />
              スカウト用テンプレート生成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>スカウト用テンプレート</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={templateText}
                onChange={(e) => setTemplateText(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={copyToClipboard} className="flex-1">
                  クリップボードにコピー
                </Button>
                <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                  閉じる
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
              <div key={day} className="text-center text-xs font-medium p-2 border-b">
                {day}
              </div>
            ))}
            {calendarDays.map((day, index) => {
              const dayShifts = getDayShifts(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              
              return (
                <div
                  key={index}
                  className={`
                    border p-2 min-h-[100px] text-xs
                    ${!isCurrentMonth ? "bg-muted/50 text-muted-foreground" : "bg-card"}
                  `}
                >
                  <div className="font-semibold mb-1">{format(day, "d")}</div>
                  {dayShifts.length > 0 && isCurrentMonth ? (
                    <div className="space-y-1">
                      {dayShifts.map((shift) => {
                        const cast = casts.find(c => c.id === shift.cast_id);
                        return (
                          <div key={shift.id} className="bg-primary/10 rounded px-1 py-0.5">
                            <div className="font-medium truncate">{cast?.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
                            </div>
                            {shift.room && (
                              <div className="text-[10px] text-muted-foreground">
                                {shift.room}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
