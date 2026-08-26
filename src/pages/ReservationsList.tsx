import { useState, useEffect } from "react";
import { toExtTime, toStoredTime } from "@/lib/timeFormat";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ReservationForm, ReservationFormData } from "@/components/ReservationForm";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { postToSheet } from "@/lib/sheetWebhook";
import { addDays, format, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { Search, FileUp, Table2, Plus, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImportModal } from "@/components/ImportModal";
import { GoogleSheetPanel } from "@/components/GoogleSheetPanel";
import { mapReservationRows, batchInsert } from "@/lib/importMappers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ENKA_STORE_ID } from "@/lib/storeSwitch";

interface Reservation {
  id: string;
  cast_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  reservation_date: string;
  start_time: string;
  duration: number;
  course_type: string | null;
  course_name: string;
  options: string[] | null;
  nomination_type: string | null;
  price: number;
  discount: number | null;
  discount_ids: string[] | null;
  payment_method: string | null;
  payment_fee: number | null;
  payment_details: ReservationFormData["payment_details"];
  reservation_method: string | null;
  notes: string | null;
  room: string | null;
  status: string;
  store_id: string;
  casts: { name: string } | null;
}

interface Cast { id: string; name: string; store_id: string; is_active: boolean; }
interface Room { id: string; name: string; address: string | null; store_id: string; }
interface BackRate { id: string; course_type: string; duration: number; customer_price: number; therapist_back: number; store_id: string; }
interface OptionRate { id: string; option_name: string; customer_price: number; therapist_back: number; store_id: string; }
interface NominationRate { id: string; nomination_type: string; customer_price: number; therapist_back: number | null; store_id: string; }
interface Discount { id: string; name: string; discount_type: "fixed" | "percentage"; discount_value: number; is_active: boolean; store_id: string; }

function forStore<T extends { store_id: string }>(items: T[], storeId: string): T[] {
  return items.filter((item) => item.store_id === storeId);
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-900",
  hold: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-rose-100 text-rose-700",
  // 旧ステータス（後方互換）
  pending: "bg-blue-100 text-blue-900",
  sms_waiting: "bg-blue-100 text-blue-900",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "確定",
  hold: "保留",
  completed: "完了",
  cancelled: "キャンセル",
};

export default function ReservationsList() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editFormData, setEditFormData] = useState({
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
    course_type: "アロマオイル",
    course_name: "アロマオイル 80分",
    selectedOptions: [] as string[],
    discount_ids: [] as string[],
    discount: 0,
    price: 12000,
    payment_method: "cash",
    payment_fee: 0,
    payment_details: null as { method: string; amount: number }[] | null,
    reservation_method: "",
    notes: "",
  });
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
    course_type: "アロマオイル",
    course_name: "アロマオイル 80分",
    selectedOptions: [] as string[],
    discount_ids: [] as string[],
    discount: 0,
    price: 12000,
    payment_method: "cash",
    payment_fee: 0,
    payment_details: null as { method: string; amount: number }[] | null,
    reservation_method: "",
    notes: "",
  });

  const { user, loading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchReservations();
      fetchCasts();
      fetchRooms();
      fetchRates();
    }
  }, [user]);

  const fetchCasts = async () => {
    const { data } = await supabase.from("casts").select("id, name, store_id, is_active").order("name");
    setCasts(data || []);
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from("rooms").select("id, name, address, store_id").eq("is_active", true).order("name");
    setRooms(data || []);
  };

  const fetchRates = async () => {
    const [{ data: backData }, { data: optionData }, { data: nominationData }, { data: discountData }] = await Promise.all([
      supabase.from("back_rates").select("*").order("display_order"),
      supabase.from("option_rates").select("*").order("display_order"),
      supabase.from("nomination_rates").select("*"),
      supabase.from("discounts").select("id, name, discount_type, discount_value, is_active, store_id").eq("is_active", true).order("name"),
    ]);
    if (backData) setBackRates(backData);
    if (optionData) setOptionRates(optionData);
    if (nominationData) setNominationRates(nominationData);
    if (discountData) setDiscounts(discountData as Discount[]);
  };

  const handleAddReservation = async (submittedFormData: ReservationFormData) => {
    if (!isAdmin) {
      toast({ title: "権限エラー", description: "管理者のみ予約を追加できます", variant: "destructive" });
      return;
    }
    if (!submittedFormData.cast_id || !submittedFormData.customer_name || !submittedFormData.customer_phone) {
      toast({ title: "入力エラー", description: "必須項目を入力してください", variant: "destructive" });
      return;
    }
    try {
      const storedStart = toStoredTime(submittedFormData.start_time);
      const storedDate = addDays(submittedFormData.reservation_date, storedStart.dayOffset);
      const { error } = await supabase.from("reservations").insert([{
        cast_id: submittedFormData.cast_id,
        customer_name: submittedFormData.customer_name,
        customer_phone: submittedFormData.customer_phone,
        customer_email: submittedFormData.customer_email || null,
        reservation_date: format(storedDate, "yyyy-MM-dd"),
        start_time: storedStart.time,
        duration: submittedFormData.duration,
        course_type: submittedFormData.course_type,
        course_name: submittedFormData.course_name,
        options: submittedFormData.selectedOptions,
        nomination_type: submittedFormData.nomination_type === "none" ? null : submittedFormData.nomination_type,
        price: submittedFormData.price,
        discount: submittedFormData.discount,
        payment_method: submittedFormData.payment_details ? null : (submittedFormData.payment_method || "cash"),
        payment_fee: submittedFormData.payment_fee || 0,
        payment_details: submittedFormData.payment_details,
        notes: submittedFormData.notes || null,
        room: submittedFormData.room || null,
        store_id: ENKA_STORE_ID,
        created_by: user!.id,
      }]);
      if (error) throw error;
      postToSheet("reservation", {
        reservation_date: format(storedDate, "yyyy-MM-dd"),
        start_time: storedStart.time,
        customer_name: submittedFormData.customer_name,
        customer_phone: submittedFormData.customer_phone,
        customer_email: submittedFormData.customer_email || "",
        cast_name: casts.find((c) => c.id === submittedFormData.cast_id)?.name || "",
        course_name: submittedFormData.course_name,
        nomination_type: submittedFormData.nomination_type === "none" ? "" : submittedFormData.nomination_type,
        room: submittedFormData.room || "",
        discount: submittedFormData.discount,
        price: submittedFormData.price,
        created_at: new Date().toISOString(),
      });
      toast({ title: "予約追加", description: "新しい予約が追加されました" });
      setIsAddDialogOpen(false);
      setFormData({
        cast_id: "", customer_name: "", customer_phone: "", customer_email: "",
        nomination_type: "none", reservation_date: new Date(), start_time: "14:00", end_time: "15:00",
        duration: 80, room: "", course_type: "アロマオイル", course_name: "アロマオイル 80分",
        selectedOptions: [], discount_ids: [] as string[], discount: 0, price: 12000,
        payment_method: "cash", payment_fee: 0, payment_details: null, reservation_method: "", notes: "",
      });
      fetchReservations();
    } catch (error) {
      console.error("Error adding reservation:", error);
      toast({ title: "エラー", description: "予約の追加に失敗しました", variant: "destructive" });
    }
  };

  const openEditSheet = (res: Reservation) => {
    setEditingReservation(res);
    const [h, m] = res.start_time.slice(0, 5).split(":").map(Number);
    const endMin = (h < 6 ? h + 24 : h) * 60 + m + res.duration;
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    const storedDate = new Date(`${res.reservation_date}T00:00:00`);
    const displayTime = toExtTime(res.start_time);
    const displayDate = displayTime !== res.start_time.slice(0, 5) ? subDays(storedDate, 1) : storedDate;
    setEditFormData({
      cast_id: res.cast_id || "",
      customer_name: res.customer_name,
      customer_phone: res.customer_phone,
      customer_email: res.customer_email || "",
      nomination_type: res.nomination_type || "none",
      reservation_date: displayDate,
      start_time: displayTime,
      end_time: `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
      duration: res.duration,
      room: res.room || "",
      course_type: res.course_type || "アロマオイル",
      course_name: res.course_name,
      selectedOptions: res.options || [],
      discount_ids: res.discount_ids || [],
      discount: res.discount || 0,
      price: res.price,
      payment_method: res.payment_method || "cash",
      payment_fee: res.payment_fee || 0,
      payment_details: res.payment_details || null,
      reservation_method: res.reservation_method || "",
      notes: res.notes || "",
    });
    setIsEditOpen(true);
  };

  const handleUpdateReservation = async (submittedFormData: ReservationFormData) => {
    if (!editingReservation) return;
    try {
      const storedStart = toStoredTime(submittedFormData.start_time);
      const storedDate = addDays(submittedFormData.reservation_date, storedStart.dayOffset);
      // Recompute price from master data to avoid stale-state race conditions
      const backRate = backRates.find((r) => r.course_type === submittedFormData.course_type && r.duration === submittedFormData.duration);
      let subtotal = backRate?.customer_price ?? 0;
      (submittedFormData.selectedOptions ?? []).forEach((optName) => {
        subtotal += optionRates.find((r) => r.option_name === optName)?.customer_price ?? 0;
      });
      if (submittedFormData.nomination_type && submittedFormData.nomination_type !== "none") {
        subtotal += nominationRates.find((r) => r.nomination_type === submittedFormData.nomination_type)?.customer_price ?? 0;
      }
      let discountAmt = 0;
      for (const discId of (submittedFormData.discount_ids ?? [])) {
        const d = discounts.find((x) => x.id === discId);
        if (d) {
          discountAmt += d.discount_type === "percentage"
            ? Math.round((subtotal * d.discount_value) / 100)
            : d.discount_value;
        }
      }
      discountAmt = Math.min(discountAmt, subtotal);
      const computedPrice = subtotal > 0 ? subtotal - discountAmt : submittedFormData.price;
      const computedDiscount = subtotal > 0 ? discountAmt : (submittedFormData.discount ?? 0);
      const courseName = `${submittedFormData.course_type} ${submittedFormData.duration}分`;

      const { error } = await supabase.from("reservations").update({
        cast_id: submittedFormData.cast_id || null,
        customer_name: submittedFormData.customer_name,
        customer_phone: submittedFormData.customer_phone,
        customer_email: submittedFormData.customer_email || null,
        reservation_date: format(storedDate, "yyyy-MM-dd"),
        start_time: storedStart.time,
        duration: submittedFormData.duration,
        course_type: submittedFormData.course_type,
        course_name: courseName,
        options: submittedFormData.selectedOptions,
        nomination_type: submittedFormData.nomination_type === "none" ? null : submittedFormData.nomination_type,
        price: computedPrice,
        discount: computedDiscount,
        discount_ids: submittedFormData.discount_ids,
        payment_method: submittedFormData.payment_details ? null : (submittedFormData.payment_method || "cash"),
        payment_fee: submittedFormData.payment_fee || 0,
        payment_details: submittedFormData.payment_details,
        notes: submittedFormData.notes || null,
        room: submittedFormData.room || null,
      }).eq("id", editingReservation.id);
      if (error) throw error;
      toast({ title: "更新完了", description: "予約情報を更新しました" });
      setIsEditOpen(false);
      setEditingReservation(null);
      fetchReservations();
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast({ title: "エラー", description: "予約の更新に失敗しました", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("reservations").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast({ title: "エラー", description: "ステータス変更に失敗しました", variant: "destructive" });
    } else {
      setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    }
  };

  const handleDeleteReservation = async (id: string) => {
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) {
      toast({ title: "エラー", description: "予約の削除に失敗しました", variant: "destructive" });
    } else {
      toast({ title: "削除完了", description: "予約を削除しました" });
      setReservations((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmId(null);
    }
  };

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, casts(name)")
        .order("reservation_date", { ascending: false })
        .limit(5000);

      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error("Error fetching reservations:", error);
    } finally {
      setLoading(false);
    }
  };

  // データに存在する月（yyyy-MM）を新しい順で列挙
  const availableMonths = Array.from(
    new Set(reservations.map((r) => r.reservation_date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const filteredReservations = reservations.filter((res) => {
    const matchesSearch =
      res.customer_name.includes(searchQuery) ||
      res.customer_phone.includes(searchQuery) ||
      res.course_name.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || res.status === statusFilter;
    const matchesMonth = monthFilter === "all" || res.reservation_date.slice(0, 7) === monthFilter;
    return matchesSearch && matchesStatus && matchesMonth;
  });

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">予約一覧</h1>
              <p className="text-muted-foreground">全ての予約を確認・管理</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Sheet open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <SheetTrigger asChild>
                    <Button><Plus size={16} className="mr-2" />新規予約</Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>新しい予約を追加</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <ReservationForm
                        formData={formData}
                        setFormData={setFormData}
                        casts={forStore(casts.filter((cast) => cast.is_active), ENKA_STORE_ID)}
                        rooms={forStore(rooms, ENKA_STORE_ID)}
                        backRates={forStore(backRates, ENKA_STORE_ID)}
                        optionRates={forStore(optionRates, ENKA_STORE_ID)}
                        nominationRates={forStore(nominationRates, ENKA_STORE_ID)}
                        discounts={forStore(discounts, ENKA_STORE_ID)}
                        storeId={ENKA_STORE_ID}
                        onSubmit={handleAddReservation}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                <FileUp size={16} className="mr-2" />CSVインポート
              </Button>
            </div>
          </div>

          <Tabs defaultValue="db" className="mb-6">
            <TabsList>
              <TabsTrigger value="db">データベース</TabsTrigger>
              <TabsTrigger value="sheet" className="gap-1.5">
                <Table2 size={13} />Googleスプレッドシート
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sheet" className="mt-4">
              <GoogleSheetPanel
                source="reservations"
                onImport={async (headers, rows) => {
                  const { data: castData } = await supabase.from("casts").select("id, name").eq("is_active", true);
                  const castMap = new Map<string, string>();
                  (castData || []).forEach((c: { id: string; name: string }) => castMap.set(c.name, c.id));
                  const mapped = mapReservationRows(headers, rows, castMap);
                  if (mapped.length === 0 && rows.length > 0) {
                    throw new Error(
                      `日付を認識できる行がありませんでした。「予約日」列の日付形式をご確認ください（検出した列: ${headers.filter(Boolean).join(" / ")}）`
                    );
                  }
                  const count = await batchInsert("reservations", mapped);
                  await fetchReservations();
                  return count;
                }}
              />
            </TabsContent>
            <TabsContent value="db">

          {/* 検索・フィルター */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <Search size={18} className="text-muted-foreground" />
                    <Input
                      placeholder="顧客名・電話番号・コース名で検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全期間</SelectItem>
                    {availableMonths.map((m) => {
                      const [y, mo] = m.split("-");
                      return (
                        <SelectItem key={m} value={m}>{`${y}年${Number(mo)}月`}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全て</SelectItem>
                    <SelectItem value="confirmed">確定</SelectItem>
                    <SelectItem value="hold">保留</SelectItem>
                    <SelectItem value="completed">完了</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 予約テーブル */}
          {loading ? (
            <div className="text-center text-muted-foreground">読み込み中...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              予約がありません
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">日付</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">時間</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">顧客名</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">電話番号</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">セラピスト</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">コース</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">料金</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">ステータス</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredReservations.map((res) => (
                      <tr key={res.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const storedDate = new Date(`${res.reservation_date}T00:00:00`);
                            const businessDate = toExtTime(res.start_time) !== res.start_time.slice(0, 5)
                              ? subDays(storedDate, 1)
                              : storedDate;
                            return format(businessDate, "yyyy/MM/dd", { locale: ja });
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {toExtTime(res.start_time)}<span className="text-muted-foreground ml-1">({res.duration}分)</span>
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{res.customer_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{res.customer_phone}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{res.casts?.name ?? <span className="text-muted-foreground">未設定</span>}</td>
                        <td className="px-4 py-3">{res.course_name}</td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">¥{res.price.toLocaleString()}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Select
                            value={res.status}
                            onValueChange={(v) => handleStatusChange(res.id, v)}
                          >
                            <SelectTrigger className={`h-7 text-xs border-0 px-2 w-auto ${STATUS_COLORS[res.status] ?? "bg-gray-100 text-gray-700"}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditSheet(res)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(res.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      {editingReservation && (
        <Sheet
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditingReservation(null);
          }}
        >
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>予約情報を編集</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <ReservationForm
                formData={editFormData}
                setFormData={setEditFormData}
                casts={forStore(casts.filter((cast) => cast.is_active || cast.id === editingReservation.cast_id), editingReservation.store_id)}
                rooms={forStore(rooms, editingReservation.store_id)}
                backRates={forStore(backRates, editingReservation.store_id)}
                optionRates={forStore(optionRates, editingReservation.store_id)}
                nominationRates={forStore(nominationRates, editingReservation.store_id)}
                discounts={forStore(discounts, editingReservation.store_id)}
                storeId={editingReservation.store_id}
                onSubmit={handleUpdateReservation}
                submitLabel="更新する"
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
      <ImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="reservations"
        onSuccess={fetchReservations}
      />
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予約を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。予約データが完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDeleteReservation(deleteConfirmId)}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
