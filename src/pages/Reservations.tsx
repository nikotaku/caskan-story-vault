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
  course_type: string | null;
  options: string[] | null;
  nomination_type: string | null;
  price: number;
  status: string;
  payment_status: string;
  notes: string | null;
  casts?: { name: string };
}

interface BackRate {
  id: string;
  course_type: string;
  duration: number;
  customer_price: number;
  therapist_back: number;
}

interface OptionRate {
  id: string;
  option_name: string;
  customer_price: number;
  therapist_back: number;
}

interface NominationRate {
  id: string;
  nomination_type: string;
  customer_price: number;
  therapist_back: number | null;
}

export default function Reservations() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
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
      fetchRates();
      
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

  // Calculate price when course, options, or nomination changes
  useEffect(() => {
    calculatePrice();
  }, [formData.course_type, formData.duration, formData.selectedOptions, formData.nomination_type, backRates, optionRates, nominationRates]);

  const fetchRates = async () => {
    try {
      const { data: backData } = await supabase
        .from('back_rates')
        .select('*');
      
      const { data: optionData } = await supabase
        .from('option_rates')
        .select('*');
      
      const { data: nominationData } = await supabase
        .from('nomination_rates')
        .select('*');

      if (backData) setBackRates(backData);
      if (optionData) setOptionRates(optionData);
      if (nominationData) setNominationRates(nominationData);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const calculatePrice = () => {
    let totalPrice = 0;

    // Base course price
    const matchingRate = backRates.find(
      rate => rate.course_type === formData.course_type && rate.duration === formData.duration
    );
    if (matchingRate) {
      totalPrice += matchingRate.customer_price;
    }

    // Add options
    formData.selectedOptions.forEach(optionName => {
      const matchingOption = optionRates.find(opt => opt.option_name === optionName);
      if (matchingOption) {
        totalPrice += matchingOption.customer_price;
      }
    });

    // Add nomination fee
    if (formData.nomination_type && formData.nomination_type !== 'none') {
      const matchingNomination = nominationRates.find(
        nom => nom.nomination_type === formData.nomination_type
      );
      if (matchingNomination) {
        totalPrice += matchingNomination.customer_price;
      }
    }

    setFormData(prev => ({ ...prev, price: totalPrice }));
  };

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
          course_type: formData.course_type,
          course_name: formData.course_name,
          options: formData.selectedOptions,
          nomination_type: formData.nomination_type === 'none' ? null : formData.nomination_type,
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
        nomination_type: "none",
        reservation_date: new Date(),
        start_time: "14:00",
        end_time: "15:00",
        duration: 80,
        room: "",
        course_type: "aroma",
        course_name: "80分 アロマオイルコース",
        selectedOptions: [],
        price: 12000,
        payment_method: "cash",
        reservation_method: "",
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
                          <Label htmlFor="customer_name">予約者</Label>
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
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="customer_email">メールアドレス</Label>
                          <Input 
                            id="customer_email" 
                            type="email"
                            placeholder="example@email.com"
                            value={formData.customer_email}
                            onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label>指名</Label>
                          <Select
                            value={formData.nomination_type}
                            onValueChange={(value) => setFormData({...formData, nomination_type: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">指名なし</SelectItem>
                              <SelectItem value="ネット指名">ネット指名</SelectItem>
                              <SelectItem value="本指名">本指名</SelectItem>
                              <SelectItem value="姫予約">姫予約</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
                        <Label>ルーム</Label>
                        <Select
                          value={formData.room}
                          onValueChange={(value) => setFormData({...formData, room: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="本指定" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">本指定</SelectItem>
                            <SelectItem value="1room">1room</SelectItem>
                            <SelectItem value="2room">2room</SelectItem>
                            <SelectItem value="3room">3room</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>コースタイプ</Label>
                          <Select
                            value={formData.course_type}
                            onValueChange={(value) => {
                              const courseType = value;
                              let courseName = "";
                              if (courseType === "aroma") {
                                courseName = `${formData.duration}分 アロマオイルコース`;
                              } else if (courseType === "zenryoku") {
                                courseName = `${formData.duration}分 全力コース`;
                              }
                              setFormData({...formData, course_type: courseType, course_name: courseName});
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aroma">アロマオイルコース</SelectItem>
                              <SelectItem value="zenryoku">全力コース（無限DR/🔥）</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>時間</Label>
                          <Select
                            value={formData.duration.toString()}
                            onValueChange={(value) => {
                              const duration = parseInt(value);
                              let courseName = "";
                              if (formData.course_type === "aroma") {
                                courseName = `${duration}分 アロマオイルコース`;
                              } else if (formData.course_type === "zenryoku") {
                                courseName = `${duration}分 全力コース`;
                              }
                              setFormData({...formData, duration, course_name: courseName});
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {formData.course_type === "aroma" ? (
                                <>
                                  <SelectItem value="80">80分</SelectItem>
                                  <SelectItem value="100">100分</SelectItem>
                                  <SelectItem value="120">120分</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="60">60分</SelectItem>
                                  <SelectItem value="80">80分</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>オプション</Label>
                        <div className="space-y-2 mt-2">
                          {optionRates.map((option) => (
                            <div key={option.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`option-${option.id}`}
                                checked={formData.selectedOptions.includes(option.option_name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      selectedOptions: [...formData.selectedOptions, option.option_name]
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      selectedOptions: formData.selectedOptions.filter(o => o !== option.option_name)
                                    });
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor={`option-${option.id}`} className="text-sm">
                                {option.option_name} (+¥{option.customer_price.toLocaleString()})
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>合計金額:</span>
                          <span>¥{formData.price.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div>
                        <Label>支払い方法</Label>
                        <Select
                          value={formData.payment_method}
                          onValueChange={(value) => setFormData({...formData, payment_method: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">現金</SelectItem>
                            <SelectItem value="card">カード（手数料10%）</SelectItem>
                            <SelectItem value="paypay">PayPay（手数料10%）</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>予約方法</Label>
                        <Select
                          value={formData.reservation_method}
                          onValueChange={(value) => setFormData({...formData, reservation_method: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="未指定" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="phone">電話</SelectItem>
                            <SelectItem value="web">WEB</SelectItem>
                            <SelectItem value="line">LINE</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="twitter">Twitter</SelectItem>
                            <SelectItem value="other">その他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="notes">予約内容と要望</Label>
                        <Textarea
                          id="notes"
                          rows={4}
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
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">コース: </span>
                          <span>{reservation.course_name}</span>
                        </div>
                        {reservation.options && reservation.options.length > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">オプション: </span>
                            <span>{reservation.options.join(', ')}</span>
                          </div>
                        )}
                        {reservation.nomination_type && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">指名: </span>
                            <span>{reservation.nomination_type}</span>
                          </div>
                        )}
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
