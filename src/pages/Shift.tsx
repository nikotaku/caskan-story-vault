import { useState, useEffect } from "react";
import { format, addWeeks, subWeeks, startOfWeek, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, User, Phone, Clock, CreditCard, Trash2, CalendarIcon, MessageSquare, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
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

interface Reservation {
  id: string;
  cast_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  reservation_date: string;
  start_time: string;
  duration: number;
  course_name: string;
  course_type: string | null;
  options: string[] | null;
  nomination_type: string | null;
  price: number;
  status: string;
  payment_status: string;
  notes: string | null;
  casts?: { name: string };
}

const Shift = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [searchTerm, setSearchTerm] = useState("");
  const [casts, setCasts] = useState<Cast[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [reservationSearchTerm, setReservationSearchTerm] = useState("");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date>(new Date());
  const [generatingSMS, setGeneratingSMS] = useState<string | null>(null);
  const [smsMessage, setSmsMessage] = useState<string>("");
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  
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
      fetchReservations();
      
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

      const reservationsChannel = supabase
        .channel('reservations-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations'
          },
          () => {
            fetchReservations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(shiftsChannel);
        supabase.removeChannel(reservationsChannel);
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

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          casts:cast_id (name)
        `)
        .order('reservation_date', { ascending: false })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast({
        title: "エラー",
        description: "予約情報の取得に失敗しました",
        variant: "destructive",
      });
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

  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = 
      reservation.customer_name.toLowerCase().includes(reservationSearchTerm.toLowerCase()) ||
      reservation.customer_phone.includes(reservationSearchTerm);
    const matchesStatus = filterStatus === "all" || reservation.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleDeleteReservation = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ予約を削除できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "予約削除",
        description: "予約が削除されました",
      });
    } catch (error) {
      console.error('Error deleting reservation:', error);
      toast({
        title: "エラー",
        description: "予約の削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみステータスを変更できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "ステータス変更",
        description: "ステータスが更新されました",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "エラー",
        description: "ステータスの変更に失敗しました",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "confirmed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "no_show": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "予約確認中";
      case "confirmed": return "予約確定";
      case "completed": return "完了";
      case "cancelled": return "キャンセル";
      case "no_show": return "No Show";
      default: return "不明";
    }
  };

  const handleGenerateSMS = async (reservation: Reservation) => {
    setGeneratingSMS(reservation.id);
    try {
      const { data: castData } = await supabase
        .from("casts")
        .select("name")
        .eq("id", reservation.cast_id)
        .single();

      const { data: shopData } = await supabase
        .from("shop_settings")
        .select("shop_name")
        .limit(1)
        .single();

      const { data, error } = await supabase.functions.invoke("generate-sms-message", {
        body: {
          customerName: reservation.customer_name,
          reservationDate: reservation.reservation_date,
          startTime: reservation.start_time,
          courseName: reservation.course_name,
          duration: reservation.duration,
          castName: castData?.name || "担当セラピスト",
          shopName: shopData?.shop_name || "当店",
        },
      });

      if (error) throw error;

      setSmsMessage(data.message);
      setShowSmsDialog(true);
      toast({
        title: "SMS生成完了",
        description: "メッセージが生成されました",
      });
    } catch (error: any) {
      console.error("SMS generation error:", error);
      toast({
        title: "エラー",
        description: error.message || "SMS生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setGeneratingSMS(null);
    }
  };

  // タイムスケジュール用のヘルパー関数
  const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = 12 + i;
    return hour < 24 ? `${hour}:00` : `${hour - 24}:00`;
  });

  const getScheduleDateStr = format(selectedScheduleDate, "yyyy-MM-dd");
  const todayShifts = shifts.filter(shift => shift.shift_date === getScheduleDateStr);
  const todayReservations = reservations.filter(res => res.reservation_date === getScheduleDateStr);

  const isTimeSlotBooked = (castId: string, time: string) => {
    return todayReservations.some(res => {
      const resHour = parseInt(res.start_time.split(':')[0]);
      const slotHour = parseInt(time.split(':')[0]);
      const duration = res.duration / 60;
      
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
            <div className="mb-5">
              <h2 className="text-lg font-normal m-0 p-0">シフト・予約管理</h2>
            </div>

            <Tabs defaultValue="shift" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="shift">シフトカレンダー</TabsTrigger>
                <TabsTrigger value="reservations">予約ダッシュボード</TabsTrigger>
              </TabsList>

              <TabsContent value="shift" className="space-y-4">
                <div className="flex justify-end">
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
              </TabsContent>

              <TabsContent value="reservations" className="space-y-4">
                {/* タイムスケジュールウィジェット */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">セラピスト別タイムスケジュール</h3>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(selectedScheduleDate, "M月d日(E)", { locale: ja })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={selectedScheduleDate}
                            onSelect={(date) => date && setSelectedScheduleDate(date)}
                            locale={ja}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {todayShifts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        この日の出勤予定はありません
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border border-border bg-muted p-2 text-left min-w-[100px]">
                                セラピスト
                              </th>
                              {timeSlots.map((time) => (
                                <th key={time} className="border border-border bg-muted p-1 text-center min-w-[60px] text-xs">
                                  {time}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {todayShifts.map((shift) => {
                              const cast = casts.find(c => c.id === shift.cast_id);
                              return (
                                <tr key={shift.id}>
                                  <td className="border border-border p-2 font-medium">
                                    {cast?.name || '不明'}
                                  </td>
                                  {timeSlots.map((time) => {
                                    const inShift = isTimeSlotInShift(shift, time);
                                    const isBooked = isTimeSlotBooked(shift.cast_id, time);
                                    
                                    return (
                                      <td 
                                        key={time} 
                                        className={cn(
                                          "border border-border p-1 text-center text-xs",
                                          !inShift && "bg-gray-100 dark:bg-gray-800",
                                          inShift && !isBooked && "bg-green-100 dark:bg-green-900/30",
                                          inShift && isBooked && "bg-red-100 dark:bg-red-900/30"
                                        )}
                                      >
                                        {inShift && (
                                          <span className={cn(
                                            "font-semibold",
                                            isBooked ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"
                                          )}>
                                            {isBooked ? "予約" : "空"}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="flex gap-4 mt-3 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 border border-border"></div>
                            <span>予約可能</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 border border-border"></div>
                            <span>予約済み</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 border border-border"></div>
                            <span>勤務外</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>予約検索</Label>
                    <Input
                      placeholder="顧客名または電話番号で検索"
                      value={reservationSearchTerm}
                      onChange={(e) => setReservationSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="w-48">
                    <Label>ステータスフィルター</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        <SelectItem value="pending">予約確認中</SelectItem>
                        <SelectItem value="confirmed">予約確定</SelectItem>
                        <SelectItem value="completed">完了</SelectItem>
                        <SelectItem value="cancelled">キャンセル</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4">
                  {filteredReservations.length === 0 ? (
                    <Card>
                      <CardContent className="flex items-center justify-center py-8">
                        <p className="text-muted-foreground">予約がありません</p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredReservations.map((reservation) => (
                      <Card key={reservation.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(reservation.status)}>
                                  {getStatusText(reservation.status)}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(reservation.reservation_date), 'M月d日(E)', { locale: ja })}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm">
                                    <User size={16} className="text-muted-foreground" />
                                    <span className="font-medium">{reservation.customer_name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Phone size={16} />
                                    <span>{reservation.customer_phone}</span>
                                  </div>
                                </div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock size={16} className="text-muted-foreground" />
                                    <span>{reservation.start_time} ({reservation.duration}分)</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <CreditCard size={16} className="text-muted-foreground" />
                                    <span className="font-medium">¥{reservation.price.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t">
                                <div className="text-sm">
                                  <p><span className="text-muted-foreground">セラピスト:</span> {reservation.casts?.name}</p>
                                  <p><span className="text-muted-foreground">コース:</span> {reservation.course_name}</p>
                                  {reservation.nomination_type && (
                                    <p><span className="text-muted-foreground">指名:</span> {reservation.nomination_type}</p>
                                  )}
                                  {reservation.options && reservation.options.length > 0 && (
                                    <p><span className="text-muted-foreground">オプション:</span> {reservation.options.join(', ')}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {isAdmin && (
                                <>
                                  <div className="flex gap-2">
                                    <Select
                                      value={reservation.status}
                                      onValueChange={(value) => handleStatusChange(reservation.id, value)}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">確認中</SelectItem>
                                        <SelectItem value="confirmed">確定</SelectItem>
                                        <SelectItem value="completed">完了</SelectItem>
                                        <SelectItem value="cancelled">キャンセル</SelectItem>
                                        <SelectItem value="no_show">No Show</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      onClick={() => handleDeleteReservation(reservation.id)}
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGenerateSMS(reservation)}
                                    disabled={generatingSMS === reservation.id}
                                    className="w-full"
                                  >
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    {generatingSMS === reservation.id ? "生成中..." : "SMS生成"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>SMS メッセージ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={8}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                文字数: {smsMessage.length}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(smsMessage);
                  toast({
                    title: "コピーしました",
                    description: "SMSメッセージをクリップボードにコピーしました",
                  });
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                コピー
              </Button>
              <Button onClick={() => setShowSmsDialog(false)}>
                閉じる
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
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
