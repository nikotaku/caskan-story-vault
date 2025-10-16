import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, Edit, Trash2, Search, Calendar as CalendarIcon, User, Phone, Clock, CreditCard } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Cast {
  id: string;
  name: string;
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
  price: number;
  status: string;
  payment_status: string;
  notes: string | null;
  casts?: { name: string };
}

export default function Reservations() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    cast_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    reservation_date: new Date(),
    start_time: "14:00",
    duration: 60,
    course_name: "60分コース",
    price: 12000,
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
      fetchReservations();
      
      const channel = supabase
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
    } finally {
      setLoading(false);
    }
  };

  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = 
      reservation.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.customer_phone.includes(searchTerm);
    const matchesStatus = filterStatus === "all" || reservation.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAddReservation = async () => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ予約を追加できます",
        variant: "destructive",
      });
      return;
    }

    if (!formData.cast_id || !formData.customer_name || !formData.customer_phone) {
      toast({
        title: "入力エラー",
        description: "必須項目を入力してください",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('reservations')
        .insert([{
          cast_id: formData.cast_id,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_email: formData.customer_email || null,
          reservation_date: format(formData.reservation_date, 'yyyy-MM-dd'),
          start_time: formData.start_time,
          duration: formData.duration,
          course_name: formData.course_name,
          price: formData.price,
          notes: formData.notes || null,
          created_by: user!.id,
        }]);

      if (error) throw error;

      toast({
        title: "予約追加",
        description: "新しい予約が追加されました",
      });
      
      setIsAddDialogOpen(false);
      setFormData({
        cast_id: "",
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        reservation_date: new Date(),
        start_time: "14:00",
        duration: 60,
        course_name: "60分コース",
        price: 12000,
        notes: "",
      });
    } catch (error) {
      console.error('Error adding reservation:', error);
      toast({
        title: "エラー",
        description: "予約の追加に失敗しました",
        variant: "destructive",
      });
    }
  };

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
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-6 md:ml-[240px]">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">予約管理</h1>
                <p className="text-muted-foreground">予約の登録・管理・ステータス確認</p>
              </div>
              
              {isAdmin && (
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus size={16} />
                      新規予約
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>新しい予約を追加</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="customer_name">お客様名</Label>
                          <Input 
                            id="customer_name" 
                            placeholder="山田太郎"
                            value={formData.customer_name}
                            onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer_phone">電話番号</Label>
                          <Input 
                            id="customer_phone" 
                            placeholder="090-1234-5678"
                            value={formData.customer_phone}
                            onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="customer_email">メールアドレス（任意）</Label>
                        <Input 
                          id="customer_email" 
                          type="email"
                          placeholder="example@email.com"
                          value={formData.customer_email}
                          onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label>キャスト</Label>
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
                        <Label>予約日</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !formData.reservation_date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.reservation_date ? format(formData.reservation_date, "PPP", { locale: ja }) : <span>日付を選択</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.reservation_date}
                              onSelect={(date) => date && setFormData({...formData, reservation_date: date})}
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
                          <Label htmlFor="duration">所要時間（分）</Label>
                          <Select
                            value={formData.duration.toString()}
                            onValueChange={(value) => setFormData({...formData, duration: parseInt(value)})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="60">60分</SelectItem>
                              <SelectItem value="90">90分</SelectItem>
                              <SelectItem value="120">120分</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="course_name">コース名</Label>
                          <Input
                            id="course_name"
                            placeholder="60分コース"
                            value={formData.course_name}
                            onChange={(e) => setFormData({...formData, course_name: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="price">料金</Label>
                          <Input
                            id="price"
                            type="number"
                            placeholder="12000"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: parseInt(e.target.value)})}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="notes">備考</Label>
                        <Textarea
                          id="notes"
                          rows={3}
                          placeholder="特記事項があれば入力..."
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        />
                      </div>
                      
                      <Button onClick={handleAddReservation} className="w-full">
                        予約追加
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Search and Filter */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="お客様名・電話番号で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全ステータス</SelectItem>
                      <SelectItem value="pending">予約確認中</SelectItem>
                      <SelectItem value="confirmed">予約確定</SelectItem>
                      <SelectItem value="completed">完了</SelectItem>
                      <SelectItem value="cancelled">キャンセル</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Reservations List */}
            <div className="grid gap-4">
              {filteredReservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-center">
                        <Badge className={getStatusColor(reservation.status)}>
                          {getStatusText(reservation.status)}
                        </Badge>
                        <Badge variant="outline">
                          {reservation.payment_status === 'paid' ? '支払済' : '未払い'}
                        </Badge>
                      </div>
                      {isAdmin && (
                        <Select
                          value={reservation.status}
                          onValueChange={(value) => handleStatusChange(reservation.id, value)}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">予約確認中</SelectItem>
                            <SelectItem value="confirmed">予約確定</SelectItem>
                            <SelectItem value="completed">完了</SelectItem>
                            <SelectItem value="cancelled">キャンセル</SelectItem>
                            <SelectItem value="no_show">No Show</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User size={16} className="text-muted-foreground" />
                          <span className="font-medium">{reservation.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone size={16} className="text-muted-foreground" />
                          <span>{reservation.customer_phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User size={16} className="text-muted-foreground" />
                          <span>担当: {reservation.casts?.name}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarIcon size={16} className="text-muted-foreground" />
                          <span>{format(parseISO(reservation.reservation_date), 'yyyy年M月d日(E)', { locale: ja })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock size={16} className="text-muted-foreground" />
                          <span>{reservation.start_time.slice(0, 5)} ({reservation.duration}分)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCard size={16} className="text-muted-foreground" />
                          <span className="font-medium">¥{reservation.price.toLocaleString()}</span>
                          <span className="text-muted-foreground">({reservation.course_name})</span>
                        </div>
                      </div>
                    </div>
                    {reservation.notes && (
                      <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                        備考: {reservation.notes}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toast({
                            title: "編集機能",
                            description: "編集機能は近日実装予定です",
                          })}
                        >
                          <Edit size={14} />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteReservation(reservation.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} />
                          削除
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredReservations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {reservations.length === 0 
                  ? "予約がありません" 
                  : "検索条件に一致する予約が見つかりません"}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
