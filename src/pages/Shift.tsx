import { useState, useEffect } from "react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Cast {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  room: string | null;
}

const Shift = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [searchTerm, setSearchTerm] = useState("");
  const [casts, setCasts] = useState<Cast[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    cast_id: "",
    shift_date: new Date(),
    start_time: "13:00",
    end_time: "22:00",
    room: "インルーム",
    notes: "",
  });

  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCasts();
      fetchShifts();
      
      const channel = supabase
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
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

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
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('shift_date')
        .order('start_time');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      toast({
        title: "エラー",
        description: "シフト情報の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddShift = async () => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみシフトを追加できます",
        variant: "destructive",
      });
      return;
    }

    if (!formData.cast_id) {
      toast({
        title: "入力エラー",
        description: "キャストを選択してください",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .insert([{
          cast_id: formData.cast_id,
          shift_date: format(formData.shift_date, 'yyyy-MM-dd'),
          start_time: formData.start_time,
          end_time: formData.end_time,
          room: formData.room,
          notes: formData.notes || null,
          created_by: user!.id,
        }]);

      if (error) throw error;

      toast({
        title: "シフト追加",
        description: "新しいシフトが追加されました",
      });
      
      setIsAddDialogOpen(false);
      setFormData({
        cast_id: "",
        shift_date: new Date(),
        start_time: "13:00",
        end_time: "22:00",
        room: "インルーム",
        notes: "",
      });
    } catch (error: any) {
      console.error('Error adding shift:', error);
      if (error.code === '23505') {
        toast({
          title: "エラー",
          description: "同じ時間帯に既にシフトが登録されています",
          variant: "destructive",
        });
      } else {
        toast({
          title: "エラー",
          description: "シフトの追加に失敗しました",
          variant: "destructive",
        });
      }
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentWeekStart, i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      label: format(date, 'M/d (E)', { locale: ja }),
      isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
    };
  });

  const filteredCasts = casts.filter(cast => 
    cast.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mappedShifts = shifts.map(shift => ({
    id: shift.id,
    castId: shift.cast_id,
    date: shift.shift_date,
    startTime: shift.start_time.slice(0, 5),
    endTime: shift.end_time.slice(0, 5),
    room: shift.room || "",
    notes: shift.notes || "",
  }));

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
      
      <main className="pt-[60px] md:ml-[240px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-full">
            <div className="mb-5 flex justify-between items-center">
              <h2 className="text-lg font-normal m-0 p-0">シフト</h2>
              {isAdmin && (
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus size={16} />
                      シフト追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新しいシフトを追加</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="cast">キャスト</Label>
                        <Select
                          value={formData.cast_id}
                          onValueChange={(value) => setFormData({...formData, cast_id: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="キャストを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {casts.map((cast) => (
                              <SelectItem key={cast.id} value={cast.id}>
                                {cast.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>日付</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !formData.shift_date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.shift_date ? format(formData.shift_date, "PPP", { locale: ja }) : <span>日付を選択</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.shift_date}
                              onSelect={(date) => date && setFormData({...formData, shift_date: date})}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start_time">開始時刻</Label>
                          <Input
                            id="start_time"
                            type="time"
                            value={formData.start_time}
                            onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_time">終了時刻</Label>
                          <Input
                            id="end_time"
                            type="time"
                            value={formData.end_time}
                            onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="room">ルーム</Label>
                        <Select
                          value={formData.room}
                          onValueChange={(value) => setFormData({...formData, room: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="ルームを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="インルーム">インルーム</SelectItem>
                            <SelectItem value="ラスルーム">ラスルーム</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="notes">備考</Label>
                        <Input
                          id="notes"
                          placeholder="備考を入力"
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        />
                      </div>
                      
                      <Button onClick={handleAddShift} className="w-full">
                        追加
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="p-2">
              {/* Date Navigation */}
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousWeek}
                  className="text-xs"
                >
                  <ChevronLeft size={12} className="mr-1" />1週間前
                </Button>
                <div className="text-sm font-medium">
                  {format(currentWeekStart, 'yyyy年M月d日', { locale: ja })} 〜
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextWeek}
                  className="text-xs"
                >
                  1週間後<ChevronRight size={12} className="ml-1" />
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
                </div>
              </div>
            </div>

            <div className="border-t border-border">
              <ShiftCalendar 
                dates={dates}
                casts={filteredCasts}
                shifts={mappedShifts}
                onShiftUpdate={fetchShifts}
              />
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
