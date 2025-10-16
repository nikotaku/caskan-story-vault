import { useState, useEffect } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Cast {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  castId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

const Shift = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [casts, setCasts] = useState<Cast[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // 現在の週の日付を生成
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // 日曜始まり
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date: format(date, "yyyy-MM-dd"),
      label: format(date, "M/d (E)", { locale: ja }),
      isToday: format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
    };
  });

  // キャストとシフトデータを取得
  useEffect(() => {
    if (!user) return;
    
    fetchCasts();
    fetchShifts();

    // リアルタイム更新を購読
    const shiftsChannel = supabase
      .channel('shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts'
        },
        () => {
          fetchShifts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shiftsChannel);
    };
  }, [user, currentDate]);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from('casts')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCasts(data || []);
    } catch (error) {
      console.error('Error fetching casts:', error);
    }
  };

  const fetchShifts = async () => {
    try {
      const weekEnd = addDays(weekStart, 6);
      
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .gte('shift_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('shift_date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('status', 'scheduled');

      if (error) throw error;

      const formattedShifts = (data || []).map(shift => ({
        id: shift.id,
        castId: shift.cast_id,
        date: shift.shift_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        notes: shift.notes,
      }));

      setShifts(formattedShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCasts = casts.filter(cast => 
    cast.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const goToPreviousWeek = () => {
    setCurrentDate(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentDate(prev => addDays(prev, 7));
  };

  const tabMenuItems = [
    { label: "シフト登録", href: "/shift", active: true },
    { label: "シフト表", href: "/shift/view", active: false },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-full">
            <div className="mb-5">
              <h2 className="text-lg font-normal m-0 p-0">シフト</h2>
            </div>

            {/* Tab Menu */}
            <div className="border-b border-border mb-4 px-2">
              <div className="flex">
                {tabMenuItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`inline-block w-auto py-2.5 px-6 text-center border-l border-t border-r border-border rounded-t-md -mb-px text-xs ${
                      item.active 
                        ? "bg-muted/50" 
                        : "bg-background hover:bg-muted/30"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="p-2">
              {/* Date Navigation */}
              <div className="mb-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousWeek}
                  className="text-xs"
                >
                  <ChevronLeft size={12} className="mr-1" />
                  1週間前
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[180px] justify-start text-left font-normal text-xs",
                        !currentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {format(currentDate, "yyyy年M月d日", { locale: ja })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentDate}
                      onSelect={(date) => date && setCurrentDate(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextWeek}
                  className="text-xs"
                >
                  1週間後
                  <ChevronRight size={12} className="ml-1" />
                </Button>
              </div>

              {/* Search */}
              <div className="py-1 mb-4">
                <div className="flex max-w-64">
                  <Input
                    type="text"
                    placeholder="キャスト名"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button type="button" size="sm" className="ml-1 h-8">
                    検索
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-border">
              <ShiftCalendar 
                dates={dates}
                casts={filteredCasts}
                shifts={shifts}
                onShiftUpdate={fetchShifts}
              />
            </div>

            <div className="p-2 text-xs">
              <a href="/schedule" className="text-foreground hover:underline">
                表示を切り替える
              </a>
            </div>
          </div>
        </div>
        
        <footer className="mt-auto py-4 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-muted-foreground">
              © 2025 caskan.jp All rights reserved
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Shift;
