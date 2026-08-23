import { useEffect, useState, useCallback, useMemo } from "react";
import { toExtTime } from "@/lib/timeFormat";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckCircle, RefreshCw, ChevronDown, ChevronUp, Check } from "lucide-react";
import checkoutMirrorImg from "@/assets/checkout-mirror.jpeg";
import checkoutDoorknobImg from "@/assets/checkout-doorknob.jpeg";
import checkoutLaundryImg from "@/assets/checkout-laundry.png";
import checkoutClosetImg from "@/assets/checkout-closet.jpeg";
import checkoutSandalsImg from "@/assets/checkout-sandals.jpeg";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { calcPaymentFee, findPaymentSetting, PaymentSetting } from "@/lib/paymentFee";

interface Cast {
  id: string;
  name: string;
  photo: string | null;
}

interface PaymentDetail {
  method: string;
  amount: number;
}

interface Reservation {
  id: string;
  customer_name: string;
  start_time: string;
  course_name: string;
  course_type: string | null;
  duration: number | null;
  options: string[] | null;
  discount: number | null;
  discount_ids: string[] | null;
  price: number;
  payment_method: string;
  payment_details: PaymentDetail[] | null;
  status: string;
  nomination_type: string | null;
  payment_fee: number | null;
}

interface BackRate {
  id: string;
  course_type: string;
  duration: number;
  customer_price: number;
}

interface OptionRate {
  id: string;
  option_name: string;
  customer_price: number;
}

interface NominationRate {
  id: string;
  nomination_type: string;
  customer_price: number;
}

interface SalesMasters {
  back_rates: BackRate[];
  option_rates: OptionRate[];
  nomination_rates: NominationRate[];
  payment_settings: PaymentSetting[];
}

interface EditState {
  course_type: string;
  duration: number;
  selectedOptions: string[];
  discount_amount: number;
  payment_method: string;
  nomination_type: string;
}

// 割引プルダウンの選択肢（1,000円〜5,000円）
const DISCOUNT_OPTIONS = [0, 1000, 2000, 3000, 4000, 5000];

const PAYMENT_METHODS = [
  { value: "cash", label: "現金" },
  { value: "card", label: "カード" },
  { value: "paypay", label: "PayPay" },
];

const normalizePaymentMethod = (value?: string | null) => {
  const raw = (value || "cash").toLowerCase();
  if (raw === "card" || raw.includes("カード") || raw.includes("クレジット")) return "card";
  if (raw === "paypay" || raw.includes("ペイペイ")) return "paypay";
  return "cash";
};

const businessDateForStart = (dayStartTime: string) => {
  const [startHour, startMinute] = dayStartTime.split(":").map(Number);
  const now = new Date();
  const beforeStart = now.getHours() * 60 + now.getMinutes() < startHour * 60 + startMinute;
  return format(beforeStart ? addDays(now, -1) : now, "yyyy-MM-dd");
};

export default function TherapistCheckout() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStep = searchParams.get("step") ?? "sales";
  const [activeTab, setActiveTab] = useState(initialStep);
  const [cast, setCast] = useState<Cast | null>(null);
  const [castStoreId, setCastStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [nextShift, setNextShift] = useState<{ shift_date: string; room: string | null } | null>(null);

  // 予約データ
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [paymentEdits, setPaymentEdits] = useState<Record<string, string>>({});
  const [paymentSavingId, setPaymentSavingId] = useState<string | null>(null);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => businessDateForStart("10:00:00"));

  // マスターデータ
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);

  // インライン編集
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // 売上メモ・手動調整
  const [salesNotes, setSalesNotes] = useState("");
  const [manualAdjustment, setManualAdjustment] = useState(0);

  const [cleaning, setCleaning] = useState({
    room_cleaned: false,
    supplies_stocked: false,
    trash_taken_out: false,
    equipment_checked: false,
    notes: "",
  });

  // 清掃チェックリスト用チェック状態
  const [cleaningChecks, setCleaningChecks] = useState({
    mirror: false,
    doorknob: false,
    quickle: false,
    laundry: false,
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    wiping: true,
    laundry: true,
    tidying: true,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleCheck = (key: keyof typeof cleaningChecks) =>
    setCleaningChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  const [feedback, setFeedback] = useState({
    rating: 5,
    good_points: "",
    improvement_points: "",
    customer_feedback: "",
  });

  useEffect(() => {
    if (!token) { navigate("/"); return; }
    const fetchCast = async () => {
      try {
        const { data, error } = await supabase.rpc("get_cast_by_access_token", { p_token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) { navigate("/"); return; }
        const castRow = row as Cast;
        setCast(castRow);
        const { data: castStore } = await supabase
          .from("casts")
          .select("store_id")
          .eq("id", castRow.id)
          .maybeSingle();
        if (castStore?.store_id) {
          const { data: shopSettings } = await supabase
            .from("shop_settings")
            .select("business_day_start")
            .eq("store_id", castStore.store_id)
            .limit(1)
            .maybeSingle();
          const configuredStart = (shopSettings as { business_day_start?: string } | null)?.business_day_start || "10:00";
          const resolvedStart = configuredStart.length === 5 ? `${configuredStart}:00` : configuredStart;
          setSelectedDate(businessDateForStart(resolvedStart));
          setCastStoreId(castStore.store_id);
        }
      } catch {
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    fetchCast();
  }, [token, navigate]);

  // マスターデータ取得
  useEffect(() => {
    if (!castStoreId || !token) return;
    supabase.rpc("get_therapist_sales_masters", { p_token: token }).then(({ data, error }) => {
      if (error) {
        toast.error("料金情報の取得に失敗しました");
        return;
      }
      const masters = data as unknown as SalesMasters;
      setBackRates(masters?.back_rates || []);
      setOptionRates(masters?.option_rates || []);
      setPaymentSettings(masters?.payment_settings || []);
      setNominationRates(masters?.nomination_rates || []);
    });
  }, [castStoreId, token]);

  const courseTypes = useMemo(() => [...new Set(backRates.map(r => r.course_type))], [backRates]);

  const drOptions = useMemo(() => optionRates.filter(r => r.option_name.startsWith("DR")), [optionRates]);
  const regularOptions = useMemo(() => optionRates.filter(r => !r.option_name.startsWith("DR")), [optionRates]);

  const cardFeePct = useMemo(() => findPaymentSetting(paymentSettings, "card")?.fee_percentage ?? 0, [paymentSettings]);
  const paypayFeePct = useMemo(() => findPaymentSetting(paymentSettings, "paypay")?.fee_percentage ?? 0, [paymentSettings]);

  const fetchReservations = useCallback(async () => {
    if (!cast) return;
    setReservationsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_therapist_daily_reservations", {
        p_token: token,
        p_date: selectedDate,
      });
      if (error) throw error;
      const list = (data || []) as unknown as Reservation[];
      setReservations(list);
      const edits: Record<string, string> = {};
      list.forEach((r) => { edits[r.id] = normalizePaymentMethod(r.payment_method); });
      setPaymentEdits(edits);
    } catch {
      toast.error("予約の取得に失敗しました");
    } finally {
      setReservationsLoading(false);
    }
  }, [cast, selectedDate, token]);

  useEffect(() => {
    if (cast) fetchReservations();
  }, [cast, fetchReservations]);

  // 編集展開時に初期EditStateをセット
  const toggleExpand = (r: Reservation) => {
    if (expandedId === r.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(r.id);
    if (!editStates[r.id]) {
      const courseType = r.course_type ?? (courseTypes[0] || "");
      const duration = r.duration ?? (backRates.find(b => b.course_type === courseType)?.duration ?? 60);

      // 保存済みの割引額をそのまま初期値にする（プルダウン選択肢に無い額でも保持）
      const discount_amount = r.discount ?? 0;

      setEditStates(prev => ({
        ...prev,
        [r.id]: {
          course_type: courseType,
          duration,
          selectedOptions: r.options ?? [],
          discount_amount,
          payment_method: normalizePaymentMethod(r.payment_method),
          nomination_type: r.nomination_type ?? "none",
        },
      }));
    }
  };

  const updateEdit = (id: string, patch: Partial<EditState>) => {
    setEditStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  // 価格計算
  const calcPrice = useCallback((state: EditState): { subtotal: number; nominationFee: number; discount: number; fee: number; total: number } => {
    const backRate = backRates.find(r => r.course_type === state.course_type && r.duration === state.duration);
    let subtotal = backRate?.customer_price ?? 0;
    state.selectedOptions.forEach(opt => {
      const or = optionRates.find(r => r.option_name === opt);
      if (or) subtotal += or.customer_price;
    });
    let nominationFee = 0;
    if (state.nomination_type && state.nomination_type !== "none") {
      const nr = nominationRates.find(r => r.nomination_type === state.nomination_type);
      if (nr) nominationFee = nr.customer_price;
    }
    subtotal += nominationFee;
    const discountAmt = Math.min(state.discount_amount || 0, subtotal);
    const price = subtotal - discountAmt;
    const fee = calcPaymentFee(price, paymentSettings, state.payment_method);
    return { subtotal, nominationFee, discount: discountAmt, fee, total: price + fee };
  }, [backRates, optionRates, paymentSettings, nominationRates]);

  const handleSaveEdit = async (r: Reservation) => {
    const state = editStates[r.id];
    if (!state) return;
    const { subtotal: _, discount, fee, total } = calcPrice(state);
    const updatedPrice = total - fee;
    if (r.payment_details?.length && updatedPrice !== r.price) {
      toast.error("分割払いの予約は金額内訳の再設定が必要です。店舗へ連絡してください");
      return;
    }
    setSavingId(r.id);
    const backRate = backRates.find(b => b.course_type === state.course_type && b.duration === state.duration);
    const courseName = backRate ? `${state.course_type} ${state.duration}分` : r.course_name;
    try {
      const discountIds: string[] = r.discount_ids ?? [];
      // セラピストポータルは anon 権限のため、token 検証付きRPC経由で予約を直接更新する
      const { error } = await supabase.rpc("therapist_update_reservation", {
        p_token: token,
        p_reservation_id: r.id,
        p_course_type: state.course_type,
        p_duration: state.duration,
        p_course_name: courseName,
        p_options: state.selectedOptions,
        p_discount: discount,
        p_discount_ids: discountIds,
        p_price: updatedPrice,
        p_payment_fee: fee,
        p_payment_method: state.payment_method,
        p_nomination_type: state.nomination_type === "none" ? null : state.nomination_type,
      });
      if (error) throw error;
      setReservations(prev => prev.map(res => res.id === r.id ? {
        ...res,
        course_type: state.course_type,
        duration: state.duration,
        course_name: courseName,
        options: state.selectedOptions,
        discount,
        discount_ids: discountIds,
        price: updatedPrice,
        payment_fee: fee,
        payment_method: state.payment_method,
        nomination_type: state.nomination_type === "none" ? null : state.nomination_type,
      } : res));
      setPaymentEdits(prev => ({ ...prev, [r.id]: state.payment_method }));
      setExpandedId(null);
      toast.success("予約を更新しました");
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setSavingId(null);
    }
  };

  const handlePaymentChange = async (reservationId: string, method: string) => {
    setPaymentEdits((prev) => ({ ...prev, [reservationId]: method }));
    setPaymentSavingId(reservationId);
    try {
      const { error } = await supabase.rpc("therapist_update_payment_method", {
        p_token: token,
        p_reservation_id: reservationId,
        p_payment_method: method,
      });
      if (error) throw error;
    } catch {
      toast.error("支払い方法の更新に失敗しました");
    } finally {
      await fetchReservations();
      setPaymentSavingId(null);
    }
  };

  // 支払い方法別合計（payment_details がある場合は各エントリで集計）
  const totals = reservations.reduce(
    (acc, r) => {
      if (r.status === "cancelled") return acc;
      if (r.payment_details && r.payment_details.length > 0) {
        for (const d of r.payment_details) {
          acc[d.method] = (acc[d.method] || 0) + (d.amount || 0);
        }
      } else {
        const method = paymentEdits[r.id] || normalizePaymentMethod(r.payment_method);
        acc[method] = (acc[method] || 0) + (r.price || 0);
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const feesByMethod = reservations.reduce(
    (acc, r) => {
      if (r.status === "cancelled") return acc;
      if (r.payment_details && r.payment_details.length > 0) {
        for (const d of r.payment_details) {
          const f = calcPaymentFee(d.amount, paymentSettings, d.method);
          if (f > 0) acc[d.method] = (acc[d.method] || 0) + f;
        }
      } else {
        const method = paymentEdits[r.id] || normalizePaymentMethod(r.payment_method);
        acc[method] = (acc[method] || 0) + (r.payment_fee || 0);
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const cashBaseTotal = totals["cash"] || 0;
  const cardBaseTotal = totals["card"] || 0;
  const paypayBaseTotal = totals["paypay"] || 0;
  const cashFeeTotal = feesByMethod["cash"] || 0;
  const cardFeeTotal = feesByMethod["card"] || 0;
  const paypayFeeTotal = feesByMethod["paypay"] || 0;
  const cashTotal = cashBaseTotal + cashFeeTotal;
  const cardTotal = cardBaseTotal + cardFeeTotal;
  const paypayTotal = paypayBaseTotal + paypayFeeTotal;
  const grandTotal = cashTotal + cardTotal + paypayTotal + manualAdjustment;
  const completedCount = reservations.filter((r) => r.status !== "cancelled").length;

  const handleSalesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("therapist_submit_daily_sales", {
        p_token: token,
        p_date: selectedDate,
        p_cash_amount: cashTotal,
        p_card_amount: cardTotal,
        p_paypay_amount: paypayTotal,
        p_total_amount: grandTotal,
        p_customer_count: completedCount,
        p_manual_adjustment: manualAdjustment,
        p_notes: salesNotes || null,
      });
      if (error) throw error;
      setSubmitted("sales");
    } catch (err: any) {
      console.error("売上送信エラー:", err);
      toast.error(`送信に失敗しました：${err?.message ?? "不明なエラー"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCleaningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("cleaning_checklists").insert([{
        ...cleaning,
        date: selectedDate,
        cast_id: cast?.id,
      }]);
      if (error) throw error;
      // Mark clearance completed if one exists
      if (cast?.id) {
        await supabase
          .from("daily_clearances")
          .update({ status: "completed" })
          .eq("cast_id", cast.id)
          .eq("status", "pending");
        // Fetch next shift for greeting
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: shiftData } = await supabase
          .from("shifts")
          .select("shift_date, room")
          .eq("cast_id", cast.id)
          .eq("approval_status", "approved")
          .gt("shift_date", today)
          .order("shift_date")
          .limit(1)
          .maybeSingle();
        setNextShift(shiftData as { shift_date: string; room: string | null } | null);
      }
      setSubmitted("cleaning");
    } catch (err: any) {
      console.error("清掃チェック送信エラー:", err);
      toast.error(`送信に失敗しました：${err?.message ?? "不明なエラー"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("daily_feedback").insert([{
        ...feedback,
        date: selectedDate,
        cast_id: cast?.id,
      }]);
      if (error) throw error;
      setSubmitted("feedback");
    } catch (err: any) {
      console.error("フィードバック送信エラー:", err);
      toast.error(`送信に失敗しました：${err?.message ?? "不明なエラー"}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cast) return null;

  const SuccessCard = ({ label }: { label: string }) => (
    <Card>
      <CardContent className="pt-12 pb-12 text-center">
        <CheckCircle className="mx-auto mb-3 text-green-500" size={48} />
        <p className="font-semibold text-lg">{label}を送信しました</p>
        <Button className="mt-4" variant="outline" onClick={() => setSubmitted(null)}>戻る</Button>
      </CardContent>
    </Card>
  );

  const CleaningSuccessCard = () => (
    <Card className="border-green-200">
      <CardContent className="pt-8 pb-8 text-center space-y-4">
        <div className="text-4xl">💐</div>
        <p className="font-bold text-xl">お疲れさまでした💐</p>
        <div className="text-sm text-muted-foreground space-y-2 bg-muted/30 rounded-xl p-4 text-left">
          <p>今回の勤務により艶華より<strong className="text-primary">0.5pt</strong>が付与されました！</p>
          {nextShift ? (
            <p>
              次回の勤務は
              <strong>
                {format(new Date(nextShift.shift_date), "M月d日(E)", { locale: ja })}
                {nextShift.room ? `　${nextShift.room}ルーム` : ""}
              </strong>
              です。
            </p>
          ) : (
            <p>次回のシフトが確定したらお知らせします。</p>
          )}
          <p>本日もありがとうございました！</p>
        </div>
        <Button
          className="mt-2"
          variant="outline"
          onClick={() => navigate(`/therapist/${token}`)}
        >
          マイページに戻る
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/therapist/${token}`)}>
              <ArrowLeft size={16} className="mr-1" />マイページ
            </Button>
            <div className="flex items-center gap-3 ml-2">
              {cast.photo && (
                <img src={cast.photo} alt={cast.name} className="h-8 w-8 rounded-full object-cover" />
              )}
              <div>
                <p className="font-semibold">{cast.name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(), "yyyy年MM月dd日（E）", { locale: ja })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        <h1 className="text-xl font-bold mb-6">退勤フォーム</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="sales" className="flex-1">売上入力</TabsTrigger>
            <TabsTrigger value="cleaning" className="flex-1">清掃チェック</TabsTrigger>
            <TabsTrigger value="feedback" className="flex-1">フィードバック</TabsTrigger>
          </TabsList>

          {/* ─── 売上入力 ─── */}
          <TabsContent value="sales">
            {submitted === "sales" ? (
              <SuccessCard label="売上" />
            ) : (
              <form onSubmit={handleSalesSubmit} className="space-y-4">
                {/* 日付 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label>営業日（現在日のみ）</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      disabled
                      aria-label="現在の営業日"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-6"
                    onClick={fetchReservations}
                    disabled={reservationsLoading}
                  >
                    <RefreshCw size={14} className={reservationsLoading ? "animate-spin" : ""} />
                  </Button>
                </div>

                {/* 予約リスト */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      本日の予約
                      <span className="ml-2 text-muted-foreground font-normal">
                        {completedCount}件
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reservationsLoading ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">読み込み中...</div>
                    ) : reservations.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">予約がありません</div>
                    ) : (
                      <div className="space-y-2">
                        {reservations.map((r) => {
                          const isExpanded = expandedId === r.id;
                          const state = editStates[r.id];
                          const calc = state ? calcPrice(state) : null;
                          const selectedDR = state?.selectedOptions.find(o => o.startsWith("DR")) ?? "none";

                          return (
                            <div
                              key={r.id}
                              className={`rounded-lg border ${
                                r.status === "cancelled" ? "opacity-40 bg-muted/30" : "bg-background"
                              }`}
                            >
                              {/* 概要行 */}
                              <div className="flex items-center gap-3 p-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-12 shrink-0">{r.start_time ? toExtTime(r.start_time) : ""}</span>
                                    <span className="font-semibold text-sm truncate">{r.customer_name}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 ml-12 truncate">{r.course_name}</p>
                                  {r.nomination_type && r.nomination_type !== "none" && (
                                    <p className="text-xs text-blue-600 ml-12 truncate">{r.nomination_type}</p>
                                  )}
                                  {(r.options ?? []).length > 0 && (
                                    <p className="text-xs text-muted-foreground ml-12 truncate">
                                      {(r.options ?? []).join(" / ")}
                                    </p>
                                  )}
                                  {(r.discount ?? 0) > 0 && (
                                    <p className="text-xs text-rose-600 ml-12">割引 -¥{(r.discount ?? 0).toLocaleString()}</p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-bold text-sm">¥{(r.price || 0).toLocaleString()}</div>
                                  {r.status !== "cancelled" && r.payment_details && r.payment_details.length > 0 ? (
                                    // 分割払いの場合は内訳を表示
                                    <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                      {r.payment_details.map((d, i) => (
                                        <div key={i} className="flex items-center justify-end gap-1">
                                          <span>{PAYMENT_METHODS.find(m => m.value === d.method)?.label ?? d.method}</span>
                                          <span>¥{d.amount.toLocaleString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : r.status !== "cancelled" ? (
                                    <Select
                                      value={paymentEdits[r.id] || "cash"}
                                      onValueChange={(v) => handlePaymentChange(r.id, v)}
                                      disabled={paymentSavingId !== null}
                                    >
                                      <SelectTrigger className="h-6 text-xs mt-1 w-20 border-0 bg-muted/50 px-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {PAYMENT_METHODS.map((m) => (
                                          <SelectItem key={m.value} value={m.value} className="text-xs">
                                            {m.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">キャンセル</span>
                                  )}
                                </div>
                                {r.status !== "cancelled" && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(r)}
                                    className="ml-1 p-1 rounded hover:bg-muted/60 text-muted-foreground shrink-0"
                                  >
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                )}
                              </div>

                              {/* インライン編集パネル */}
                              {isExpanded && state && (
                                <div className="border-t px-3 pb-3 pt-3 space-y-3 bg-muted/20">
                                  {/* コース */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">コースタイプ</Label>
                                      <Select
                                        value={state.course_type}
                                        onValueChange={(v) => {
                                          const firstDur = backRates.find(b => b.course_type === v)?.duration ?? 60;
                                          updateEdit(r.id, { course_type: v, duration: firstDur });
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs mt-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {courseTypes.map(ct => (
                                            <SelectItem key={ct} value={ct} className="text-xs">{ct}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">時間</Label>
                                      <Select
                                        value={state.duration.toString()}
                                        onValueChange={(v) => updateEdit(r.id, { duration: parseInt(v) })}
                                      >
                                        <SelectTrigger className="h-8 text-xs mt-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {backRates
                                            .filter(b => b.course_type === state.course_type)
                                            .map(b => (
                                              <SelectItem key={b.id} value={b.duration.toString()} className="text-xs">
                                                {b.duration}分（¥{b.customer_price.toLocaleString()}）
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* DR オプション */}
                                  {drOptions.length > 0 && (
                                    <div>
                                      <Label className="text-xs">DR（ディープリンパ）</Label>
                                      <Select
                                        value={selectedDR}
                                        onValueChange={(v) => {
                                          const withoutDR = state.selectedOptions.filter(o => !o.startsWith("DR"));
                                          updateEdit(r.id, { selectedOptions: v === "none" ? withoutDR : [...withoutDR, v] });
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs mt-1">
                                          <SelectValue placeholder="なし" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none" className="text-xs">なし</SelectItem>
                                          {drOptions
                                            .sort((a, b) => (parseInt(a.option_name.replace(/\D/g, "")) || 0) - (parseInt(b.option_name.replace(/\D/g, "")) || 0))
                                            .map(opt => (
                                              <SelectItem key={opt.id} value={opt.option_name} className="text-xs">
                                                {opt.option_name}（+¥{opt.customer_price.toLocaleString()}）
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {/* その他オプション */}
                                  {regularOptions.length > 0 && (
                                    <div>
                                      <Label className="text-xs">オプション</Label>
                                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                                        {regularOptions.map(opt => (
                                          <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer">
                                            <Checkbox
                                              checked={state.selectedOptions.includes(opt.option_name)}
                                              onCheckedChange={() => {
                                                const has = state.selectedOptions.includes(opt.option_name);
                                                updateEdit(r.id, {
                                                  selectedOptions: has
                                                    ? state.selectedOptions.filter(o => o !== opt.option_name)
                                                    : [...state.selectedOptions, opt.option_name],
                                                });
                                              }}
                                            />
                                            <span className="text-xs leading-none">
                                              {opt.option_name}（+¥{opt.customer_price.toLocaleString()}）
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* 指名 */}
                                  <div>
                                    <Label className="text-xs">指名</Label>
                                    <Select
                                      value={state.nomination_type}
                                      onValueChange={(v) => updateEdit(r.id, { nomination_type: v })}
                                    >
                                      <SelectTrigger className="h-8 text-xs mt-1">
                                        <SelectValue placeholder="指名なし" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none" className="text-xs">指名なし</SelectItem>
                                        {nominationRates.map(nr => (
                                          <SelectItem key={nr.id} value={nr.nomination_type} className="text-xs">
                                            {nr.nomination_type}（+¥{nr.customer_price.toLocaleString()}）
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* 割引（プルダウン＋自由入力） */}
                                  <div>
                                    <Label className="text-xs">割引</Label>
                                    <div className="flex gap-2 mt-1">
                                      <Select
                                        value={state.discount_amount.toString()}
                                        onValueChange={(v) => updateEdit(r.id, { discount_amount: parseInt(v) })}
                                      >
                                        <SelectTrigger className="h-8 text-xs flex-1">
                                          <SelectValue placeholder="割引なし" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {/* 保存済み/自由入力の額が選択肢に無い場合も表示できるようにする */}
                                          {!DISCOUNT_OPTIONS.includes(state.discount_amount) && (
                                            <SelectItem value={state.discount_amount.toString()} className="text-xs">
                                              -¥{state.discount_amount.toLocaleString()}
                                            </SelectItem>
                                          )}
                                          {DISCOUNT_OPTIONS.map(amt => (
                                            <SelectItem key={amt} value={amt.toString()} className="text-xs">
                                              {amt === 0 ? "割引なし" : `-¥${amt.toLocaleString()}`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">-¥</span>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={100}
                                          value={state.discount_amount === 0 ? "" : state.discount_amount}
                                          onChange={(e) => updateEdit(r.id, { discount_amount: Math.max(0, parseInt(e.target.value) || 0) })}
                                          placeholder="自由入力"
                                          className="h-8 w-24 text-xs"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* 支払い方法 */}
                                  <div>
                                    <Label className="text-xs">お支払い方法</Label>
                                    <Select
                                      value={state.payment_method}
                                      onValueChange={(v) => updateEdit(r.id, { payment_method: v })}
                                    >
                                      <SelectTrigger className="h-8 text-xs mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="cash" className="text-xs">現金</SelectItem>
                                        <SelectItem value="card" className="text-xs">カード{cardFeePct > 0 ? `（手数料${cardFeePct}%）` : ""}</SelectItem>
                                        <SelectItem value="paypay" className="text-xs">PayPay{paypayFeePct > 0 ? `（手数料${paypayFeePct}%）` : ""}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* 金額プレビュー */}
                                  {calc && (
                                    <div className="rounded bg-muted/50 p-2 text-xs space-y-0.5">
                                      {calc.nominationFee > 0 && (
                                        <div className="flex justify-between text-blue-600">
                                          <span>指名料</span>
                                          <span>+¥{calc.nominationFee.toLocaleString()}</span>
                                        </div>
                                      )}
                                      {calc.discount > 0 && (
                                        <div className="flex justify-between text-rose-600">
                                          <span>割引</span>
                                          <span>-¥{calc.discount.toLocaleString()}</span>
                                        </div>
                                      )}
                                      {calc.fee > 0 && (
                                        <div className="flex justify-between text-muted-foreground">
                                          <span>決済手数料</span>
                                          <span>+¥{calc.fee.toLocaleString()}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between font-bold pt-0.5 border-t">
                                        <span>合計</span>
                                        <span>¥{calc.total.toLocaleString()}</span>
                                      </div>
                                      {calc.fee > 0 && (
                                        <div className="flex justify-between text-muted-foreground border-t pt-0.5">
                                          <span>実際の受取額</span>
                                          <span>¥{(calc.total - calc.fee).toLocaleString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full h-8 text-xs"
                                    onClick={() => handleSaveEdit(r)}
                                    disabled={savingId === r.id}
                                  >
                                    {savingId === r.id ? (
                                      <Loader2 size={12} className="animate-spin mr-1" />
                                    ) : (
                                      <Check size={12} className="mr-1" />
                                    )}
                                    変更を保存
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 集計 */}
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">現金</span>
                      <span className="font-semibold">¥{cashTotal.toLocaleString()}</span>
                    </div>
                    {cardTotal > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">カード</span>
                          <span className="font-semibold">¥{cardTotal.toLocaleString()}</span>
                        </div>
                        {cardFeeTotal > 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground pl-2">
                            <span>内決済手数料</span>
                            <span>¥{cardFeeTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {paypayTotal > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">PayPay</span>
                          <span className="font-semibold">¥{paypayTotal.toLocaleString()}</span>
                        </div>
                        {paypayFeeTotal > 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground pl-2">
                            <span>内決済手数料</span>
                            <span>¥{paypayFeeTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {manualAdjustment !== 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">手動調整</span>
                        <span className="font-semibold">
                          {manualAdjustment > 0 ? "+" : ""}¥{manualAdjustment.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 mt-1">
                      <span className="font-bold">総売上</span>
                      <span className="font-bold text-lg">¥{grandTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center rounded-lg bg-primary/10 px-3 py-2 mt-1">
                      <span className="font-bold text-primary">うち現金預かり額</span>
                      <span className="font-bold text-lg text-primary">¥{cashTotal.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      カード・PayPayは現金で受け取っていないため、実際に預かる現金は上記の額です。
                    </p>
                  </CardContent>
                </Card>

                {/* 手動調整 */}
                <div>
                  <Label className="text-sm text-muted-foreground">手動調整額（差額・チップ等）</Label>
                  <Input
                    type="number"
                    step="100"
                    value={manualAdjustment}
                    onChange={(e) => setManualAdjustment(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>備考</Label>
                  <Textarea value={salesNotes} onChange={(e) => setSalesNotes(e.target.value)} rows={2} />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "送信中..." : "売上を確定する"}
                </Button>
              </form>
            )}
          </TabsContent>

          {/* ─── 清掃チェック ─── */}
          <TabsContent value="cleaning">
            {submitted === "cleaning" ? (
              <CleaningSuccessCard />
            ) : (
              <form onSubmit={handleCleaningSubmit} className="space-y-3">
                {/* ▶ 拭き掃除 */}
                <div className="border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("wiping")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="font-semibold text-sm">▶ 拭き掃除</span>
                    {openSections.wiping ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {openSections.wiping && (
                    <div className="px-4 pb-4 pt-2 space-y-4">
                      <p className="text-xs text-muted-foreground">鏡やドアノブなど、オイルの付いた手で触れた場所を拭き掃除する</p>

                      {/* 鏡 */}
                      <div className="space-y-2">
                        <img src={checkoutMirrorImg} alt="鏡を拭き掃除" className="w-full rounded-lg border" />
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cleaningChecks.mirror}
                            onChange={() => toggleCheck("mirror")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="font-medium text-sm">鏡を拭き掃除</span>
                        </label>
                      </div>

                      {/* ドアノブ */}
                      <div className="space-y-2">
                        <img src={checkoutDoorknobImg} alt="ドアノブを拭き掃除" className="w-full rounded-lg border" />
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cleaningChecks.doorknob}
                            onChange={() => toggleCheck("doorknob")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="font-medium text-sm">ドアノブを拭き掃除</span>
                        </label>
                      </div>

                      {/* 床クイックル（画像なし） */}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cleaningChecks.quickle}
                          onChange={() => toggleCheck("quickle")}
                          className="h-5 w-5 accent-primary"
                        />
                        <span className="font-medium text-sm">床をクイックル</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* ▶ 洗濯 */}
                <div className="border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("laundry")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="font-semibold text-sm">▶ 洗濯</span>
                    {openSections.laundry ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {openSections.laundry && (
                    <div className="px-4 pb-4 pt-2 space-y-2">
                      <img src={checkoutLaundryImg} alt="洗濯の詰め込みすぎNG" className="w-full rounded-lg border" />
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cleaningChecks.laundry}
                          onChange={() => toggleCheck("laundry")}
                          className="h-5 w-5 accent-primary"
                        />
                        <span className="font-medium text-sm">一度に大量に詰め込まない</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* ▶ 片付け */}
                <div className="border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection("tidying")}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="font-semibold text-sm">▶ 片付け</span>
                    {openSections.tidying ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {openSections.tidying && (
                    <div className="px-4 pb-4 pt-2 space-y-4">
                      {/* クローゼット */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">クローゼットの中</p>
                        <img src={checkoutClosetImg} alt="クローゼットの中" className="w-full rounded-lg border" />
                      </div>

                      {/* サンダル */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">サンダルを並べる</p>
                        <img src={checkoutSandalsImg} alt="サンダルを並べる" className="w-full rounded-lg border" />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label>備考</Label>
                  <Textarea value={cleaning.notes} onChange={(e) => setCleaning({ ...cleaning, notes: e.target.value })} rows={2} />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? "送信中..." : "チェックリストを送信"}
                </Button>
              </form>
            )}
          </TabsContent>

          {/* ─── フィードバック ─── */}
          <TabsContent value="feedback">
            {submitted === "feedback" ? (
              <SuccessCard label="フィードバック" />
            ) : (
              <Card>
                <CardHeader><CardTitle>フィードバック</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                    <div>
                      <Label>今日の評価</Label>
                      <div className="flex gap-2 mt-2">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFeedback({ ...feedback, rating: v })}
                            className={`w-12 h-12 rounded-full border-2 font-bold text-lg transition-colors ${
                              feedback.rating >= v
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>良かった点</Label>
                      <Textarea value={feedback.good_points} onChange={(e) => setFeedback({ ...feedback, good_points: e.target.value })} rows={2} />
                    </div>
                    <div>
                      <Label>改善点</Label>
                      <Textarea value={feedback.improvement_points} onChange={(e) => setFeedback({ ...feedback, improvement_points: e.target.value })} rows={2} />
                    </div>
                    <div>
                      <Label>お客様の声</Label>
                      <Textarea value={feedback.customer_feedback} onChange={(e) => setFeedback({ ...feedback, customer_feedback: e.target.value })} rows={2} />
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? "送信中..." : "フィードバックを送信"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
