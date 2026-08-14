import { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, addMonths, subMonths, parse, addMinutes, startOfMonth, endOfMonth, startOfWeek, eachDayOfInterval } from "date-fns";
import { toExtTime, toStoredTime } from "@/lib/timeFormat";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, TrendingUp, Calendar as CalendarIcon, X, Pencil, MessageSquare, Heart, Zap, Trash2, Share2, Loader2 } from "lucide-react";
import paypayGuideUrl from "@/assets/paypay-guide.jpeg";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { TabMenu } from "@/components/TabMenu";
import { DailyReservationTimeline } from "@/components/DailyReservationTimeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReservationForm } from "@/components/ReservationForm";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { findPaymentSetting, PaymentSetting } from "@/lib/paymentFee";
import { openSmsApp } from "@/lib/sms";
import { useAdminStore } from "@/hooks/useAdminStore";
import { PaymentReminderPopup } from "@/components/PaymentReminderPopup";
import { loadReceptionEndGuide, shareReceptionEndContent } from "@/lib/receptionEndShare";

interface Cast {
  id: string;
  name: string;
  photo: string | null;
}

interface Shift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
}

interface Reservation {
  id: string;
  cast_id: string;
  reservation_date: string;
  start_time: string;
  duration: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  course_name: string;
  course_type: string | null;
  nomination_type: string | null;
  price: number;
  discount: number | null;
  discount_ids: string[] | null;
  options: string[] | null;
  payment_method: string | null;
  payment_fee: number | null;
  status: string;
  payment_status: string;
  room: string | null;
  notes: string | null;
}

const TIME_START = 10;
const TIME_END = 26;
const HOUR_HEIGHT = 80; // px per hour (vertical)
const TIME_LABEL_W = 48;

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 border-blue-400 text-blue-900",
  hold: "bg-amber-100 border-amber-400 text-amber-900",
  completed: "bg-emerald-100 border-emerald-400 text-emerald-900",
  cancelled: "bg-rose-100 border-rose-300 text-rose-700 opacity-50",
  // 確定前のWEB予約（旧ステータスを含む）
  pending: "bg-purple-100 border-purple-400 text-purple-900",
  sms_waiting: "bg-purple-100 border-purple-400 text-purple-900",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "確定",
  hold: "保留",
  completed: "完了",
  cancelled: "キャンセル",
};

const TOTAL_HEIGHT = (TIME_END - TIME_START) * HOUR_HEIGHT;

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  // 深夜またぎ（06:00 未満）は +24h で翌枠に配置
  return (h < 6 ? h + 24 : h) * 60 + m;
}

// 延長オプションによる追加施術分数（option_rates.extension_minutes の合計）
function getExtMinutes(options: string[] | null | undefined, optionRates: any[]): number {
  if (!options || options.length === 0) return 0;
  return options.reduce((sum, name) => {
    const o = optionRates.find((r) => r.option_name === name);
    return sum + (o?.extension_minutes ?? 0);
  }, 0);
}

function minutesToPx(minutes: number) {
  return ((minutes - TIME_START * 60) / 60) * HOUR_HEIGHT;
}

// 早朝(06:00未満)の予約は前営業日の延長時刻として表示する
// 例: 6/28 00:40（カレンダー日付保存）→ 6/27 24:40〜 と表示
function extBusinessDateTime(reservationDate: string, startTime: string): { dateStr: string; timeStr: string } {
  const [h] = startTime.split(":").map(Number);
  const base = new Date(`${reservationDate}T00:00:00`);
  const displayDate = h < 6 ? subDays(base, 1) : base;
  return {
    dateStr: format(displayDate, "M月d日(E)", { locale: ja }),
    timeStr: toExtTime(startTime),
  };
}

// 当日ステータスボード：予約詳細と同じステータス種別に統一（キャンセルは日別表示から除外）
const BOARD_STATUSES = ["confirmed", "hold", "completed"] as const;

const BOARD_STATUS_STYLE: Record<string, { header: string; border: string }> = {
  confirmed: { header: "bg-blue-100 text-blue-800", border: "border-blue-300" },
  hold: { header: "bg-amber-100 text-amber-800", border: "border-amber-300" },
  completed: { header: "bg-emerald-100 text-emerald-800", border: "border-emerald-300" },
};

function StatusBox({
  status,
  reservations,
  castNameMap,
  onStatusChange,
  onEdit,
  onSms,
  onThanksSms,
  onCouponSms,
  isAdmin,
}: {
  status: string;
  reservations: Reservation[];
  castNameMap: Map<string, string>;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (res: Reservation) => void;
  onSms: (res: Reservation) => void;
  onThanksSms: (res: Reservation) => void;
  onCouponSms: (res: Reservation) => void;
  isAdmin: boolean;
}) {
  const style = BOARD_STATUS_STYLE[status];
  return (
    <div className={`rounded-lg border-2 ${style.border} bg-white flex flex-col`}>
      <div className={`px-3 py-2 rounded-t-lg ${style.header} font-bold text-sm flex items-center justify-between`}>
        <span>{STATUS_LABELS[status]}</span>
        <span className="text-xs font-normal opacity-80">{reservations.length}件</span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[80px] max-h-[360px] overflow-y-auto">
        {reservations.length === 0 ? (
          <p className="text-center text-muted-foreground text-xs py-4">なし</p>
        ) : (
          reservations.map((res) => (
            <div key={res.id} className="bg-gray-50 rounded-md p-2 text-xs border border-gray-100">
              <div className="font-semibold mb-0.5">{res.customer_name}</div>
              <div className="text-muted-foreground space-y-0.5">
                <div>{toExtTime(res.start_time)}（{res.duration}分）</div>
                <div>{castNameMap.get(res.cast_id) ?? "未設定"} / {res.course_name}</div>
                <div>{res.customer_phone}</div>
              </div>
              <div className="mt-1.5 flex gap-1 flex-wrap">
                <button
                  onClick={() => onSms(res)}
                  className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                >
                  SMS
                </button>
                <button
                  onClick={() => onThanksSms(res)}
                  className="text-[10px] px-1.5 py-0.5 rounded border bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100 transition-colors font-medium"
                >
                  サンクス
                </button>
                <button
                  onClick={() => onCouponSms(res)}
                  className="text-[10px] px-1.5 py-0.5 rounded border bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors font-medium"
                >
                  クーポン
                </button>
                {isAdmin && (
                  <button
                    onClick={() => onEdit(res)}
                    className="text-[10px] px-1.5 py-0.5 rounded border bg-white border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
                  >
                    編集
                  </button>
                )}
              </div>
              <div className="mt-1 flex gap-1 flex-wrap">
                {BOARD_STATUSES.filter((s) => s !== status).map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatusChange(res.id, s)}
                    className="text-[10px] px-1.5 py-0.5 rounded border bg-white border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {STATUS_LABELS[s]}へ
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Schedule() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedView, setSelectedView] = useState<"cast" | "room">("cast");
  const [shifts, setShifts] = useState<(Shift & { cast: Cast })[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [castAccessTokens, setCastAccessTokens] = useState<Record<string, string>>({});
  const [receptionEndGuideFile, setReceptionEndGuideFile] = useState<File | null>(null);
  const [receptionEndGuideError, setReceptionEndGuideError] = useState(false);
  const [sharingReceptionEndCastId, setSharingReceptionEndCastId] = useState<string | null>(null);

  // Detail/Edit sheet
  const [detailRes, setDetailRes] = useState<Reservation | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editStatus, setEditStatus] = useState<string>("confirmed");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { user, loading: authLoading, isAdmin } = useAuth();
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [dayStartTime, setDayStartTime] = useState("10:00:00");
  const [storeDayStartLoaded, setStoreDayStartLoaded] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
    course_type: "全力",
    course_name: "全力 80分",
    selectedOptions: [] as string[],
    discount_ids: [] as string[],
    discount: 0,
    price: 19000,
    payment_method: "cash",
    payment_fee: 0,
    payment_details: null as { method: string; amount: number }[] | null,
    reservation_method: "",
    notes: "",
  });

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
    course_type: "aroma",
    course_name: "",
    selectedOptions: [] as string[],
    discount_ids: [] as string[],
    discount: 0,
    price: 0,
    payment_method: "cash",
    payment_fee: 0,
    payment_details: null as { method: string; amount: number }[] | null,
    reservation_method: "",
    notes: "",
  });

  const [casts, setCasts] = useState<Cast[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; address: string | null; sms_text: string | null; map_url: string | null; caution_text: string | null }[]>([]);
  const [backRates, setBackRates] = useState<any[]>([]);
  const [optionRates, setOptionRates] = useState<any[]>([]);
  const [nominationRates, setNominationRates] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<{ id: string; name: string; discount_type: "fixed" | "percentage"; discount_value: number }[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [thanksTemplate, setThanksTemplate] = useState<string | null>(null);
  const [couponTemplate, setCouponTemplate] = useState<string | null>(null);

  // 口コミURL等を店舗ドメインに追従させる（艶華なら enka-salon.jp）
  const { store: adminStore } = useAdminStore();
  const reviewBaseUrl = adminStore?.custom_domain
    ? `https://${adminStore.custom_domain}`
    : "https://zenryokuesthe.com";

  // iPhoneではボタン操作直後に共有画面を開く必要があるため、画像を先にFile化しておく。
  useEffect(() => {
    const controller = new AbortController();
    setReceptionEndGuideError(false);
    loadReceptionEndGuide(controller.signal)
      .then(setReceptionEndGuideFile)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("追加オプション入力マニュアルの読み込みに失敗しました:", error);
        setReceptionEndGuideError(true);
      });
    return () => controller.abort();
  }, []);

  // useShopSettings は先頭1件を返すため、営業日の境界だけは管理中の店舗を明示して取得する。
  useEffect(() => {
    let active = true;
    if (!adminStore?.id) {
      setStoreDayStartLoaded(false);
      return () => { active = false; };
    }

    setStoreDayStartLoaded(false);
    supabase
      .from("shop_settings")
      .select("business_day_start, reservation_interval_minutes")
      .eq("store_id", adminStore.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("店舗の営業開始時刻の取得に失敗しました:", error);

        const configuredStart = data?.business_day_start || "10:00";
        const normalizedStart = configuredStart.length === 5
          ? `${configuredStart}:00`
          : configuredStart;
        setDayStartTime(normalizedStart);
        setIntervalMinutes(data?.reservation_interval_minutes ?? 30);

        const [startHour, startMinute] = normalizedStart.split(":").map(Number);
        const now = new Date();
        const beforeBusinessStart = now.getHours() * 60 + now.getMinutes()
          < startHour * 60 + startMinute;
        setSelectedDate(beforeBusinessStart ? addDays(now, -1) : now);
        setStoreDayStartLoaded(true);
      });

    return () => { active = false; };
  }, [adminStore?.id]);

  // クーポン案内SMS用の店舗公式LINE URL（store_info から自店舗分を取得）
  const [storeLineUrl, setStoreLineUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!adminStore?.id) return;
    supabase
      .from("store_info")
      .select("line_url")
      .eq("store_id", adminStore.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setStoreLineUrl(data?.line_url ?? null));
  }, [adminStore?.id]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  // 新規予約フォームの初期コースが自店舗に存在しない場合、先頭のコースに合わせる
  useEffect(() => {
    if (backRates.length === 0) return;
    setFormData((prev) => {
      if (backRates.some((r: any) => r.course_type === prev.course_type)) return prev;
      const first = backRates[0];
      return { ...prev, course_type: first.course_type, course_name: `${first.course_type} ${prev.duration}分` };
    });
  }, [backRates]);

  useEffect(() => {
    if (user && adminStore?.id && storeDayStartLoaded) fetchData();
  }, [user, selectedDate, adminStore?.id, storeDayStartLoaded, dayStartTime]);

  useEffect(() => {
    if (user && adminStore?.id) fetchFormData();
  }, [user, adminStore?.id]);

  const fetchFormData = async () => {
    if (!adminStore?.id) return;
    const [{ data: c }, { data: r }, { data: b }, { data: o }, { data: n }, { data: d }, { data: p }, { data: t }, { data: cp }, tokenResult] = await Promise.all([
      supabase.from("casts").select("id, name, photo").order("name"),
      supabase.from("rooms").select("id, name, address, sms_text, map_url, caution_text").eq("is_active", true).order("name"),
      supabase.from("back_rates").select("*").order("display_order"),
      supabase.from("option_rates").select("*").order("display_order"),
      supabase.from("nomination_rates").select("*"),
      supabase.from("discounts").select("id, name, discount_type, discount_value, is_active").eq("is_active", true).order("name"),
      supabase.from("payment_settings").select("id, payment_method, payment_link, fee_percentage"),
      supabase.from("sms_auto_templates").select("message").eq("store_id", adminStore.id).eq("trigger", "thanks").eq("is_active", true).limit(1),
      supabase.from("sms_auto_templates").select("message").eq("store_id", adminStore.id).eq("trigger", "coupon").eq("is_active", true).limit(1),
      supabase.rpc("get_cast_access_tokens"),
    ]);
    if (c) setCasts(c);
    if (r) setRooms(r);
    if (b) setBackRates(b);
    if (o) setOptionRates(o);
    if (n) setNominationRates(n);
    if (d) setDiscounts(d as any);
    if (p) setPaymentSettings(p as PaymentSetting[]);
    setThanksTemplate(t && t.length > 0 ? t[0].message : null);
    setCouponTemplate(cp && cp.length > 0 ? cp[0].message : null);
    if (tokenResult.error) {
      console.error("セラピストマイページURLの取得に失敗しました:", tokenResult.error);
      setCastAccessTokens({});
    } else {
      setCastAccessTokens(Object.fromEntries(
        (tokenResult.data || []).map((row) => [row.cast_id, row.access_token]),
      ));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const nextDateStr = format(addDays(selectedDate, 1), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");

    // 深夜またぎ分（翌月1日の営業開始前＝当月末の営業日扱い）まで含めて取得
    const monthEndNext = format(addDays(endOfMonth(selectedDate), 1), "yyyy-MM-dd");

    const [
      { data: shiftsData },
      { data: reservationsData },
      { data: nextResData },
      { data: clearanceData },
      { data: monthResData },
    ] = await Promise.all([
      supabase.from("shifts").select("*, cast:casts(id, name, photo)").eq("store_id", adminStore!.id).eq("shift_date", dateStr),
      supabase.from("reservations").select("*").eq("reservation_date", dateStr).gte("start_time", dayStartTime).neq("status", "cancelled"),
      // 深夜またぎ：翌日日付で保存されているが営業開始前の予約は当日扱い
      supabase.from("reservations").select("*").eq("reservation_date", nextDateStr).lt("start_time", dayStartTime).neq("status", "cancelled"),
      // 月次合計は日別精算（実額）を正とする
      supabase.from("daily_clearances").select("date, total_sales").eq("store_id", adminStore!.id).gte("date", monthStart).lte("date", monthEnd),
      // 精算未入力の日（当日など）は完了予約の金額で補完する
      supabase.from("reservations").select("price, reservation_date, start_time").eq("store_id", adminStore!.id).gte("reservation_date", monthStart).lte("reservation_date", monthEndNext).eq("status", "completed"),
    ]);

    setShifts((shiftsData as any) || []);
    setReservations([...(reservationsData || []), ...(nextResData || [])]);
    // 営業日単位で「精算があれば精算合計、なければ完了予約合計」を積み上げる
    const clearanceByDay = new Map<string, number>();
    for (const c of (clearanceData || []) as any[]) {
      clearanceByDay.set(c.date, (clearanceByDay.get(c.date) || 0) + (c.total_sales || 0));
    }
    const resByDay = new Map<string, number>();
    for (const r of (monthResData || []) as any[]) {
      const bday = r.start_time < dayStartTime
        ? format(addDays(new Date(`${r.reservation_date}T12:00:00`), -1), "yyyy-MM-dd")
        : r.reservation_date;
      if (bday < monthStart || bday > monthEnd) continue;
      resByDay.set(bday, (resByDay.get(bday) || 0) + (r.price || 0));
    }
    let monthTotal = 0;
    for (const day of new Set([...clearanceByDay.keys(), ...resByDay.keys()])) {
      monthTotal += clearanceByDay.has(day) ? clearanceByDay.get(day)! : (resByDay.get(day) || 0);
    }
    setMonthlyTotal(monthTotal);
    setLoading(false);
  };

  const shareReceptionEnd = async (castId: string) => {
    const accessToken = castAccessTokens[castId];
    if (!accessToken) {
      toast({
        title: "マイページが未発行です",
        description: "セラピストマイページからアクセスリンクを発行してください。",
        variant: "destructive",
      });
      return;
    }
    if (!receptionEndGuideFile) {
      toast({
        title: "画像マニュアルを準備できませんでした",
        description: "画面を再読み込みして、もう一度お試しください。",
        variant: "destructive",
      });
      return;
    }
    if (sharingReceptionEndCastId) return;

    const portalBase = adminStore?.custom_domain
      ? `https://${adminStore.custom_domain}`
      : (import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin);
    const portalUrl = `${portalBase}/therapist/${encodeURIComponent(accessToken)}`;

    setSharingReceptionEndCastId(castId);
    try {
      const result = await shareReceptionEndContent(portalUrl, receptionEndGuideFile);
      if (result.status === "shared") {
        toast({ title: "共有内容を送信先へ渡しました" });
      } else if (result.status === "fallback") {
        toast({
          title: result.urlCopied
            ? "ポータルURLをコピーしました"
            : "画像マニュアルを保存しました",
          description: result.urlCopied
            ? "画像マニュアルも保存したので、2つを送信先へ共有してください。"
            : "ポータルURLはコピーできなかったため、画面からコピーしてください。",
        });
      }
    } catch (error) {
      toast({
        title: "共有画面を開けませんでした",
        description: error instanceof Error ? error.message : "もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setSharingReceptionEndCastId(null);
    }
  };

  const dailyTotal = useMemo(() => reservations.reduce((sum, r) => sum + (r.price || 0), 0), [reservations]);
  const castNameMap = useMemo(() => {
    const m = new Map<string, string>();
    casts.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [casts]);

  const castRows = useMemo(() => {
    const map = new Map<string, {
      cast: Cast;
      shift: (Shift & { cast: Cast }) | null;
      reservations: Reservation[];
    }>();

    shifts.forEach((shift) => {
      if (!map.has(shift.cast_id)) {
        map.set(shift.cast_id, { cast: shift.cast, shift, reservations: [] });
      }
    });

    reservations.forEach((reservation) => {
      let row = map.get(reservation.cast_id);
      if (!row) {
        const cast = casts.find((candidate) => candidate.id === reservation.cast_id) ?? {
          id: reservation.cast_id,
          name: "未設定",
          photo: null,
        };
        row = { cast, shift: null, reservations: [] };
        map.set(reservation.cast_id, row);
      }
      row.reservations.push(reservation);
    });

    return Array.from(map.values());
  }, [shifts, reservations, casts]);

  // セラピスト別の最短ご案内時間（60分枠が入る最初の時刻を探索）
  const earliestSlots = useMemo(() => {
    const DUR = 60;           // 最短案内の目安コース時間
    const INTERVAL = intervalMinutes; // 予約後のインターバル（店舗設定）
    const ceil10 = (m: number) => Math.ceil(m / 10) * 10;
    const nowD = new Date();
    const rawNow = nowD.getHours() * 60 + nowD.getMinutes();
    const nowExt = nowD.getHours() < 6 ? rawNow + 1440 : rawNow;
    const todaySel = format(selectedDate, "yyyy-MM-dd") === format(nowD, "yyyy-MM-dd");

    return castRows.map(({ cast }) => {
      const castShifts = shifts
        .filter((sh) => sh.cast_id === cast.id)
        .map((sh) => {
          const st = timeToMinutes(sh.start_time);
          let en = timeToMinutes(sh.end_time);
          if (en <= st) en += 1440;
          return { st, en };
        })
        .sort((a, b) => a.st - b.st);
      const resv = reservations
        .filter((r) => r.cast_id === cast.id && r.status !== "cancelled")
        .map((r) => {
          const st = timeToMinutes(r.start_time);
          return { st, en: st + r.duration + getExtMinutes(r.options, optionRates) + INTERVAL };
        })
        .sort((a, b) => a.st - b.st);

      for (const sh of castShifts) {
        let cand = ceil10(Math.max(sh.st, todaySel ? nowExt : sh.st));
        let moved = true;
        while (moved) {
          moved = false;
          for (const r of resv) {
            if (cand + DUR > r.st && cand < r.en) {
              cand = ceil10(r.en);
              moved = true;
            }
          }
        }
        if (cand + DUR <= sh.en) {
          const isNow = todaySel && cand <= nowExt + 10;
          const h = Math.floor(cand / 60);
          const mm = String(cand % 60).padStart(2, "0");
          return { castId: cast.id, name: cast.name, label: isNow ? "今すぐOK" : `${h}:${mm}〜`, now: isNow };
        }
      }
      return { castId: cast.id, name: cast.name, label: "受付終了", now: false };
    });
  }, [castRows, shifts, reservations, selectedDate, intervalMinutes]);

  const hours = Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
  const nowPx = minutesToPx(nowMinutes);

  const handleTimelineClick = (castId: string, clickY: number) => {
    if (!isAdmin) return;
    const totalMin = TIME_START * 60 + (clickY / HOUR_HEIGHT) * 60;
    const snapped = Math.floor(totalMin / 10) * 10;
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    setFormData((prev) => ({ ...prev, cast_id: castId, reservation_date: selectedDate, start_time: timeStr }));
    setIsAddOpen(true);
  };

  const handleAddReservation = async () => {
    if (!isAdmin || !user) return;
    try {
      const storedStart = toStoredTime(formData.start_time);
      const storedDate = addDays(formData.reservation_date, storedStart.dayOffset);
      const { error } = await supabase.from("reservations").insert([{
        cast_id: formData.cast_id,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email || null,
        reservation_date: format(storedDate, "yyyy-MM-dd"),
        start_time: storedStart.time,
        duration: formData.duration,
        course_type: formData.course_type,
        course_name: formData.course_name,
        options: formData.selectedOptions,
        nomination_type: formData.nomination_type === "none" ? null : formData.nomination_type,
        price: formData.price,
        discount: formData.discount || 0,
        discount_ids: formData.discount_ids ?? [],
        payment_method: formData.payment_details ? null : (formData.payment_method || "cash"),
        payment_fee: formData.payment_fee || 0,
        payment_details: formData.payment_details || null,
        notes: formData.notes || null,
        room: formData.room || null,
        status: "confirmed",
        created_by: user.id,
      }]);
      if (error) throw error;
      toast({ title: "予約追加", description: "新しい予約が追加されました" });
      setIsAddOpen(false);
      fetchData();
    } catch {
      toast({ title: "エラー", description: "予約の追加に失敗しました", variant: "destructive" });
    }
  };

  const buildReservationSms = (d: Reservation): string => {
    const { dateStr, timeStr } = extBusinessDateTime(d.reservation_date, d.start_time);
    const castName = castNameMap.get(d.cast_id) ?? "";
    const nominationLabel = d.nomination_type && d.nomination_type !== "none" ? d.nomination_type : "フリー";
    const fee = d.payment_fee || 0;
    const grandTotal = d.price + fee;
    const paySetting = findPaymentSetting(paymentSettings, d.payment_method || "");
    const payLink = fee > 0 && paySetting?.payment_link ? paySetting.payment_link : null;
    const roomRecord = rooms.find((r) => r.name === d.room);
    const roomSmsText = roomRecord?.sms_text ?? null;
    const roomAddress = roomRecord?.address ?? null;
    const roomMapUrl = roomRecord?.map_url ?? null;
    const roomCautionText = roomRecord?.caution_text ?? null;

    const backRate = backRates.find(
      (r) => r.course_type === d.course_type && r.duration === d.duration
    );
    const coursePrice = backRate?.customer_price ?? 0;
    const optionsTotal = (d.options ?? []).reduce((sum, optName) => {
      const opt = optionRates.find((r) => r.option_name === optName);
      return sum + (opt?.customer_price ?? 0);
    }, 0);
    const nominationFee = d.nomination_type && d.nomination_type !== "none"
      ? (nominationRates.find((r) => r.nomination_type === d.nomination_type)?.customer_price ?? 0)
      : 0;
    const discountAmount = d.discount ?? 0;

    // 「総額10,000円クーポン(初回)」選択時はLINE追加の案内を追記する
    const needsLineCouponNote = (d.discount_ids ?? []).some((discId) => {
      const disc = discounts.find((x) => x.id === discId);
      return !!disc && disc.name.includes("総額10,000円クーポン");
    });

    // 艶華の予約確認SMSは、来店に必要な情報だけを短く表示する。
    // ルームの sms_text に含まれる店舗情報・口コミ案内は除外し、
    // 住所・目印・地図・入室時刻だけを再構成する。
    if (adminStore?.custom_domain === "enka-salon.jp") {
      const roomGuideText = roomSmsText?.split("【注意事項】")[0] ?? "";
      const rawRoomNote = roomGuideText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith("※"));
      const roomNote = rawRoomNote
        ?.replace(
          "※1階にある炭火焼き鳥四代目『はしもとや』が目印です。",
          "目印：1階「はしもとや」"
        )
        .replace(
          "※11階にお部屋がございます。1階とお間違い無いようにご注意ください。",
          "※11階です（1階とお間違いないようご注意ください）"
        );
      const embeddedMapUrl = roomSmsText?.match(/https?:\/\/[^\s]+/)?.[0] ?? null;
      const effectiveMapUrl = roomMapUrl ?? embeddedMapUrl;
      const therapistLabel = !castName || castName === "フリー"
        ? "フリー"
        : `${castName}（${nominationLabel}）`;

      return [
        `${d.customer_name} 様`,
        "ご予約ありがとうございます。",
        "",
        "【予約内容】",
        `${dateStr} ${timeStr}〜`,
        d.course_name,
        (d.options ?? []).length > 0 ? `オプション：${(d.options ?? []).join("、")}` : null,
        `担当：${therapistLabel}`,
        `合計：${grandTotal.toLocaleString()}円`,
        d.notes?.trim() ? `ご要望：${d.notes.trim()}` : null,
        ...(payLink ? ["", `${paySetting?.payment_method ?? "カード"}決済：${payLink}`] : []),
        ...(needsLineCouponNote && storeLineUrl
          ? ["", `クーポン受取LINE：${storeLineUrl}`]
          : []),
        d.room || roomAddress || effectiveMapUrl
          ? [
              "",
              d.room ? `【ルーム案内｜${d.room}】` : "【ルーム案内】",
              roomAddress,
              roomNote,
              effectiveMapUrl ? `地図：${effectiveMapUrl}` : null,
              "",
              "※予約時間ちょうどにインターホンを押してください。",
              "開始前は応答できません。",
            ].filter((line) => line !== null).join("\n")
          : null,
      ].filter((line) => line !== null).join("\n");
    }

    return [
      `${d.customer_name} 様`,
      `ご予約ありがとうございます。`,
      ``,
      `[予約情報]`,
      `予約日時：${dateStr} ${timeStr}〜`,
      `コース：${d.course_name}`,
      (d.options ?? []).length > 0 ? `オプション：${(d.options ?? []).join("、")}` : null,
      `セラピスト：${castName ? `${castName}（${nominationLabel}）` : nominationLabel}`,
      d.room ? `ルーム：${d.room}` : null,
      roomAddress ? `住所：${roomAddress}` : null,
      `予約名：${d.customer_name}`,
      `ご要望など：${d.notes ?? ""}`,
      ``,
      `[料金]`,
      `コース料金：${coursePrice.toLocaleString()}円`,
      optionsTotal > 0 ? `オプション料金：${optionsTotal.toLocaleString()}円` : null,
      `指名料：${nominationFee.toLocaleString()}円`,
      discountAmount > 0 ? `割引：-${discountAmount.toLocaleString()}円` : null,
      `決済手数料：${fee.toLocaleString()}円`,
      `総額：${grandTotal.toLocaleString()}円`,
      ...(payLink ? [``, `▼${paySetting?.payment_method ?? "カード"}決済はこちら`, payLink] : []),
      ...(needsLineCouponNote
        ? [``, `クーポン受け取り用に下記のLINEを追加お願いいたします。`, ...(storeLineUrl ? [storeLineUrl] : [])]
        : []),
      roomSmsText
        ? `\n${roomSmsText}${roomMapUrl ? `\n\n📍${roomMapUrl}` : ""}`
        : roomAddress
          ? `\n【住所】\n${roomAddress}${roomMapUrl ? `\n📍${roomMapUrl}` : ""}`
          : roomMapUrl ? `\n📍${roomMapUrl}` : null,
      roomCautionText ? `\n【注意事項】\n${roomCautionText}` : null,
      castName
        ? [
            `\n▼口コミはこちら`,
            `${reviewBaseUrl}/review`,
            `（担当名に「${castName}」とご記入いただけると嬉しいです）`,
          ].join("\n")
        : null,
    ].filter((l) => l !== null).join("\n");
  };

  // コピーしつつ端末のSMS送信画面を開く（宛先＝予約の電話番号、本文プリセット）
  // 同時にセラピストのグループLINEへも予約内容を自動共有（送り忘れ防止）
  const openReservationSms = (d: Reservation) => {
    const body = buildReservationSms(d);
    navigator.clipboard.writeText(body).catch(() => {});
    toast({ title: "SMS送信画面を開きます", description: "本文はコピー済みです" });
    openSmsApp(d.customer_phone, body);

    const { dateStr, timeStr } = extBusinessDateTime(d.reservation_date, d.start_time);
    supabase.functions
      .invoke("notify-line-therapist", {
        body: {
          cast_id: d.cast_id,
          customer_name: d.customer_name,
          cast_name: castNameMap.get(d.cast_id) ?? "未設定",
          reservation_date: dateStr,
          start_time: timeStr,
          course_name: d.course_name,
          room: d.room,
          options: d.options,
          notes: d.notes,
        },
      })
      .then(({ error }) => {
        if (error) {
          toast({ title: "セラピストLINEへの共有に失敗", description: "このセラピストのグループが未連携の可能性があります（グループ内で「連携 名前」を送信）", variant: "destructive" });
        } else {
          toast({ title: "セラピストLINEへ共有しました" });
        }
      });
  };

  const buildThanksSms = (d: Reservation): string | null => {
    if (!thanksTemplate) return null;
    const { dateStr } = extBusinessDateTime(d.reservation_date, d.start_time);
    return thanksTemplate
      .replaceAll("{customer_name}", d.customer_name)
      .replaceAll("{date}", dateStr)
      .replaceAll("{cast_name}", castNameMap.get(d.cast_id) ?? "")
      .replaceAll("{course_name}", d.course_name);
  };

  const openThanksSms = (d: Reservation) => {
    const body = buildThanksSms(d);
    if (!body) {
      toast({
        title: "サンクスSMSが未登録です",
        description: "システム > SMS自動送信 でトリガー「サンクスSMS」のテンプレートを登録してください",
        variant: "destructive",
      });
      return;
    }
    navigator.clipboard.writeText(body).catch(() => {});
    toast({ title: "SMS送信画面を開きます", description: "本文はコピー済みです" });
    openSmsApp(d.customer_phone, body);
  };

  const openCouponSms = (d: Reservation) => {
    if (!couponTemplate) {
      toast({
        title: "クーポンSMSが未登録です",
        description: "システム > SMS自動送信 でトリガー「クーポン送付」のテンプレートを登録してください",
        variant: "destructive",
      });
      return;
    }
    const { dateStr } = extBusinessDateTime(d.reservation_date, d.start_time);
    const body = couponTemplate
      .replaceAll("{customer_name}", d.customer_name)
      .replaceAll("{date}", dateStr)
      .replaceAll("{cast_name}", castNameMap.get(d.cast_id) ?? "")
      .replaceAll("{course_name}", d.course_name);
    navigator.clipboard.writeText(body).catch(() => {});
    toast({ title: "SMS送信画面を開きます", description: "本文はコピー済みです" });
    openSmsApp(d.customer_phone, body);
  };

  const openDetail = (res: Reservation) => {
    setDetailRes(res);
    setEditStatus(res.status);
    setEditMode(false);
  };

  // 編集モードに入るとき、予約データを ReservationForm の形に展開
  const startEdit = (target?: Reservation) => {
    const res = target ?? detailRes;
    if (!res) return;
    const storedDate = new Date(`${res.reservation_date}T00:00:00`);
    const displayTime = toExtTime(res.start_time);
    const displayDate = displayTime !== res.start_time.slice(0, 5) ? subDays(storedDate, 1) : storedDate;
    setDetailRes(res);
    setEditStatus(res.status);
    setEditFormData({
      cast_id: res.cast_id,
      customer_name: res.customer_name,
      customer_phone: res.customer_phone,
      customer_email: res.customer_email ?? "",
      nomination_type: res.nomination_type ?? "none",
      reservation_date: displayDate,
      start_time: displayTime,
      end_time: "",
      duration: res.duration,
      room: res.room ?? "",
      course_type: res.course_type ?? "aroma",
      course_name: res.course_name,
      selectedOptions: res.options ?? [],
      discount_ids: res.discount_ids || [],
      discount: res.discount ?? 0,
      price: res.price,
      payment_method: res.payment_method ?? "cash",
      payment_fee: res.payment_fee ?? 0,
      payment_details: (res as any).payment_details ?? null,
      reservation_method: "",
      notes: res.notes ?? "",
    });
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!detailRes) return;
    try {
      const storedStart = toStoredTime(editFormData.start_time);
      const storedDate = addDays(editFormData.reservation_date, storedStart.dayOffset);
      // Recompute price from master data to avoid stale-state race conditions
      const dur = Number(editFormData.duration);
      const backRate = backRates.find((r) => r.course_type === editFormData.course_type && r.duration === dur);
      let subtotal = backRate?.customer_price ?? 0;
      (editFormData.selectedOptions ?? []).forEach((optName) => {
        subtotal += optionRates.find((r) => r.option_name === optName)?.customer_price ?? 0;
      });
      if (editFormData.nomination_type && editFormData.nomination_type !== "none") {
        subtotal += nominationRates.find((r) => r.nomination_type === editFormData.nomination_type)?.customer_price ?? 0;
      }
      // 割引はフォーム側（ReservationForm）がマスタ割引＋自由割引を合算して
      // editFormData.discount に同期済み。ここで discount_ids だけから再計算すると
      // 自由割引（クーポン等の任意金額）が消えてしまうため、フォームの合計値を採用する。
      const formDiscount = Math.max(0, Number(editFormData.discount ?? 0));
      const discountAmt = subtotal > 0 ? Math.min(formDiscount, subtotal) : formDiscount;
      const computedPrice = subtotal > 0 ? subtotal - discountAmt : Number(editFormData.price);
      const computedDiscount = discountAmt;
      const courseName = `${editFormData.course_type} ${dur}分`;

      const { error } = await supabase.from("reservations").update({
        cast_id: editFormData.cast_id,
        customer_name: editFormData.customer_name,
        customer_phone: editFormData.customer_phone,
        customer_email: editFormData.customer_email || null,
        reservation_date: format(storedDate, "yyyy-MM-dd"),
        start_time: storedStart.time,
        duration: dur,
        course_type: editFormData.course_type,
        course_name: courseName,
        options: editFormData.selectedOptions,
        nomination_type: editFormData.nomination_type === "none" ? null : editFormData.nomination_type,
        price: computedPrice,
        discount: computedDiscount,
        discount_ids: editFormData.discount_ids ?? [],
        payment_method: editFormData.payment_details ? null : (editFormData.payment_method || "cash"),
        payment_fee: editFormData.payment_fee || 0,
        payment_details: editFormData.payment_details || null,
        room: editFormData.room || null,
        status: editStatus,
        notes: editFormData.notes || null,
      }).eq("id", detailRes.id);
      if (error) throw error;
      toast({ title: "更新しました" });
      setEditMode(false);
      setDetailRes(null);
      fetchData();
    } catch {
      toast({ title: "エラー", description: "更新に失敗しました", variant: "destructive" });
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    // 楽観的更新
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    const { error } = await supabase.from("reservations").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast({ title: "エラー", description: "ステータスの更新に失敗しました", variant: "destructive" });
      fetchData();
    }
  };

  const handleCancelReservation = async () => {
    if (!detailRes || !confirm("この予約をキャンセルしますか？")) return;
    try {
      const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", detailRes.id);
      if (error) throw error;
      toast({ title: "キャンセルしました" });
      setDetailRes(null);
      fetchData();
    } catch {
      toast({ title: "エラー", description: "キャンセルに失敗しました", variant: "destructive" });
    }
  };

  const handlePermanentlyDeleteReservation = async () => {
    if (!detailRes) return;
    try {
      const { error } = await supabase.from("reservations").delete().eq("id", detailRes.id);
      if (error) throw error;
      toast({ title: "予約データを削除しました" });
      setDeleteConfirmOpen(false);
      setEditMode(false);
      setDetailRes(null);
      fetchData();
    } catch {
      toast({ title: "エラー", description: "予約データの削除に失敗しました", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentReminderPopup />
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-3 md:p-4">
          {/* Header */}
          <div className="space-y-2 mb-2">
            {/* Row 1: month navigation */}
            <div className="flex items-center justify-center gap-1 flex-wrap">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(startOfMonth(subMonths(selectedDate, 1)))} title="前の月">
                <ChevronLeft size={18} />
              </Button>
              <h1 className="text-base font-bold px-2 min-w-[120px] text-center">
                {format(selectedDate, "yyyy年M月", { locale: ja })}
              </h1>
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(startOfMonth(addMonths(selectedDate, 1)))} title="次の月">
                <ChevronRight size={18} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>今日</Button>
            </div>
            {/* Row 2: view toggle + add */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Button size="sm" variant={selectedView === "cast" ? "default" : "outline"} onClick={() => setSelectedView("cast")}>キャスト別</Button>
                <Button size="sm" variant={selectedView === "room" ? "default" : "outline"} onClick={() => setSelectedView("room")}>ルーム別</Button>
              </div>
              <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" className="bg-[#c49480] hover:bg-[#a87b65]">
                    <Plus size={16} className="mr-1" />新規予約
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                  <SheetHeader><SheetTitle>新しい予約を追加</SheetTitle></SheetHeader>
                  <div className="mt-6">
                    <ReservationForm
                      formData={formData}
                      setFormData={setFormData}
                      casts={casts}
                      rooms={rooms}
                      backRates={backRates}
                      optionRates={optionRates}
                      nominationRates={nominationRates}
                      discounts={discounts}
                      onSubmit={handleAddReservation}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Month tabs - 選択中の月の全日を横スクロールで表示 */}
          <TabMenu
            activeDate={format(selectedDate, "yyyy-MM-dd")}
            dates={eachDayOfInterval({
              start: startOfMonth(selectedDate),
              end: endOfMonth(selectedDate),
            }).map((d) => ({
              date: format(d, "yyyy-MM-dd"),
              label: format(d, "d(E)", { locale: ja }),
            }))}
            onDateChange={(dateStr) => setSelectedDate(new Date(dateStr))}
          />

          {selectedView === "room" && (
            <div className="mb-4"><DailyReservationTimeline /></div>
          )}

          {selectedView === "cast" && (
            <>
              {/* Sales summary */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Card className="p-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground">本日の売上</div>
                    <div className="text-base font-bold truncate">¥{dailyTotal.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">{reservations.length}件の予約</div>
                  </div>
                </Card>
                <Card className="p-3 flex items-center gap-2">
                  <CalendarIcon size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground">{format(selectedDate, "M月", { locale: ja })}の売上合計</div>
                    <div className="text-base font-bold truncate">¥{monthlyTotal.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">月次累計（精算ベース・未精算日は完了予約で補完）</div>
                  </div>
                </Card>
              </div>

              {/* セラピストへの受付終了連絡 */}
              {isAdmin && (
                <Card className="p-3 mb-3">
                  <div className="flex items-start gap-2 mb-3">
                    <Share2 size={16} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <h2 className="text-sm font-bold">受付終了連絡</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        iPhoneの共有画面から送信先を選び、ポータルURLと画像マニュアルを共有します。
                      </p>
                      {receptionEndGuideError && (
                        <p className="text-[11px] text-rose-700 mt-1">
                          画像マニュアルを読み込めませんでした。画面を再読み込みしてください。
                        </p>
                      )}
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />読み込み中...
                    </div>
                  ) : castRows.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">この日の出勤セラピストはいません</p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {castRows.map(({ cast, shift }) => {
                        const hasPortal = !!castAccessTokens[cast.id];
                        const isSharing = sharingReceptionEndCastId === cast.id;
                        const isGuidePreparing = !receptionEndGuideFile && !receptionEndGuideError;
                        return (
                          <div key={cast.id} className="p-2.5 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                            {cast.photo ? (
                              <img src={cast.photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                {cast.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{cast.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {shift
                                  ? `${toExtTime(shift.start_time)}〜${toExtTime(shift.end_time)}`
                                  : "シフト未登録（予約あり）"}
                              </p>
                              {!hasPortal && (
                                <p className="text-[11px] text-amber-700 mt-0.5">
                                  マイページ未発行
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-xs shrink-0"
                              disabled={
                                !hasPortal
                                || !receptionEndGuideFile
                                || !!sharingReceptionEndCastId
                              }
                              onClick={() => shareReceptionEnd(cast.id)}
                            >
                              {isSharing ? (
                                <><Loader2 size={13} className="mr-1.5 animate-spin" />共有中...</>
                              ) : isGuidePreparing ? (
                                <><Loader2 size={13} className="mr-1.5 animate-spin" />準備中...</>
                              ) : (
                                <><Share2 size={13} className="mr-1.5" />受付終了連絡</>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              )}

              {/* 最短ご案内時間 */}
              {earliestSlots.length > 0 && (
                <Card className="p-3 mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap size={14} className="text-amber-500" />
                    <span className="text-[11px] font-semibold text-muted-foreground">最短ご案内時間</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {earliestSlots.map((sl) => (
                      <span
                        key={sl.castId}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border",
                          sl.now
                            ? "bg-green-50 border-green-300 text-green-700 font-bold"
                            : sl.label === "受付終了"
                              ? "bg-muted border-border text-muted-foreground"
                              : "bg-blue-50 border-blue-200 text-blue-800"
                        )}
                      >
                        <span className="font-medium">{sl.name}</span>
                        <span className={sl.now ? "" : "font-bold"}>{sl.label}</span>
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {/* 当日ステータス */}
              <div className="mb-3">
                <h2 className="font-semibold text-xs text-muted-foreground mb-2">当日ステータス</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {BOARD_STATUSES.map((s) => (
                    <StatusBox
                      key={s}
                      status={s}
                      reservations={reservations.filter((r) => r.status === s)}
                      castNameMap={castNameMap}
                      onStatusChange={handleQuickStatusChange}
                      onEdit={(res) => startEdit(res)}
                      onSms={openReservationSms}
                      onThanksSms={openThanksSms}
                      onCouponSms={openCouponSms}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </div>

              {/* Vertical timeline */}
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">読み込み中...</div>
              ) : castRows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">この日の出勤データがありません</div>
              ) : (
                <Card className="overflow-hidden">
                  <div className="w-full">
                    <div className="w-full">
                      {/* Cast header row */}
                      <div className="flex border-b bg-muted/30 sticky top-0 z-20">
                        <div style={{ width: TIME_LABEL_W }} className="flex-shrink-0 border-r bg-muted/50" />
                        {castRows.map(({ cast, shift }) => (
                          <div
                            key={cast.id}
                            className="flex-1 border-r last:border-r-0 p-1 text-center min-w-0"
                          >
                            {cast.photo ? (
                              <img src={cast.photo} alt={cast.name} className="w-6 h-6 rounded-full object-cover mx-auto mb-0.5" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mx-auto mb-0.5">
                                {cast.name.charAt(0)}
                              </div>
                            )}
                            <div className="text-[10px] font-semibold truncate leading-tight">{cast.name}</div>
                            <div className="text-[9px] text-muted-foreground leading-tight">
                              {shift
                                ? `${shift.start_time.slice(0, 5)}~${shift.end_time.slice(0, 5)}`
                                : "予約のみ"}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Timeline body */}
                      <div className="flex relative" style={{ height: TOTAL_HEIGHT }}>
                        {/* Time labels */}
                        <div style={{ width: TIME_LABEL_W }} className="flex-shrink-0 border-r relative">
                          {hours.map((h) => (
                            <div
                              key={h}
                              className="absolute text-[10px] text-muted-foreground text-right pr-2 leading-none"
                              style={{ top: (h - TIME_START) * HOUR_HEIGHT - 6, right: 0, width: TIME_LABEL_W }}
                            >
                              {h >= 24 ? h - 24 : h}:00
                            </div>
                          ))}
                        </div>

                        {/* Cast columns */}
                        {castRows.map(({ cast, shift, reservations: castRes }) => {
                          const shiftStartMin = shift ? timeToMinutes(shift.start_time) : 0;
                          const shiftEndMin = shift ? timeToMinutes(shift.end_time) : 0;
                          const shiftTop = shift ? minutesToPx(shiftStartMin) : 0;
                          const shiftH = shift ? ((shiftEndMin - shiftStartMin) / 60) * HOUR_HEIGHT : 0;

                          return (
                            <div
                              key={cast.id}
                              className="flex-1 min-w-0 border-r last:border-r-0 relative cursor-crosshair"
                              onClick={(e) => {
                                if (!isAdmin) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const y = e.clientY - rect.top;
                                handleTimelineClick(cast.id, y);
                              }}
                            >
                              {/* Hour grid lines */}
                              {hours.map((h) => (
                                <div
                                  key={h}
                                  className="absolute left-0 right-0 border-t border-border/30"
                                  style={{ top: (h - TIME_START) * HOUR_HEIGHT }}
                                />
                              ))}
                              {/* Half-hour lines */}
                              {hours.map((h) => (
                                <div
                                  key={`${h}h`}
                                  className="absolute left-0 right-0 border-t border-border/15"
                                  style={{ top: (h - TIME_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                                />
                              ))}

                              {/* Shift background */}
                              {shift && (
                                <div
                                  className="absolute left-1 right-1 bg-primary/5 border border-primary/20 rounded"
                                  style={{ top: shiftTop, height: shiftH }}
                                />
                              )}

                              {/* Reservation blocks */}
                              {castRes.map((res) => {
                                const resStartMin = timeToMinutes(res.start_time);
                                const resTop = minutesToPx(resStartMin);
                                // 延長オプション込みの実施術時間
                                const extMin = getExtMinutes(res.options, optionRates);
                                const effDuration = res.duration + extMin;
                                const resH = Math.max((effDuration / 60) * HOUR_HEIGHT, 28);
                                const statusClass = STATUS_COLORS[res.status] || STATUS_COLORS.confirmed;
                                const endTime = format(
                                  addMinutes(parse(res.start_time.slice(0, 5), "HH:mm", new Date()), effDuration),
                                  "HH:mm"
                                );
                                // 延長系オプションと通常オプションを分離
                                const extNames = new Set(optionRates.filter((o) => (o.extension_minutes ?? 0) > 0).map((o) => o.option_name));
                                const otherOpts = (res.options ?? []).filter((n) => !extNames.has(n));
                                const durLabel = extMin > 0 ? `${res.duration}分＋延長${extMin}分` : `${res.duration}分`;
                                return (
                                  <div
                                    key={res.id}
                                    className={cn(
                                      "absolute left-1 right-1 rounded border-t-4 px-1.5 py-0.5 overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] z-10",
                                      statusClass
                                    )}
                                    style={{ top: resTop + 2, height: resH - 4 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetail(res);
                                    }}
                                  >
                                    <div className="text-[10px] font-bold leading-tight pr-9">
                                      {toExtTime(res.start_time)}~{endTime}
                                    </div>
                                    <div className="text-xs font-semibold truncate leading-tight pr-9">
                                      {res.customer_name}
                                      {res.nomination_type && res.nomination_type !== "none" && (
                                        <span className="ml-1 text-[9px] font-normal opacity-70">{res.nomination_type}</span>
                                      )}
                                    </div>
                                    {resH > 40 && (
                                      <div className="text-[10px] leading-snug mt-0.5">
                                        <div className="truncate">{res.course_type} {durLabel}</div>
                                        {resH > 62 && otherOpts.length > 0 && (
                                          <div className="truncate opacity-80">＋{otherOpts.join("、")}</div>
                                        )}
                                        <div className="font-semibold">¥{res.price.toLocaleString()}</div>
                                      </div>
                                    )}
                                    {/* 完了へ移行ボタン */}
                                    {res.status !== "completed" && res.status !== "cancelled" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleQuickStatusChange(res.id, "completed");
                                        }}
                                        className="absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
                                        title="完了にする"
                                      >
                                        完了
                                      </button>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Current time line */}
                              {isToday && nowMinutes >= TIME_START * 60 && nowMinutes <= TIME_END * 60 && (
                                <div
                                  className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                                  style={{ top: nowPx }}
                                >
                                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Legend */}
              <div className="flex gap-3 mt-2 flex-wrap text-xs">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1">
                    <div className={cn("w-3 h-3 rounded border-t-2", STATUS_COLORS[key])} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <footer className="py-4 px-4">
          <p className="text-xs text-muted-foreground text-center">© 2025 caskan.jp All rights reserved</p>
        </footer>
      </main>

      {/* Reservation detail sheet */}
      <Sheet open={!!detailRes} onOpenChange={(open) => { if (!open) setDetailRes(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>{editMode ? "予約を編集" : "予約詳細"}</SheetTitle>
              {isAdmin && !editMode && (
                <Button size="sm" variant="outline" onClick={() => startEdit()}>
                  <Pencil size={14} className="mr-1" />編集
                </Button>
              )}
            </div>
          </SheetHeader>

          {detailRes && (
            <div className="mt-4 space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label>ステータス</Label>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {Object.entries(STATUS_LABELS).map(([k, v]) => {
                        const on = editStatus === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setEditStatus(k)}
                            className={cn(
                              "px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors",
                              on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
                            )}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <ReservationForm
                    formData={editFormData}
                    setFormData={setEditFormData}
                    casts={casts}
                    rooms={rooms}
                    backRates={backRates}
                    optionRates={optionRates}
                    nominationRates={nominationRates}
                    discounts={discounts}
                    onSubmit={handleSaveEdit}
                    submitLabel="変更を保存"
                  />
                  <Button variant="outline" className="w-full" onClick={() => setEditMode(false)}>編集をやめる</Button>
                </>
              ) : (
                <>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-2 py-1 rounded", STATUS_COLORS[detailRes.status])}>
                        {STATUS_LABELS[detailRes.status] ?? detailRes.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-muted-foreground">日時</span>
                      <span className="font-medium">
                        {(() => { const e = extBusinessDateTime(detailRes.reservation_date, detailRes.start_time); return `${e.dateStr} ${e.timeStr}`; })()} ({detailRes.duration}分)
                      </span>
                      <span className="text-muted-foreground">顧客名</span>
                      <span className="font-medium">{detailRes.customer_name}</span>
                      <span className="text-muted-foreground">電話番号</span>
                      <span className="font-medium">{detailRes.customer_phone}</span>
                      <span className="text-muted-foreground">コース</span>
                      <span className="font-medium">{detailRes.course_name}</span>
                      {(detailRes.options ?? []).length > 0 && (
                        <>
                          <span className="text-muted-foreground">オプション</span>
                          <span className="font-medium">{(detailRes.options ?? []).join("、")}</span>
                        </>
                      )}
                      {(detailRes.discount ?? 0) > 0 && (
                        <>
                          <span className="text-muted-foreground">割引</span>
                          <span className="font-medium text-rose-600">-¥{(detailRes.discount ?? 0).toLocaleString()}</span>
                        </>
                      )}
                      <span className="text-muted-foreground">料金</span>
                      <span className="font-medium">¥{detailRes.price.toLocaleString()}</span>
                      {(detailRes.payment_fee ?? 0) > 0 && (
                        <>
                          <span className="text-muted-foreground">決済手数料</span>
                          <span className="font-medium">+¥{(detailRes.payment_fee ?? 0).toLocaleString()}</span>
                          <span className="text-muted-foreground">総額</span>
                          <span className="font-semibold text-primary">¥{(detailRes.price + (detailRes.payment_fee ?? 0)).toLocaleString()}</span>
                        </>
                      )}
                      {detailRes.payment_method && (
                        <>
                          <span className="text-muted-foreground">支払方法</span>
                          <span className="font-medium">{detailRes.payment_method}</span>
                        </>
                      )}
                      {detailRes.nomination_type && (
                        <>
                          <span className="text-muted-foreground">指名</span>
                          <span className="font-medium">{detailRes.nomination_type}</span>
                        </>
                      )}
                      {detailRes.room && (
                        <>
                          <span className="text-muted-foreground">ルーム</span>
                          <span className="font-medium">{detailRes.room}</span>
                        </>
                      )}
                      {detailRes.notes && (
                        <>
                          <span className="text-muted-foreground">備考</span>
                          <span className="font-medium">{detailRes.notes}</span>
                        </>
                      )}
                    </div>
                    {detailRes.payment_method === "PayPay" && (
                      <a href={paypayGuideUrl} target="_blank" rel="noopener noreferrer" className="block mt-3">
                        <img
                          src={paypayGuideUrl}
                          alt="PayPay決済のご案内"
                          className="w-full rounded-lg border border-[#e0e0e0] shadow-sm hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
                  </div>
                  <div className="pt-2 border-t space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openReservationSms(detailRes)}
                    >
                      <MessageSquare size={14} className="mr-1" />予約確認SMS
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-pink-600 border-pink-200 hover:bg-pink-50"
                      onClick={() => openThanksSms(detailRes)}
                    >
                      <Heart size={14} className="mr-1" />サンクスSMS
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 w-full"
                        onClick={handleCancelReservation}
                      >
                        <X size={14} className="mr-1" />キャンセルにする
                      </Button>
                    )}
                  </div>
                </>
              )}
              {isAdmin && (
                <div className="pt-3 border-t border-rose-100">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 size={14} className="mr-1" />予約データを削除
                  </Button>
                  <p className="mt-1.5 text-center text-xs text-muted-foreground">
                    キャンセル扱いではなく、予約そのものを完全に削除します。
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予約データを完全に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {detailRes && (
                <>
                  {detailRes.customer_name} 様／
                  {(() => {
                    const value = extBusinessDateTime(detailRes.reservation_date, detailRes.start_time);
                    return `${value.dateStr} ${value.timeStr}`;
                  })()}
                  <br />
                </>
              )}
              この操作は取り消せません。予約一覧と当日表からも表示されなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handlePermanentlyDeleteReservation}
            >
              完全に削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
