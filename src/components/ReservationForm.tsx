import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, UserCheck, Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { calcPaymentFee, findPaymentSetting, PaymentSetting } from "@/lib/paymentFee";
import { CONVERSATION_OPTIONS } from "@/lib/customerRank";

const PREFERRED_TYPE_OPTIONS = ["20代前半", "30代", "ギャル系", "お姉さん系", "ベテラン", "未経験", "おっとり", "サバサバ"] as const;

interface Cast {
  id: string;
  name: string;
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

interface DiscountItem {
  id: string;
  name: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
}

interface FormData {
  cast_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  nomination_type: string;
  reservation_date: Date;
  start_time: string;
  end_time: string;
  duration: number;
  room: string;
  course_type: string;
  course_name: string;
  selectedOptions: string[];
  discount_ids: string[];
  discount: number;
  price: number;
  payment_method: string;
  payment_fee: number;
  payment_details: { method: string; amount: number }[] | null;
  reservation_method: string;
  notes: string;
}

interface ReservationFormProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  casts: Cast[];
  rooms: { id: string; name: string; address: string | null }[];
  backRates: BackRate[];
  optionRates: OptionRate[];
  nominationRates: NominationRate[];
  discounts: DiscountItem[];
  storeId?: string;
  onSubmit: () => void;
  submitLabel?: string;
}

interface NgCast {
  cast_id: string;
  cast_name: string;
  reason: string | null;
}

interface CustomerInfo {
  id: string;
  name: string;
  visit_count: number | null;
  last_visited: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  ng_casts: NgCast[];
}

interface RecentReservation {
  reservation_date: string;
  course_name: string;
  price: number;
  status: string;
  cast_id: string | null;
}

interface PreferenceForm {
  preferred_types: string[];
  conversation_level: string | null;
  ng_items: string;
  preference_notes: string;
}

const EMPTY_PREFS: PreferenceForm = {
  preferred_types: [],
  conversation_level: null,
  ng_items: "",
  preference_notes: "",
};

const EXTENDED_HOURS = Array.from({ length: 30 }, (_, hour) => hour);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => minute);

export function ReservationForm({
  formData,
  setFormData,
  casts,
  rooms,
  backRates,
  optionRates,
  nominationRates,
  discounts,
  storeId,
  onSubmit,
  submitLabel = "予約を追加",
}: ReservationFormProps) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [recentReservations, setRecentReservations] = useState<RecentReservation[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [ngCastId, setNgCastId] = useState("");
  const [ngReason, setNgReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [prefs, setPrefs] = useState<PreferenceForm>(EMPTY_PREFS);
  const [prefsDirty, setPrefsDirty] = useState(false);
  // 自由割引（マスタ割引に加えて任意金額を引ける）。保存は discount 合計額に含める
  const [customDiscount, setCustomDiscount] = useState(0);
  const customInitRef = useRef(false);

  const [startHour = 0, startMinute = 0] = formData.start_time.split(":").map(Number);

  const updateStartTime = (hour: number, minute: number) => {
    setFormData({
      ...formData,
      start_time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    });
  };

  useEffect(() => {
    let query = supabase
      .from("payment_settings")
      .select("id, payment_method, payment_link, fee_percentage");
    if (storeId) query = query.eq("store_id", storeId);
    query
      .then(({ data }) => setPaymentSettings((data || []) as PaymentSetting[]));
  }, [storeId]);

  const courseTypes = useMemo(() => {
    const types = [...new Set(backRates.map(r => r.course_type))];
    return types;
  }, [backRates]);

  // 合計はレンダリング中に即時計算（クリック→反映のラグをなくす）
  const liveTotals = useMemo(() => {
    let subtotal = 0;

    const backRate = backRates.find(
      (rate) =>
        rate.course_type === formData.course_type &&
        rate.duration === formData.duration
    );

    if (backRate) {
      subtotal += backRate.customer_price;
    }

    formData.selectedOptions.forEach((optionName) => {
      const optionRate = optionRates.find((rate) => rate.option_name === optionName);
      if (optionRate) {
        subtotal += optionRate.customer_price;
      }
    });

    if (formData.nomination_type && formData.nomination_type !== "none") {
      const nominationRate = nominationRates.find(
        (rate) => rate.nomination_type === formData.nomination_type
      );
      if (nominationRate) {
        subtotal += nominationRate.customer_price;
      }
    }

    let discountAmount = 0;
    for (const discId of formData.discount_ids) {
      const d = discounts.find(x => x.id === discId);
      if (d) {
        const amt = d.discount_type === "percentage"
          ? Math.round((subtotal * d.discount_value) / 100)
          : d.discount_value;
        discountAmount += amt;
      }
    }
    discountAmount += Math.max(0, customDiscount);
    discountAmount = Math.min(discountAmount, subtotal);
    const totalPrice = subtotal - discountAmount;

    // payment_details がある場合は各エントリの手数料を合算、ない場合は従来通り
    let fee: number;
    if (formData.payment_details && formData.payment_details.length > 0) {
      fee = formData.payment_details.reduce((sum, d) =>
        sum + calcPaymentFee(d.amount, paymentSettings, d.method), 0);
    } else {
      fee = calcPaymentFee(totalPrice, paymentSettings, formData.payment_method);
    }

    // コース名はコースタイプ＋時間から常に自動生成し、デフォルト値が残らないようにする
    const courseName = `${formData.course_type} ${formData.duration}分`;

    return { totalPrice, discountAmount, fee, courseName };
  }, [formData.course_type, formData.duration, formData.selectedOptions, formData.nomination_type, formData.discount_ids, formData.payment_method, formData.payment_details, backRates, optionRates, nominationRates, discounts, paymentSettings, customDiscount]);

  // 編集時：保存済みの割引額からマスタ割引分を引いた残りを自由割引として復元する
  useEffect(() => {
    if (customInitRef.current) return;
    if (backRates.length === 0) return; // 料金マスタ読み込み待ち
    if (!formData.discount || formData.discount <= 0) { customInitRef.current = true; return; }
    let subtotal = 0;
    const br = backRates.find(r => r.course_type === formData.course_type && r.duration === formData.duration);
    if (br) subtotal += br.customer_price;
    for (const optName of formData.selectedOptions) {
      const o = optionRates.find(x => x.option_name === optName);
      if (o) subtotal += o.customer_price;
    }
    if (formData.nomination_type) {
      const n = nominationRates.find(x => x.nomination_type === formData.nomination_type);
      if (n) subtotal += n.customer_price;
    }
    let masterAmt = 0;
    for (const discId of formData.discount_ids) {
      const d = discounts.find(x => x.id === discId);
      if (d) masterAmt += d.discount_type === "percentage" ? Math.round((subtotal * d.discount_value) / 100) : d.discount_value;
    }
    const rest = formData.discount - masterAmt;
    if (rest > 0) setCustomDiscount(rest);
    customInitRef.current = true;
  }, [backRates, optionRates, nominationRates, discounts]); // eslint-disable-line

  // 保存用に formData へ同期（表示は liveTotals を直接参照するため遅延しない）
  useEffect(() => {
    const { totalPrice, discountAmount, fee, courseName } = liveTotals;
    if (
      totalPrice !== formData.price ||
      discountAmount !== formData.discount ||
      fee !== formData.payment_fee ||
      courseName !== formData.course_name
    ) {
      setFormData({ ...formData, price: totalPrice, discount: discountAmount, payment_fee: fee, course_name: courseName });
    }
  }, [liveTotals]); // eslint-disable-line

  // 開始時間とコース時間（分）から終了時間を自動計算
  useEffect(() => {
    if (!formData.start_time || !formData.duration) return;
    const [h, m] = formData.start_time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const total = h * 60 + m + formData.duration;
    const eh = Math.floor(total / 60);
    const em = total % 60;
    const newEnd = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    if (newEnd !== formData.end_time) {
      setFormData({ ...formData, end_time: newEnd });
    }
  }, [formData.start_time, formData.duration]);

  useEffect(() => {
    const phone = formData.customer_phone.replace(/[-\s]/g, "");
    if (phone.length < 10) {
      setCustomerInfo(null);
      setRecentReservations([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCustomer(true);
      const [custRes, resRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, visit_count, last_visited, is_banned, ban_reason, customer_ng_casts(cast_id, reason, casts(name))")
          .or(`phone.eq.${phone},phone.eq.${formData.customer_phone}`)
          .maybeSingle(),
        // 直近の来店＝実際に来店（完了）した予約のみ。未来のWEB予約は含めない
        supabase
          .from("reservations")
          .select("reservation_date, course_name, price, status, customer_name, cast_id")
          .or(`customer_phone.eq.${phone},customer_phone.eq.${formData.customer_phone}`)
          .eq("status", "completed")
          .order("reservation_date", { ascending: false })
          .limit(5),
      ]);
      setSearchingCustomer(false);
      if (custRes.data) {
        const raw = custRes.data as any;
        const ngCasts: NgCast[] = (raw.customer_ng_casts || []).map((n: any) => ({
          cast_id: n.cast_id,
          cast_name: n.casts?.name ?? "",
          reason: n.reason,
        }));
        const info: CustomerInfo = {
          id: raw.id,
          name: raw.name,
          visit_count: raw.visit_count,
          last_visited: raw.last_visited,
          is_banned: raw.is_banned ?? false,
          ban_reason: raw.ban_reason,
          ng_casts: ngCasts,
        };
        setCustomerInfo(info);
        setBanReason(info.ban_reason ?? "");
        // 既存顧客の好みプロフィールを読み込み
        supabase
          .from("customer_profiles")
          .select("preferred_types, conversation_level, ng_items, preference_notes")
          .eq("customer_id", raw.id)
          .maybeSingle()
          .then(({ data: prof }) => {
            setPrefs({
              preferred_types: prof?.preferred_types ?? [],
              conversation_level: prof?.conversation_level ?? null,
              ng_items: prof?.ng_items ?? "",
              preference_notes: prof?.preference_notes ?? "",
            });
            setPrefsDirty(false);
          });
        if (!formData.customer_name && info.name) {
          setFormData({ ...formData, customer_name: info.name });
        }
      } else {
        setCustomerInfo(null);
        setPrefs(EMPTY_PREFS);
        setPrefsDirty(false);
        // 顧客マスタに無い場合は過去予約の名前を自動入力
        const pastName = (resRes.data as any[])?.find((r) => r.customer_name)?.customer_name;
        if (!formData.customer_name && pastName) {
          setFormData({ ...formData, customer_name: pastName });
        }
      }
      setRecentReservations((resRes.data || []) as RecentReservation[]);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.customer_phone]);

  // セラピスト選択後の「本指名」自動設定
  // 初回マウント時（編集で既存予約を開いた直後など）は実行せず、
  // ユーザーが実際にセラピストを変更したときだけ判定する
  const castInitRef = useRef(false);
  useEffect(() => {
    if (!castInitRef.current) {
      castInitRef.current = true;
      return;
    }
    if (!formData.cast_id || !formData.customer_phone) return;
    const phone = formData.customer_phone.replace(/[-\s]/g, "");
    if (phone.length < 10) return;

    supabase
      .from("reservations")
      .select("id")
      .eq("cast_id", formData.cast_id)
      .or(`customer_phone.eq.${phone},customer_phone.eq.${formData.customer_phone}`)
      .neq("status", "cancelled")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const honshimei = nominationRates.find(r => r.nomination_type === "本指名");
          if (honshimei) {
            setFormData({ ...formData, nomination_type: "本指名" });
          }
        }
      });
  }, [formData.cast_id]);

  const handleToggleBan = async () => {
    if (!customerInfo) return;
    setSaving(true);
    const newBanned = !customerInfo.is_banned;
    const { error } = await supabase
      .from("customers")
      .update({ is_banned: newBanned, ban_reason: newBanned ? banReason || null : null })
      .eq("id", customerInfo.id);
    setSaving(false);
    if (!error) setCustomerInfo({ ...customerInfo, is_banned: newBanned, ban_reason: newBanned ? banReason : null });
  };

  const handleAddNg = async () => {
    if (!customerInfo || !ngCastId) return;
    setSaving(true);
    const { error } = await supabase.from("customer_ng_casts").insert({
      customer_id: customerInfo.id,
      cast_id: ngCastId,
      reason: ngReason || null,
    });
    setSaving(false);
    if (!error) {
      const castName = casts.find(c => c.id === ngCastId)?.name ?? "";
      setCustomerInfo({
        ...customerInfo,
        ng_casts: [...customerInfo.ng_casts, { cast_id: ngCastId, cast_name: castName, reason: ngReason || null }],
      });
      setNgCastId("");
      setNgReason("");
    }
  };

  const handleRemoveNg = async (castId: string) => {
    if (!customerInfo) return;
    await supabase.from("customer_ng_casts")
      .delete()
      .eq("customer_id", customerInfo.id)
      .eq("cast_id", castId);
    setCustomerInfo({
      ...customerInfo,
      ng_casts: customerInfo.ng_casts.filter(n => n.cast_id !== castId),
    });
  };

  const updatePrefs = (patch: Partial<PreferenceForm>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    setPrefsDirty(true);
  };

  // 好みヒアリング内容を顧客マスタに保存（予約登録とは独立して保存する）
  const savePreferences = async () => {
    if (!prefsDirty) return;
    const hasContent =
      prefs.preferred_types.length > 0 ||
      prefs.conversation_level ||
      prefs.ng_items.trim() ||
      prefs.preference_notes.trim();
    if (!hasContent && !customerInfo) return;
    try {
      let customerId = customerInfo?.id;
      if (!customerId) {
        const phone = formData.customer_phone.trim();
        if (!phone || !formData.customer_name.trim()) return;
        const { data, error } = await supabase
          .from("customers")
          .insert({
            name: formData.customer_name.trim(),
            phone,
            email: formData.customer_email || null,
          })
          .select("id")
          .single();
        if (error || !data) return;
        customerId = data.id;
      }
      await supabase.from("customer_profiles").upsert(
        {
          customer_id: customerId,
          preferred_types: prefs.preferred_types.length ? prefs.preferred_types : null,
          conversation_level: prefs.conversation_level,
          ng_items: prefs.ng_items.trim() || null,
          preference_notes: prefs.preference_notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" },
      );
      setPrefsDirty(false);
    } catch (e) {
      console.error("preference save failed", e);
    }
  };

  const handleSubmit = async () => {
    await savePreferences();
    onSubmit();
  };

  const handleOptionToggle = useCallback((optionName: string) => {
    const newOptions = formData.selectedOptions.includes(optionName)
      ? formData.selectedOptions.filter((o) => o !== optionName)
      : [...formData.selectedOptions, optionName];
    setFormData({ ...formData, selectedOptions: newOptions });
  }, [formData, setFormData]);

  const drOptions = useMemo(() =>
    optionRates.filter(r => r.option_name.startsWith("DR")),
    [optionRates]
  );

  const regularOptions = useMemo(() =>
    optionRates.filter(r => !r.option_name.startsWith("DR")),
    [optionRates]
  );

  const selectedDR = useMemo(() =>
    formData.selectedOptions.find(o => o.startsWith("DR")) || "none",
    [formData.selectedOptions]
  );

  const handleDRChange = useCallback((value: string) => {
    const withoutDR = formData.selectedOptions.filter(o => !o.startsWith("DR"));
    const newOptions = value === "none" ? withoutDR : [...withoutDR, value];
    setFormData({ ...formData, selectedOptions: newOptions });
  }, [formData, setFormData]);

  const availableOptions = useMemo(() =>
    regularOptions.map(rate => rate.option_name),
    [regularOptions]
  );

  const cardFeePct = useMemo(() => findPaymentSetting(paymentSettings, "card")?.fee_percentage ?? 0, [paymentSettings]);
  const paypayFeePct = useMemo(() => findPaymentSetting(paymentSettings, "paypay")?.fee_percentage ?? 0, [paymentSettings]);

  return (
    <div className="space-y-4">
      {/* 1. 電話番号 */}
      <div>
        <Label htmlFor="customer_phone">電話番号</Label>
        <Input
          id="customer_phone"
          placeholder="090-1234-5678"
          value={formData.customer_phone}
          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
        />
      </div>

      {/* 2. 顧客情報パネル */}
      {searchingCustomer && (
        <p className="text-xs text-muted-foreground">検索中...</p>
      )}
      {!searchingCustomer && formData.customer_phone.replace(/[-\s]/g, "").length >= 10 && (
        <div className="space-y-2">
          {/* 出入り禁止バナー */}
          {customerInfo?.is_banned && (
            <div className="rounded-lg border border-red-400 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
              <span className="text-red-600 text-lg font-bold leading-none">⛔</span>
              <div>
                <p className="font-bold text-red-700 dark:text-red-400 text-sm">出入り禁止</p>
                {customerInfo.ban_reason && <p className="text-xs text-red-600 mt-0.5">{customerInfo.ban_reason}</p>}
              </div>
            </div>
          )}

          {/* NGキャスト警告 */}
          {customerInfo && customerInfo.ng_casts.length > 0 && formData.cast_id &&
            customerInfo.ng_casts.some(n => n.cast_id === formData.cast_id) && (
            <div className="rounded-lg border border-orange-400 bg-orange-50 dark:bg-orange-950/30 p-3 flex items-start gap-2">
              <span className="text-orange-500 text-lg font-bold leading-none">⚠️</span>
              <div>
                <p className="font-bold text-orange-700 dark:text-orange-400 text-sm">NGキャスト</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  {customerInfo.ng_casts.find(n => n.cast_id === formData.cast_id)?.reason || "この顧客はこのセラピストをNGに設定しています"}
                </p>
              </div>
            </div>
          )}

          {/* 顧客情報 */}
          <div className={cn(
            "rounded-lg border p-3 text-sm space-y-2",
            customerInfo ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
          )}>
            {customerInfo ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
                    <UserCheck size={14} />
                    {customerInfo.name}（既存顧客）
                  </div>
                  {/* 顧客詳細ページ（好み登録・全来店履歴）を新しいタブで開く */}
                  <a
                    href={`/database/customers/${customerInfo.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary underline underline-offset-2 whitespace-nowrap shrink-0"
                  >
                    顧客詳細を開く ↗
                  </a>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>来店回数：<strong className="text-foreground">{customerInfo.visit_count ?? 0}回</strong></span>
                  {customerInfo.last_visited && (
                    <span>最終来店：<strong className="text-foreground">{format(new Date(customerInfo.last_visited), "M月d日", { locale: ja })}</strong></span>
                  )}
                </div>
                {/* NGキャスト一覧 */}
                {customerInfo.ng_casts.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {customerInfo.ng_casts.map(n => (
                      <span key={n.cast_id} className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
                        NG:{n.cast_name}
                        <button onClick={() => handleRemoveNg(n.cast_id)} className="hover:text-red-600 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                <UserCheck size={14} />
                新規顧客
              </div>
            )}

            {/* 直近来店 */}
            {recentReservations.length > 0 && (
              <div className="pt-1 border-t border-current/10 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock size={11} />直近の来店
                </p>
                {recentReservations.map((r, i) => {
                  const castName = r.cast_id ? casts.find((c) => c.id === r.cast_id)?.name : null;
                  return (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {format(new Date(r.reservation_date), "M/d(E)", { locale: ja })}　{r.course_name}
                        {castName && <span className="ml-1">／{castName}</span>}
                      </span>
                      <span className="font-medium">¥{r.price.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 管理操作（既存顧客のみ） */}
            {customerInfo && (
              <div className="pt-2 border-t border-current/10 space-y-2">
                {/* 出入り禁止トグル */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="禁止理由（任意）"
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border rounded"
                  />
                  <button
                    onClick={handleToggleBan}
                    disabled={saving}
                    className={cn(
                      "text-xs px-2 py-1 rounded font-semibold whitespace-nowrap",
                      customerInfo.is_banned
                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    )}
                  >
                    {customerInfo.is_banned ? "禁止解除" : "出入り禁止"}
                  </button>
                </div>
                {/* NGキャスト追加 */}
                <div className="flex gap-2 items-center">
                  <select
                    value={ngCastId}
                    onChange={e => setNgCastId(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border rounded"
                  >
                    <option value="">キャストを選択</option>
                    {casts.filter(c => !customerInfo.ng_casts.some(n => n.cast_id === c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="理由（任意）"
                    value={ngReason}
                    onChange={e => setNgReason(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border rounded"
                  />
                  <button
                    onClick={handleAddNg}
                    disabled={saving || !ngCastId}
                    className="text-xs px-2 py-1 rounded font-semibold bg-orange-100 text-orange-700 hover:bg-orange-200 whitespace-nowrap disabled:opacity-40"
                  >
                    NG追加
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 予約者名 */}
      <div>
        <Label htmlFor="customer_name">予約者</Label>
        <Input
          id="customer_name"
          placeholder="山田太郎"
          value={formData.customer_name}
          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
        />
      </div>

      {/* 4. セラピスト */}
      <div>
        <Label>セラピスト</Label>
        <Select
          value={formData.cast_id}
          onValueChange={(value) => setFormData({ ...formData, cast_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="セラピストを選択" />
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

      {/* 5. 指名 */}
      <div>
        <Label>指名</Label>
        <Select
          value={formData.nomination_type}
          onValueChange={(value) => setFormData({ ...formData, nomination_type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">指名なし</SelectItem>
            {nominationRates.map((rate) => (
              <SelectItem key={rate.id} value={rate.nomination_type}>
                {rate.nomination_type} (+¥{rate.customer_price.toLocaleString()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 6. 予約日 */}
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
              {formData.reservation_date ? (
                format(formData.reservation_date, "PPP", { locale: ja })
              ) : (
                <span>日付を選択</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.reservation_date}
              onSelect={(date) => date && setFormData({ ...formData, reservation_date: date })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* 7. 開始時間 */}
      <div>
        <Label htmlFor="start_time_hour">開始時間</Label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            id="start_time_hour"
            aria-label="開始時間の時"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={startHour}
            onChange={(e) => updateStartTime(Number(e.target.value), startMinute)}
          >
            {EXTENDED_HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}時{hour >= 24 ? `（翌日${hour - 24}時）` : ""}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">:</span>
          <select
            aria-label="開始時間の分"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={startMinute}
            onChange={(e) => updateStartTime(startHour, Number(e.target.value))}
          >
            {MINUTE_OPTIONS.map((minute) => (
              <option key={minute} value={minute}>{String(minute).padStart(2, "0")}分</option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          24時台は、選択した日付の深夜として自動保存されます。
        </p>
      </div>

      {/* 8. 終了時間 */}
      <div>
        <Label htmlFor="end_time">終了時間</Label>
        <Input
          id="end_time"
          type="text"
          value={formData.end_time}
          readOnly
        />
      </div>

      {/* 9. ルーム（ボタン選択） */}
      <div>
        <Label>ルーム</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {rooms.map((room) => {
            const on = formData.room === room.name;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setFormData({ ...formData, room: on ? "" : room.name })}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                }`}
              >
                {room.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 10. コースタイプ（ボタン選択） */}
      <div>
        <Label>コースタイプ</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {courseTypes.map((type) => {
            const on = formData.course_type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, course_type: type })}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* 11. 時間（ボタン選択） */}
      <div>
        <Label>時間</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
          {backRates
            .filter((rate) => rate.course_type === formData.course_type)
            .sort((a, b) => a.duration - b.duration)
            .map((rate) => {
              const on = formData.duration === rate.duration;
              return (
                <button
                  key={rate.id}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      duration: rate.duration,
                      course_name: `${formData.course_type} ${rate.duration}分`,
                    })
                  }
                  className={`py-2.5 rounded-lg text-sm border-2 transition-colors leading-tight ${
                    on ? "bg-primary text-primary-foreground border-primary font-bold" : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {rate.duration}分<br />
                  <span className={on ? "" : "text-muted-foreground"}>¥{rate.customer_price.toLocaleString()}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* 12. DR Option（ボタン選択） */}
      {drOptions.length > 0 && (
        <div>
          <Label>DR（ディープリンパ）</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => handleDRChange("none")}
              className={`px-3 py-2 rounded-lg text-sm border-2 transition-colors ${
                selectedDR === "none" ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-background border-border hover:bg-muted"
              }`}
            >
              なし
            </button>
            {drOptions
              .sort((a, b) => {
                const aMin = parseInt(a.option_name.replace(/\D/g, "")) || 0;
                const bMin = parseInt(b.option_name.replace(/\D/g, "")) || 0;
                return aMin - bMin;
              })
              .map((rate) => {
                const on = selectedDR === rate.option_name;
                return (
                  <button
                    key={rate.id}
                    type="button"
                    onClick={() => handleDRChange(rate.option_name)}
                    className={`px-3 py-2 rounded-lg text-sm border-2 transition-colors ${
                      on ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {rate.option_name}
                    <span className={on ? "" : "text-muted-foreground"}> +¥{rate.customer_price.toLocaleString()}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* 13. Other Options - カード型トグル（複数選択可） */}
      <div>
        <div className="flex items-center gap-2">
          <Label>オプション</Label>
          <span className="text-[10px] text-muted-foreground">複数選択可</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {availableOptions.map((optionName) => {
            const rate = optionRates.find((r) => r.option_name === optionName);
            const on = formData.selectedOptions.includes(optionName);
            return (
              <button
                key={optionName}
                type="button"
                onClick={() => handleOptionToggle(optionName)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm border-2 transition-colors text-left ${
                  on ? "bg-primary/10 border-primary text-foreground" : "bg-background border-border hover:bg-muted"
                }`}
              >
                <span className="font-medium leading-tight">{optionName}</span>
                <span className={`text-xs shrink-0 ${on ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  +¥{rate?.customer_price.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 14. 割引 - チェックボックス複数選択 */}
      <div>
        <Label>割引</Label>
        <div className="space-y-2 mt-2">
          {discounts.map((d) => (
            <label key={d.id} className="flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-muted/30">
              <Checkbox
                checked={formData.discount_ids.includes(d.id)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...formData.discount_ids, d.id]
                    : formData.discount_ids.filter(id => id !== d.id);
                  setFormData({ ...formData, discount_ids: next });
                }}
              />
              <span className="text-sm">{d.name}（{d.discount_type === "percentage" ? `-${d.discount_value}%` : `-¥${d.discount_value.toLocaleString()}`}）</span>
            </label>
          ))}
          {/* 割引額（ラジオ選択：なし / ¥1,000〜¥5,000） */}
          <div className="p-2 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">割引額</span>
              <span className="text-[10px] text-muted-foreground">クーポン等の値引き</span>
            </div>
            <RadioGroup
              value={String(customDiscount)}
              onValueChange={(v) => setCustomDiscount(Number(v))}
              className="flex flex-wrap gap-x-5 gap-y-2"
            >
              {[0, 1000, 2000, 3000, 4000, 5000].map((amt) => (
                <label key={amt} htmlFor={`disc-${amt}`} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <RadioGroupItem value={String(amt)} id={`disc-${amt}`} />
                  {amt === 0 ? "なし" : `-¥${amt.toLocaleString()}`}
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>

      {/* 15. お支払い方法 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>お支払い方法</Label>
          {!formData.payment_details && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                // 分割払いモードへ移行：現在の合計額を最初の行に設定
                setFormData({
                  ...formData,
                  payment_details: [{ method: formData.payment_method || "cash", amount: formData.price }],
                });
              }}
            >
              <Plus size={12} className="mr-1" />支払いを分割
            </Button>
          )}
          {formData.payment_details && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setFormData({ ...formData, payment_details: null })}
            >
              分割をやめる
            </Button>
          )}
        </div>

        {/* 通常（単一支払い）モード：ボタン選択 */}
        {!formData.payment_details && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "cash", label: "現金", note: "" },
              { value: "card", label: "カード", note: cardFeePct > 0 ? `手数料${cardFeePct}%` : "" },
              { value: "paypay", label: "PayPay", note: paypayFeePct > 0 ? `手数料${paypayFeePct}%` : "" },
            ].map((pm) => {
              const on = (formData.payment_method || "cash") === pm.value;
              return (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_method: pm.value })}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors leading-tight ${
                    on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {pm.label}
                  {pm.note && <span className={`block text-[10px] font-normal ${on ? "opacity-90" : "text-muted-foreground"}`}>{pm.note}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* 分割払いモード */}
        {formData.payment_details && (
          <div className="space-y-2">
            {formData.payment_details.map((d, i) => {
              const rowFee = calcPaymentFee(d.amount, paymentSettings, d.method);
              return (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={d.method}
                    onValueChange={(v) => {
                      const updated = formData.payment_details!.map((x, j) => j === i ? { ...x, method: v } : x);
                      setFormData({ ...formData, payment_details: updated });
                    }}
                  >
                    <SelectTrigger className="w-28 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="card">カード</SelectItem>
                      <SelectItem value="paypay">PayPay</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                    <Input
                      type="number"
                      min="0"
                      className="pl-7 h-9 text-sm"
                      value={d.amount === 0 ? "" : d.amount}
                      onChange={(e) => {
                        const updated = formData.payment_details!.map((x, j) =>
                          j === i ? { ...x, amount: Number(e.target.value) || 0 } : x
                        );
                        setFormData({ ...formData, payment_details: updated });
                      }}
                    />
                  </div>
                  {rowFee > 0 && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">手数料¥{rowFee.toLocaleString()}</span>
                  )}
                  {formData.payment_details!.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      onClick={() => {
                        const updated = formData.payment_details!.filter((_, j) => j !== i);
                        setFormData({ ...formData, payment_details: updated });
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs border-dashed"
              onClick={() => {
                setFormData({
                  ...formData,
                  payment_details: [...formData.payment_details!, { method: "cash", amount: 0 }],
                });
              }}
            >
              <Plus size={12} className="mr-1" />支払い行を追加
            </Button>
            {/* 合計チェック */}
            {(() => {
              const detailSum = formData.payment_details!.reduce((s, d) => s + d.amount, 0);
              const diff = formData.price - detailSum;
              return diff !== 0 ? (
                <p className={`text-xs ${diff > 0 ? "text-orange-500" : "text-rose-500"}`}>
                  {diff > 0
                    ? `残り ¥${diff.toLocaleString()} 未割当`
                    : `¥${Math.abs(diff).toLocaleString()} 超過しています`}
                </p>
              ) : (
                <p className="text-xs text-green-600">✓ 合計が一致しています</p>
              );
            })()}
          </div>
        )}
      </div>

      {/* 16. メールアドレス */}
      <div>
        <Label htmlFor="customer_email">メールアドレス</Label>
        <Input
          id="customer_email"
          type="email"
          placeholder="example@email.com"
          value={formData.customer_email}
          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
        />
      </div>

      {/* 17. 備考 */}
      <div>
        <Label htmlFor="notes">備考</Label>
        <Textarea
          id="notes"
          placeholder="特記事項があれば記入してください"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      {/* 17.5 お客様の好み（電話ヒアリング） */}
      <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          💆 お客様の好み（電話ヒアリング）
          {customerInfo && !prefsDirty && prefs.preferred_types.length > 0 && (
            <span className="text-[10px] font-normal text-green-600">登録済み</span>
          )}
        </p>
        <div>
          <Label className="text-xs">好みのタイプ</Label>
          <div className="grid grid-cols-4 gap-1.5 mt-1.5">
            {PREFERRED_TYPE_OPTIONS.map((type) => (
              <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={prefs.preferred_types.includes(type)}
                  onCheckedChange={() => {
                    const next = prefs.preferred_types.includes(type)
                      ? prefs.preferred_types.filter((t) => t !== type)
                      : [...prefs.preferred_types, type];
                    updatePrefs({ preferred_types: next });
                  }}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">会話の好み</Label>
          <Select
            value={prefs.conversation_level ?? "unset"}
            onValueChange={(v) => updatePrefs({ conversation_level: v === "unset" ? null : v })}
          >
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="未設定" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">未設定</SelectItem>
              {CONVERSATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">NG・アレルギー</Label>
          <Input
            placeholder="例：アロマオイルNG"
            value={prefs.ng_items}
            onChange={(e) => updatePrefs({ ng_items: e.target.value })}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">好みメモ</Label>
          <Textarea
            placeholder="例：足裏を長めにしてほしい"
            value={prefs.preference_notes}
            onChange={(e) => updatePrefs({ preference_notes: e.target.value })}
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">入力すると予約登録時に顧客カルテへ自動保存されます</p>
      </div>

      {/* 18. 合計金額表示 */}
      <div className="pt-4 border-t space-y-1">
        {liveTotals.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>割引</span>
            <span className="text-rose-600">-¥{liveTotals.discountAmount.toLocaleString()}</span>
          </div>
        )}
        {formData.payment_details ? (
          // 分割払い内訳
          formData.payment_details.map((d, i) => {
            const rowFee = calcPaymentFee(d.amount, paymentSettings, d.method);
            const label = d.method === "cash" ? "現金" : d.method === "paypay" ? "PayPay" : "カード";
            return (
              <div key={i} className="flex justify-between text-sm text-muted-foreground">
                <span>{label}</span>
                <span>
                  ¥{d.amount.toLocaleString()}
                  {rowFee > 0 && <span className="text-xs ml-1">（内手数料¥{rowFee.toLocaleString()}）</span>}
                </span>
              </div>
            );
          })
        ) : (
          liveTotals.fee > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>小計</span>
                <span>¥{liveTotals.totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>決済手数料</span>
                <span>+¥{liveTotals.fee.toLocaleString()}</span>
              </div>
            </>
          )
        )}
      </div>

      {/* 19. 合計金額＋登録ボタン（下部固定バー） */}
      <div className="sticky bottom-0 z-20 mt-2 flex items-center gap-3 border-t border-border bg-background/95 backdrop-blur py-3 -mb-1">
        <div className="shrink-0">
          <p className="text-[11px] text-muted-foreground leading-none mb-0.5">合計金額（総額）</p>
          <p className="text-2xl font-bold text-primary leading-none tabular-nums">
            ¥{(() => {
              // 決済手数料込みの総額（liveTotalsで即時反映・分割払いにも対応）
              const base = formData.payment_details
                ? formData.payment_details.reduce((s, d) => s + (d.amount || 0), 0)
                : liveTotals.totalPrice;
              return (base + liveTotals.fee).toLocaleString();
            })()}
          </p>
        </div>
        <Button onClick={handleSubmit} size="lg" className="flex-1 h-12 text-base">
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
