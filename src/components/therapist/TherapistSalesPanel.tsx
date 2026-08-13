import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toExtTime } from "@/lib/timeFormat";
import { calcPaymentFee, findPaymentSetting, PaymentSetting } from "@/lib/paymentFee";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  payment_method: string | null;
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

interface EditState {
  course_type: string;
  duration: number;
  selectedOptions: string[];
  discount_amount: number;
  payment_method: string;
  nomination_type: string;
}

interface Submission {
  id: string;
  status: string;
  total_amount: number;
  submitted_at: string;
  cash_amount: number;
  card_amount: number;
  paypay_amount: number;
  customer_count: number;
  manual_adjustment: number;
  notes: string | null;
}

interface SalesMasters {
  back_rates: BackRate[];
  option_rates: OptionRate[];
  nomination_rates: NominationRate[];
  payment_settings: PaymentSetting[];
}

interface TherapistSalesPanelProps {
  token: string;
  businessDate: string;
  mode?: "edit" | "confirm";
  focusReservationId?: string | null;
  onReservationSaved?: () => void;
  onSalesSubmitted?: () => void;
}

const DISCOUNT_OPTIONS = [0, 1000, 2000, 3000, 4000, 5000];
const PAYMENT_METHODS = [
  { value: "cash", label: "現金" },
  { value: "card", label: "カード" },
  { value: "paypay", label: "PayPay" },
];

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "不明なエラー";
}

function normalizePaymentMethod(value: string | null | undefined, details?: PaymentDetail[] | null) {
  const detailMethod = details?.length === 1 ? details[0].method : null;
  const raw = (detailMethod || value || "cash").toLowerCase();
  if (raw === "card" || raw.includes("カード") || raw.includes("クレジット")) return "card";
  if (raw === "paypay" || raw.includes("ペイペイ")) return "paypay";
  return "cash";
}

export function TherapistSalesPanel({
  token,
  businessDate,
  mode = "confirm",
  focusReservationId = null,
  onReservationSaved,
  onSalesSubmitted,
}: TherapistSalesPanelProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [expandedId, setExpandedId] = useState<string | null>(focusReservationId);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [salesNotes, setSalesNotes] = useState("");
  const [manualAdjustment, setManualAdjustment] = useState(0);

  const courseTypes = useMemo(() => [...new Set(backRates.map((rate) => rate.course_type))], [backRates]);
  const drOptions = useMemo(() => optionRates.filter((rate) => rate.option_name.startsWith("DR")), [optionRates]);
  const regularOptions = useMemo(() => optionRates.filter((rate) => !rate.option_name.startsWith("DR")), [optionRates]);
  const cardFeePct = useMemo(() => findPaymentSetting(paymentSettings, "card")?.fee_percentage ?? 0, [paymentSettings]);
  const paypayFeePct = useMemo(() => findPaymentSetting(paymentSettings, "paypay")?.fee_percentage ?? 0, [paymentSettings]);

  const makeEditState = useCallback((reservation: Reservation, rates: BackRate[]): EditState => {
    const courseType = reservation.course_type || rates[0]?.course_type || "";
    const duration = reservation.duration || rates.find((rate) => rate.course_type === courseType)?.duration || 60;
    return {
      course_type: courseType,
      duration,
      selectedOptions: reservation.options || [],
      discount_amount: reservation.discount || 0,
      payment_method: normalizePaymentMethod(reservation.payment_method, reservation.payment_details),
      nomination_type: reservation.nomination_type || "none",
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mastersResult, reservationsResult, submissionResult] = await Promise.all([
        supabase.rpc("get_therapist_sales_masters", { p_token: token }),
        supabase.rpc("get_therapist_daily_reservations", { p_token: token, p_date: businessDate }),
        supabase.rpc("get_therapist_daily_sales_submission", { p_token: token, p_date: businessDate }),
      ]);

      const firstError = mastersResult.error || reservationsResult.error || submissionResult.error;
      if (firstError) throw firstError;

      const masters = mastersResult.data as unknown as SalesMasters;
      const rates = masters?.back_rates || [];
      const rows = (reservationsResult.data || []) as unknown as Reservation[];

      setBackRates(rates);
      setOptionRates(masters?.option_rates || []);
      setPaymentSettings(masters?.payment_settings || []);
      setNominationRates(masters?.nomination_rates || []);
      setReservations(rows);
      setEditStates(Object.fromEntries(rows.map((reservation) => [reservation.id, makeEditState(reservation, rates)])));
      setDirtyIds(new Set());

      const submittedRows = (submissionResult.data || []) as Submission[];
      const existingSubmission = submittedRows[0] || null;
      setSubmission(existingSubmission);
      setSalesNotes(existingSubmission?.notes || "");
      setManualAdjustment(existingSubmission?.manual_adjustment || 0);
      if (focusReservationId && rows.some((row) => row.id === focusReservationId)) setExpandedId(focusReservationId);
      else if (mode === "edit" && rows.length === 1) setExpandedId(rows[0].id);
    } catch (error: unknown) {
      toast.error(`予約の取得に失敗しました：${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [businessDate, focusReservationId, makeEditState, mode, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calcPrice = useCallback((state: EditState) => {
    const backRate = backRates.find((rate) => rate.course_type === state.course_type && rate.duration === state.duration);
    let subtotal = backRate?.customer_price || 0;
    state.selectedOptions.forEach((optionName) => {
      subtotal += optionRates.find((rate) => rate.option_name === optionName)?.customer_price || 0;
    });

    const nominationFee = state.nomination_type === "none"
      ? 0
      : nominationRates.find((rate) => rate.nomination_type === state.nomination_type)?.customer_price || 0;
    subtotal += nominationFee;
    const discount = Math.min(Math.max(state.discount_amount || 0, 0), subtotal);
    const price = subtotal - discount;
    const fee = calcPaymentFee(price, paymentSettings, state.payment_method);
    return { subtotal, nominationFee, discount, price, fee, total: price + fee };
  }, [backRates, nominationRates, optionRates, paymentSettings]);

  const updateEdit = (reservationId: string, patch: Partial<EditState>) => {
    setEditStates((current) => ({ ...current, [reservationId]: { ...current[reservationId], ...patch } }));
    setDirtyIds((current) => new Set(current).add(reservationId));
  };

  const saveReservation = async (reservation: Reservation) => {
    if (submission?.status === "confirmed") {
      toast.error("承認済みの売上は変更できません。店舗へ連絡してください");
      return;
    }
    const state = editStates[reservation.id];
    if (!state) return;
    const calculation = calcPrice(state);
    if (reservation.payment_details?.length && calculation.price !== reservation.price) {
      toast.error("分割払いの予約は金額内訳の再設定が必要です。店舗へ連絡してください");
      return;
    }

    const backRate = backRates.find((rate) => rate.course_type === state.course_type && rate.duration === state.duration);
    const courseName = backRate ? `${state.course_type} ${state.duration}分` : reservation.course_name;

    setSavingId(reservation.id);
    try {
      const { error } = await supabase.rpc("therapist_update_reservation", {
        p_token: token,
        p_reservation_id: reservation.id,
        p_course_type: state.course_type,
        p_duration: state.duration,
        p_course_name: courseName,
        p_options: [...new Set(state.selectedOptions)],
        p_discount: calculation.discount,
        p_discount_ids: reservation.discount_ids || [],
        p_price: calculation.price,
        p_payment_fee: calculation.fee,
        p_payment_method: state.payment_method,
        p_nomination_type: state.nomination_type === "none" ? null : state.nomination_type,
      });
      if (error) throw error;

      setReservations((current) => current.map((row) => row.id === reservation.id ? {
        ...row,
        course_type: state.course_type,
        duration: state.duration,
        course_name: courseName,
        options: [...new Set(state.selectedOptions)],
        discount: calculation.discount,
        price: calculation.price,
        payment_fee: calculation.fee,
        payment_method: state.payment_method,
        nomination_type: state.nomination_type === "none" ? null : state.nomination_type,
      } : row));
      setDirtyIds((current) => {
        const next = new Set(current);
        next.delete(reservation.id);
        return next;
      });
      setSubmission(null);
      toast.success("オプションと売上内容を保存しました");
      onReservationSaved?.();
    } catch (error: unknown) {
      toast.error(`保存に失敗しました：${errorMessage(error)}`);
    } finally {
      setSavingId(null);
    }
  };

  const totals = reservations.reduce((result, reservation) => {
    if (reservation.payment_details?.length) {
      reservation.payment_details.forEach((detail) => {
        const method = normalizePaymentMethod(detail.method);
        const fee = calcPaymentFee(detail.amount || 0, paymentSettings, method);
        result[method] = (result[method] || 0) + (detail.amount || 0) + fee;
      });
    } else {
      const method = normalizePaymentMethod(reservation.payment_method);
      result[method] = (result[method] || 0) + (reservation.price || 0) + (reservation.payment_fee || 0);
    }
    return result;
  }, {} as Record<string, number>);

  const cashTotal = totals.cash || 0;
  const cardTotal = totals.card || 0;
  const paypayTotal = totals.paypay || 0;
  const grandTotal = cashTotal + cardTotal + paypayTotal + manualAdjustment;

  const submitSales = async () => {
    if (submission?.status === "confirmed") {
      toast.error("本日の売上は店舗で承認済みです");
      return;
    }
    if (dirtyIds.size > 0) {
      toast.error("変更中の予約があります。先に「変更を保存」を押してください");
      return;
    }
    if (grandTotal < 0) {
      toast.error("総売上が0円未満になっています");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("therapist_submit_daily_sales", {
        p_token: token,
        p_date: businessDate,
        p_cash_amount: cashTotal,
        p_card_amount: cardTotal,
        p_paypay_amount: paypayTotal,
        p_total_amount: grandTotal,
        p_customer_count: reservations.length,
        p_manual_adjustment: manualAdjustment,
        p_notes: salesNotes || null,
      });
      if (error) throw error;
      setSubmission({
        id: "submitted",
        status: "pending",
        total_amount: grandTotal,
        submitted_at: new Date().toISOString(),
        cash_amount: cashTotal,
        card_amount: cardTotal,
        paypay_amount: paypayTotal,
        customer_count: reservations.length,
        manual_adjustment: manualAdjustment,
        notes: salesNotes || null,
      });
      toast.success("本日の売上を送信しました");
      onSalesSubmitted?.();
    } catch (error: unknown) {
      toast.error(`売上の送信に失敗しました：${errorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const visibleReservations = mode === "edit" && focusReservationId
    ? reservations.filter((reservation) => reservation.id === focusReservationId)
    : reservations;
  const salesLocked = submission?.status === "confirmed";

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (visibleReservations.length === 0) {
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">対象の予約がありません</p>
        <Button variant="outline" size="sm" onClick={loadData}><RefreshCw size={14} className="mr-1" />再読み込み</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submission && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 flex items-start gap-2">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{salesLocked ? "店舗で承認済みです" : "売上は送信済みです"}</p>
            <p className="text-xs">
              {salesLocked
                ? "承認後の変更が必要な場合は店舗へ連絡してください。"
                : "内容を変更した場合は、売上をもう一度確定してください。"}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {visibleReservations.map((reservation) => {
          const state = editStates[reservation.id];
          if (!state) return null;
          const isExpanded = !salesLocked && (mode === "edit" || expandedId === reservation.id);
          const calculation = calcPrice(state);
          const selectedDr = state.selectedOptions.find((option) => option.startsWith("DR")) || "none";
          const hasSplitPayment = Boolean(reservation.payment_details?.length);

          return (
            <Card key={reservation.id} className={dirtyIds.has(reservation.id) ? "border-amber-300" : ""}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => mode === "confirm" && setExpandedId(isExpanded ? null : reservation.id)}
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-bold text-primary tabular-nums w-12 shrink-0">{toExtTime(reservation.start_time)}</span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm truncate">{reservation.customer_name} 様</CardTitle>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{reservation.course_name}</p>
                      {(reservation.options || []).length > 0 && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">＋{reservation.options?.join("、")}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">¥{(reservation.price || 0).toLocaleString()}</p>
                      {mode === "confirm" && (isExpanded ? <ChevronUp size={16} className="ml-auto text-muted-foreground" /> : <ChevronDown size={16} className="ml-auto text-muted-foreground" />)}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="border-t pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">コース</Label>
                      <Select value={state.course_type} onValueChange={(value) => {
                        const firstDuration = backRates.find((rate) => rate.course_type === value)?.duration || 60;
                        updateEdit(reservation.id, { course_type: value, duration: firstDuration });
                      }}>
                        <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{courseTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">時間</Label>
                      <Select value={String(state.duration)} onValueChange={(value) => updateEdit(reservation.id, { duration: Number(value) })}>
                        <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {backRates.filter((rate) => rate.course_type === state.course_type).map((rate) => (
                            <SelectItem key={rate.id} value={String(rate.duration)}>{rate.duration}分（¥{rate.customer_price.toLocaleString()}）</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {drOptions.length > 0 && (
                    <div>
                      <Label className="text-xs">DR（ディープリンパ）</Label>
                      <Select value={selectedDr} onValueChange={(value) => {
                        const withoutDr = state.selectedOptions.filter((option) => !option.startsWith("DR"));
                        updateEdit(reservation.id, { selectedOptions: value === "none" ? withoutDr : [...withoutDr, value] });
                      }}>
                        <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue placeholder="なし" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          {drOptions.map((option) => <SelectItem key={option.id} value={option.option_name}>{option.option_name}（+¥{option.customer_price.toLocaleString()}）</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {regularOptions.length > 0 && (
                    <div>
                      <Label className="text-xs">追加オプション</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {regularOptions.map((option) => {
                          const checked = state.selectedOptions.includes(option.option_name);
                          return (
                            <label key={option.id} className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer ${checked ? "border-primary bg-primary/5" : ""}`}>
                              <Checkbox checked={checked} onCheckedChange={() => updateEdit(reservation.id, {
                                selectedOptions: checked
                                  ? state.selectedOptions.filter((name) => name !== option.option_name)
                                  : [...state.selectedOptions, option.option_name],
                              })} />
                              <span className="text-xs flex-1">{option.option_name}</span>
                              <span className="text-xs font-medium">+¥{option.customer_price.toLocaleString()}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">指名</Label>
                    <Select value={state.nomination_type} onValueChange={(value) => updateEdit(reservation.id, { nomination_type: value })}>
                      <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">指名なし</SelectItem>
                        {nominationRates.map((rate) => <SelectItem key={rate.id} value={rate.nomination_type}>{rate.nomination_type}（+¥{rate.customer_price.toLocaleString()}）</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">割引</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={String(state.discount_amount)} onValueChange={(value) => updateEdit(reservation.id, { discount_amount: Number(value) })}>
                        <SelectTrigger className="h-9 flex-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {!DISCOUNT_OPTIONS.includes(state.discount_amount) && <SelectItem value={String(state.discount_amount)}>-¥{state.discount_amount.toLocaleString()}</SelectItem>}
                          {DISCOUNT_OPTIONS.map((amount) => <SelectItem key={amount} value={String(amount)}>{amount === 0 ? "割引なし" : `-¥${amount.toLocaleString()}`}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        className="h-9 w-28 text-xs"
                        placeholder="自由入力"
                        value={state.discount_amount || ""}
                        onChange={(event) => updateEdit(reservation.id, { discount_amount: Math.max(0, Number(event.target.value) || 0) })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">お支払い方法</Label>
                    {hasSplitPayment ? (
                      <div className="mt-1 rounded-lg border bg-muted/30 p-2 text-xs space-y-1">
                        {reservation.payment_details?.map((detail, index) => (
                          <div key={`${detail.method}-${index}`} className="flex justify-between"><span>{PAYMENT_METHODS.find((method) => method.value === detail.method)?.label || detail.method}</span><span>¥{detail.amount.toLocaleString()}</span></div>
                        ))}
                        <p className="text-amber-700 flex gap-1 pt-1"><AlertCircle size={13} className="shrink-0" />金額が変わる場合は店舗へ分割内訳の変更を依頼してください。</p>
                      </div>
                    ) : (
                      <Select value={state.payment_method} onValueChange={(value) => updateEdit(reservation.id, { payment_method: value })}>
                        <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">現金</SelectItem>
                          <SelectItem value="card">カード{cardFeePct ? `（手数料${cardFeePct}%）` : ""}</SelectItem>
                          <SelectItem value="paypay">PayPay{paypayFeePct ? `（手数料${paypayFeePct}%）` : ""}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    {calculation.nominationFee > 0 && <div className="flex justify-between"><span>指名料</span><span>+¥{calculation.nominationFee.toLocaleString()}</span></div>}
                    {calculation.discount > 0 && <div className="flex justify-between text-rose-600"><span>割引</span><span>-¥{calculation.discount.toLocaleString()}</span></div>}
                    {calculation.fee > 0 && <div className="flex justify-between"><span>決済手数料</span><span>+¥{calculation.fee.toLocaleString()}</span></div>}
                    <div className="flex justify-between border-t pt-1 font-bold text-sm"><span>合計</span><span>¥{calculation.total.toLocaleString()}</span></div>
                  </div>

                  <Button className="w-full" onClick={() => saveReservation(reservation)} disabled={savingId === reservation.id || !dirtyIds.has(reservation.id)}>
                    {savingId === reservation.id ? <Loader2 size={15} className="animate-spin mr-1" /> : <Check size={15} className="mr-1" />}
                    {dirtyIds.has(reservation.id) ? "変更を保存" : "保存済み"}
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {mode === "confirm" && (
        <>
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">現金</span><span className="font-semibold">¥{cashTotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">カード</span><span className="font-semibold">¥{cardTotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">PayPay</span><span className="font-semibold">¥{paypayTotal.toLocaleString()}</span></div>
              {manualAdjustment !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">手動調整</span><span className="font-semibold">{manualAdjustment > 0 ? "+" : ""}¥{manualAdjustment.toLocaleString()}</span></div>}
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>総売上</span><span>¥{grandTotal.toLocaleString()}</span></div>
              <div className="flex justify-between rounded-lg bg-primary/10 px-3 py-2 text-primary font-bold"><span>現金預かり額</span><span>¥{cashTotal.toLocaleString()}</span></div>
            </CardContent>
          </Card>

          <div>
            <Label className="text-xs">手動調整額（差額・チップ等）</Label>
            <Input type="number" step={100} value={manualAdjustment} onChange={(event) => setManualAdjustment(Number(event.target.value))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">備考</Label>
            <Textarea value={salesNotes} onChange={(event) => setSalesNotes(event.target.value)} rows={2} className="mt-1" />
          </div>
          <Button className="w-full h-12 text-base" onClick={submitSales} disabled={salesLocked || submitting || dirtyIds.size > 0}>
            {submitting ? <Loader2 size={17} className="animate-spin mr-2" /> : <CheckCircle2 size={17} className="mr-2" />}
            {salesLocked ? "本日の売上は承認済み" : submission ? "本日の売上を再確定する" : "本日の売上を確定する"}
          </Button>
          {dirtyIds.size > 0 && <p className="text-xs text-center text-amber-700">変更中の予約を保存すると、売上確定ボタンを押せます。</p>}
        </>
      )}
    </div>
  );
}
