import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { addDays, format } from "date-fns";
import { ja } from "date-fns/locale";
import { User, Copy, Check, Zap, Users, LayoutGrid } from "lucide-react";
import { driveImgUrl } from "@/lib/drive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calcPaymentFee, findPaymentSetting, PaymentSetting } from "@/lib/paymentFee";
import { z } from "zod";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { useStore } from "@/hooks/useStore";
import { useStoreContact } from "@/hooks/useStoreContact";

interface Cast {
  id: string;
  name: string;
  type: string;
  photo: string | null;
  status: string;
  profile: string | null;
  age: number | null;
  height: number | null;
  cup_size: string | null;
  room: string | null;
}

interface Shift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  status: string;
}

interface Reservation {
  id: string;
  cast_id: string;
  reservation_date: string;
  start_time: string;
  duration: number;
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

interface PublicCoupon {
  badge_text: string | null;
  code: string | null;
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  display_order: number;
  eligible_course_type: string | null;
  eligible_duration: number | null;
  min_advance_days: number;
  terms: string[];
}

const tokyoToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const isEarlyMorningTime = (time: string) => Number(time.split(":")[0]) < 6;

// 営業日は14:00〜翌朝として扱い、DBには実際の暦日を保存する。
const reservationDateKey = (businessDate: Date, time: string) =>
  format(isEarlyMorningTime(time) ? addDays(businessDate, 1) : businessDate, "yyyy-MM-dd");

const businessMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return (hour < 6 ? hour + 24 : hour) * 60 + minute;
};

const businessTimeLabel = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour < 6 ? hour + 24 : hour}:${minute.toString().padStart(2, "0")}`;
};

const reservationSchema = z.object({
  customer_name: z.string().trim().min(1, "お名前を入力してください").max(100, "お名前は100文字以内で入力してください").regex(/^[\p{L}\p{N}\s\-\.]+$/u, "お名前に使用できない文字が含まれています"),
  customer_furigana: z.string().trim().min(1, "フリガナを入力してください").max(100, "フリガナは100文字以内で入力してください").regex(/^[\p{L}\p{N}\s\-\.]+$/u, "フリガナに使用できない文字が含まれています"),
  customer_phone: z.string().trim().min(10, "電話番号を入力してください").max(20, "電話番号は20文字以内で入力してください").regex(/^[0-9\-\(\)\+\s]+$/, "電話番号の形式が正しくありません"),
  customer_email: z.string().trim().email("有効なメールアドレスを入力してください").max(255, "メールアドレスは255文字以内で入力してください"),
  notes: z.string().max(1000, "備考は1000文字以内で入力してください").refine(val => !val || !/<[^>]*>/g.test(val), "HTMLタグは使用できません").optional(),
});

interface Banner {
  id: string;
  image_url: string;
  link_url: string | null;
}

type BottomTab = "now" | "select" | "menu";

const BookingReservation = () => {
  const { phone: shopPhone } = useStoreContact();
  const [bottomTab, setBottomTab] = useState<BottomTab>("select");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [publicCoupons, setPublicCoupons] = useState<PublicCoupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<string>("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [completedBookingText, setCompletedBookingText] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  const [searchParams] = useSearchParams();
  // Schedule などから渡される ?date=YYYY-MM-DD を初期日付に反映（無ければ今日）
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = searchParams.get("date");
    if (d) {
      const parsed = new Date(`${d}T00:00:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  // ?castId / ?time はキャスト一覧の取得完了後に適用する（日付変更でリセットされるため）
  const pendingParams = useRef<{ castId: string | null; time: string | null }>({
    castId: searchParams.get("castId"),
    time: searchParams.get("time"),
  });
  const [selectedCastId, setSelectedCastId] = useState<string>("");
  const [courseType, setCourseType] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(80);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [selectedDROption, setSelectedDROption] = useState<string>("none");
  const [nominationType, setNominationType] = useState<string>("none");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerFurigana, setCustomerFurigana] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [referralSource, setReferralSource] = useState<string>("");
  const [referralOther, setReferralOther] = useState<string>("");
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [intervalMinutes, setIntervalMinutes] = useState(30);

  useEffect(() => {
    document.title = "艶華 - WEB予約";
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { storeId } = useStore();

  useEffect(() => {
    fetchBanners();
    supabase.rpc("get_reservation_interval" as any).then(({ data }) => {
      if (typeof data === "number") setIntervalMinutes(data);
    });
  }, []);

  // 料金・オプションは店舗が確定してから取得（店舗混在を防ぐ）
  useEffect(() => {
    fetchRates();
  }, [storeId]);

  const fetchBanners = async () => {
    const { data } = await supabase
      .from("banners")
      .select("id, image_url, link_url")
      .eq("is_active", true)
      .eq("store_id", storeId)
      .order("display_order", { ascending: true });
    setBanners((data || []) as Banner[]);
  };

  // 今すぐ案内できるセラピスト：現在時刻がシフト時間内のキャストを自動検出
  const nowCasts = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return casts.filter(cast =>
      allShifts.some(shift => {
        if (shift.cast_id !== cast.id) return false;
        const [sh, sm] = shift.start_time.split(':').map(Number);
        const [eh, em] = shift.end_time.split(':').map(Number);
        const shiftStart = sh * 60 + sm;
        let shiftEnd = eh * 60 + em;
        if (shiftEnd <= shiftStart) shiftEnd += 24 * 60; // 深夜またぎ
        const adjusted = currentMinutes < shiftStart ? currentMinutes + 24 * 60 : currentMinutes;
        return adjusted >= shiftStart && adjusted <= shiftEnd;
      })
    );
  }, [casts, allShifts]);

  const goBookCast = (castId: string) => {
    setSelectedCastId(castId);
    setBottomTab("select");
    setCurrentStep(2);
  };

  const switchTab = (tab: BottomTab) => {
    if (tab === "now") {
      // 「今すぐ」は本日を対象にする
      const today = new Date();
      setSelectedDate(today);
    }
    setBottomTab(tab);
  };

  // Fetch available casts when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableCasts();
      setSelectedCastId(""); // 日付変更時にセラピスト選択をリセット
    }
  }, [selectedDate, storeId]);

  // URL の castId / time を、その日のキャスト一覧が揃ったタイミングで一度だけ適用
  useEffect(() => {
    const { castId, time } = pendingParams.current;
    if (castId && casts.some((c) => c.id === castId)) {
      setSelectedCastId(castId);
      if (time) setStartTime(time);
      setCurrentStep(2);
      pendingParams.current = { castId: null, time: null };
    }
  }, [casts]);

  // Fetch shifts and reservations when date or cast changes
  useEffect(() => {
    if (selectedDate && selectedCastId) {
      fetchShiftsAndReservations();
    } else {
      setAvailableTimeSlots([]);
    }
  }, [selectedDate, selectedCastId]);

  // Calculate available time slots when shifts, reservations, or duration changes
  useEffect(() => {
    if (selectedDate && selectedCastId && shifts.length > 0) {
      calculateAvailableTimeSlots();
    }
  }, [shifts, reservations, duration, selectedDate, selectedCastId]);

  // 指名タイプごとの料金を算出（指名なし=none / ネット指名 / 本指名）
  const computePrice = (nomType: string) => {
    let price = 0;

    // Base course price
    const matchingRate = backRates.find(
      rate => rate.course_type === courseType && rate.duration === duration
    );
    if (matchingRate) {
      price += matchingRate.customer_price;
    }

    // Add options
    selectedOptions.forEach(optionName => {
      const matchingOption = optionRates.find(opt => opt.option_name === optionName);
      if (matchingOption) {
        price += matchingOption.customer_price;
      }
    });

    // Add nomination fee
    if (nomType && nomType !== 'none') {
      const matchingNomination = nominationRates.find(
        nom => nom.nomination_type === nomType
      );
      if (matchingNomination) {
        price += matchingNomination.customer_price;
      }
    }

    return price;
  };

  // セラピストを選んだら指名扱い（デフォルトはネット指名、電話番号入力後に本指名へ昇格）
  useEffect(() => {
    if (selectedCastId === "none" || selectedCastId === "") {
      setNominationType("none");
    } else {
      setNominationType((prev) => (prev === "none" ? "ネット指名" : prev));
    }
  }, [selectedCastId]);

  const selectedCoupon = publicCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null;

  const isAdvanceCouponEligible = (coupon: PublicCoupon | null = selectedCoupon) => {
    if (!coupon) return false;
    const today = Date.parse(`${tokyoToday()}T00:00:00Z`);
    const reservationDay = Date.parse(`${format(selectedDate, "yyyy-MM-dd")}T00:00:00Z`);
    const advanceDays = Math.floor((reservationDay - today) / 86_400_000);
    return (
      (!coupon.eligible_course_type || coupon.eligible_course_type === courseType) &&
      (!coupon.eligible_duration || coupon.eligible_duration === duration) &&
      advanceDays >= coupon.min_advance_days
    );
  };

  const calculatePricing = (
    nomType: string,
    coupon: PublicCoupon | null = selectedCoupon,
    couponEligible = isAdvanceCouponEligible(),
  ) => {
    const subtotal = computePrice(nomType);
    const discountAmount = coupon && couponEligible
      ? Math.min(Math.max(0, Number(coupon.discount_value) || 0), subtotal)
      : 0;
    return {
      subtotal,
      discountAmount,
      price: Math.max(0, subtotal - discountAmount),
    };
  };

  const couponEligible = isAdvanceCouponEligible(selectedCoupon);
  const currentPricing = calculatePricing(nominationType);

  // 日付・コース変更で条件を外れたクーポンを残さない
  useEffect(() => {
    if (selectedCouponId && !couponEligible) {
      setSelectedCouponId("");
    }
  }, [selectedCouponId, couponEligible]);

  // 顧客DBを参照して本指名/ネット指名を判定（電話番号＋セラピストで過去予約があれば本指名）
  const resolveNominationType = async (phone: string): Promise<string> => {
    if (selectedCastId === "none" || selectedCastId === "") return "none";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return "ネット指名";
    try {
      const { data: isRepeat } = await supabase.rpc("check_repeat_nomination" as any, {
        p_phone: phone,
        p_cast_id: selectedCastId,
      });
      return isRepeat ? "本指名" : "ネット指名";
    } catch (e) {
      console.error("nomination check failed:", e);
      return "ネット指名";
    }
  };

  // 電話番号が確定したら指名種別を更新（表示価格に反映）
  const handlePhoneBlur = async () => {
    const nom = await resolveNominationType(customerPhone);
    setNominationType(nom);
  };

  const totalPrice = currentPricing.price;
  const paymentFee = calcPaymentFee(totalPrice, paymentSettings, paymentMethod);
  const grandTotal = totalPrice + paymentFee;

  const fetchAvailableCasts = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const nextDateStr = format(addDays(selectedDate, 1), "yyyy-MM-dd");
      
      // Get all shifts for the selected date (full data)
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shifts")
        .select("*")
        .eq("shift_date", dateStr)
        .eq("store_id", storeId);

      if (shiftsError) throw shiftsError;

      // 深夜枠は翌暦日で保存されるため、営業日当日と翌日の空き枠を合わせる。
      const [currentReservations, nextReservations] = await Promise.all([
        supabase.rpc("get_reservation_slots", { p_date: dateStr, p_cast_id: null }),
        supabase.rpc("get_reservation_slots", { p_date: nextDateStr, p_cast_id: null }),
      ]);

      if (currentReservations.error) throw currentReservations.error;
      if (nextReservations.error) throw nextReservations.error;

      const reservationsData = [
        ...((currentReservations.data || []) as Reservation[]).filter(
          (reservation) => !isEarlyMorningTime(reservation.start_time),
        ),
        ...((nextReservations.data || []) as Reservation[]).filter(
          (reservation) => isEarlyMorningTime(reservation.start_time),
        ),
      ];

      setAllShifts(shiftsData || []);
      setAllReservations(reservationsData);

      // Get unique cast IDs from shifts
      const castIds = [...new Set(shiftsData?.map(s => s.cast_id) || [])];

      if (castIds.length === 0) {
        setCasts([]);
        setLoading(false);
        return;
      }

      // Fetch cast details for those IDs
      const { data: castsData, error: castsError } = await supabase
        .from("casts")
        .select("id, name, type, photo, status, profile, age, height, cup_size, room")
        .in("id", castIds)
        .eq("is_active", true)
        .order("name");

      if (castsError) throw castsError;
      setCasts(castsData || []);
    } catch (error) {
      console.error("Error fetching available casts:", error);
      toast({
        title: "エラー",
        description: "セラピスト情報の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get availability slots for a specific cast (for the card display)
  const getCastTimeSlots = (castId: string) => {
    const castShifts = allShifts.filter(s => s.cast_id === castId);
    const castReservations = allReservations.filter(r => r.cast_id === castId);
    if (castShifts.length === 0) return [];

    const shift = castShifts[0];
    const [shiftStartHour, shiftStartMinute] = shift.start_time.split(':').map(Number);
    const [shiftEndHour, shiftEndMinute] = shift.end_time.split(':').map(Number);
    const shiftStart = shiftStartHour * 60 + shiftStartMinute;
    let shiftEnd = shiftEndHour * 60 + shiftEndMinute;
    // 深夜またぎ（終了時刻が開始より前 = 翌日）
    if (shiftEnd <= shiftStart) shiftEnd += 24 * 60;
    // intervalMinutes は店舗設定から取得済み
    const checkDuration = 60; // Use 60min as default check duration for overview

    const slots: { time: string; available: boolean }[] = [];
    for (let time = shiftStart; time + checkDuration <= shiftEnd; time += 10) {
      const hour = Math.floor(time / 60) % 24;
      const minute = time % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      const isBooked = castReservations.some(reservation => {
        const resStart = businessMinutes(reservation.start_time);
        const resEnd = resStart + reservation.duration + intervalMinutes;
        const newEnd = time + checkDuration;
        return (time < resEnd && newEnd > resStart);
      });

      slots.push({ time: timeStr, available: !isBooked });
    }
    return slots;
  };

  const fetchRates = async () => {
    try {
      const { data: backData } = await supabase.rpc('get_public_back_rates', { p_store_id: storeId } as any);

      const { data: optionData } = await supabase
        .from('option_rates')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true });

      const { data: nominationData } = await supabase
        .from('nomination_rates')
        .select('*')
        .eq('store_id', storeId);

      const { data: paymentData } = await supabase
        .from('payment_settings')
        .select('id, payment_method, payment_link, fee_percentage')
        .eq('store_id', storeId);

      const { data: discountData } = await supabase
        .from('discounts')
        .select('id, name, code, discount_type, discount_value, display_order, badge_text, terms, eligible_course_type, eligible_duration, min_advance_days')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .eq('public_booking_enabled', true)
        .order('display_order', { ascending: true });

      // Wセラピスト専用コース・オプションは専用フォーム（/book/ペアキャスト）のみで販売
      if (backData) {
        const publicRates = (backData as BackRate[]).filter((rate) => rate.course_type !== "全力W");
        setBackRates(publicRates);
        const preferredRate = publicRates.find((rate) => rate.course_type === "艶華" && rate.duration === 80)
          || publicRates.find((rate) => rate.course_type === "全力" && rate.duration === 80)
          || publicRates[0];
        if (preferredRate && !publicRates.some((rate) => rate.course_type === courseType && rate.duration === duration)) {
          setCourseType(preferredRate.course_type);
          setDuration(preferredRate.duration);
        }
      }
      if (optionData) setOptionRates(optionData.filter((o: any) => !["全力PKG1W", "全力PKG2W"].includes(o.option_name)));
      if (nominationData) setNominationRates(nominationData);
      if (paymentData) setPaymentSettings(paymentData as PaymentSetting[]);
      if (discountData) setPublicCoupons(discountData as PublicCoupon[]);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const fetchShiftsAndReservations = async () => {
    if (!selectedDate || !selectedCastId) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const nextDateStr = format(addDays(selectedDate, 1), "yyyy-MM-dd");

    try {
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shifts")
        .select("*")
        .eq("cast_id", selectedCastId)
        .eq("shift_date", dateStr);

      const [currentReservations, nextReservations] = await Promise.all([
        supabase.rpc("get_reservation_slots", { p_date: dateStr, p_cast_id: selectedCastId }),
        supabase.rpc("get_reservation_slots", { p_date: nextDateStr, p_cast_id: selectedCastId }),
      ]);

      if (shiftsError) throw shiftsError;
      if (currentReservations.error) throw currentReservations.error;
      if (nextReservations.error) throw nextReservations.error;

      const reservationsData = [
        ...((currentReservations.data || []) as Reservation[]).filter(
          (reservation) => !isEarlyMorningTime(reservation.start_time),
        ),
        ...((nextReservations.data || []) as Reservation[]).filter(
          (reservation) => isEarlyMorningTime(reservation.start_time),
        ),
      ];

      setShifts(shiftsData || []);
      setReservations(reservationsData);
    } catch (error) {
      console.error("Error fetching shifts and reservations:", error);
      toast({
        title: "エラー",
        description: "スケジュール情報の取得に失敗しました",
        variant: "destructive",
      });
    }
  };

  const calculateAvailableTimeSlots = () => {
    if (!selectedDate || !selectedCastId || shifts.length === 0) {
      setAvailableTimeSlots([]);
      return;
    }

    const shift = shifts[0];
    if (!shift) {
      setAvailableTimeSlots([]);
      return;
    }

    const [shiftStartHour, shiftStartMinute] = shift.start_time.split(':').map(Number);
    const [shiftEndHour, shiftEndMinute] = shift.end_time.split(':').map(Number);

    const shiftStart = shiftStartHour * 60 + shiftStartMinute;
    let shiftEnd = shiftEndHour * 60 + shiftEndMinute;
    // 深夜またぎ（終了時刻が開始より前 = 翌日）
    if (shiftEnd <= shiftStart) shiftEnd += 24 * 60;

    // インターバル時間（分）- 予約と予約の間に必要な準備時間
    // intervalMinutes は店舗設定から取得済み

    // 10分刻みで可能な時間を生成
    const slots: string[] = [];
    for (let time = shiftStart; time + duration <= shiftEnd; time += 10) {
      const hour = Math.floor(time / 60) % 24;
      const minute = time % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // この時間帯が予約可能かチェック（インターバルを考慮）
      const isBooked = reservations.some(reservation => {
        const resStart = businessMinutes(reservation.start_time);
        const resEnd = resStart + reservation.duration + intervalMinutes; // 予約終了後にインターバルを追加
        
        // 新しい予約の終了時刻
        const newEnd = time + duration;
        
        // 重複チェック（インターバルを含む）
        return (time < resEnd && newEnd > resStart);
      });

      if (!isBooked) {
        slots.push(timeStr);
      }
    }

    setAvailableTimeSlots(slots);
    
    if (slots.length > 0 && !slots.includes(startTime)) {
      setStartTime(slots[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      reservationSchema.parse({
        customer_name: customerName,
        customer_furigana: customerFurigana,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        notes: notes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "入力エラー",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    if (!selectedDate || !selectedCastId || !courseType || !startTime) {
      toast({
        title: "入力エラー",
        description: "必須項目をすべて入力してください",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const courseName = `${courseType} ${duration}分`;
      
      // 指名なしの場合、最初の出勤キャストを割り当て
      const actualCastId = selectedCastId === "none" ? (casts[0]?.id || "") : selectedCastId;
      if (!actualCastId) {
        toast({ title: "エラー", description: "割り当て可能なセラピストがいません", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { data: activeCast, error: activeCastError } = await supabase
        .from("casts")
        .select("id")
        .eq("id", actualCastId)
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      if (activeCastError || !activeCast) {
        toast({ title: "受付できません", description: "選択したセラピストは現在予約を受け付けていません。選び直してください。", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      // 顧客DBを参照して指名種別を確定（本指名 or ネット指名 or 指名なし）
      const finalNominationType = await resolveNominationType(customerPhone);
      const couponEligibleAtSubmit = isAdvanceCouponEligible();
      if (selectedCoupon && !couponEligibleAtSubmit) {
        setSelectedCouponId("");
        toast({
          title: "クーポンを適用できません",
          description: "事前予約クーポンは、前日までに予約する艶華コース80分でのみ利用できます。",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      const appliedCoupon = couponEligibleAtSubmit ? selectedCoupon : null;
      const finalPricing = calculatePricing(finalNominationType, appliedCoupon, couponEligibleAtSubmit);
      const finalPrice = finalPricing.price;
      const finalPaymentFee = calcPaymentFee(finalPrice, paymentSettings, paymentMethod);
      const finalGrandTotal = finalPrice + finalPaymentFee;
      // 表示にも反映
      setNominationType(finalNominationType);

      const reservationId = crypto.randomUUID();
      const { error } = await supabase
        .from("reservations")
        .insert([{
          id: reservationId,
          cast_id: actualCastId,
          customer_name: customerName.trim(),
          customer_furigana: customerFurigana.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim(),
          reservation_date: reservationDateKey(selectedDate, startTime),
          start_time: startTime,
          duration: duration,
          course_type: courseType,
          course_name: courseName,
          options: selectedOptions.length > 0 ? selectedOptions : null,
          nomination_type: finalNominationType !== 'none' ? finalNominationType : null,
          price: finalPrice,
          discount: finalPricing.discountAmount,
          discount_ids: appliedCoupon ? [appliedCoupon.id] : [],
          payment_method: paymentMethod || "cash",
          payment_fee: finalPaymentFee || 0,
          notes: notes.trim() || null,
          referral_source: referralOther.trim() || referralSource || null,
          status: "confirmed",
          payment_status: "unpaid",
          booking_origin: "web_form",
          web_booking_status: "unhandled",
          created_by: null,
          store_id: storeId,
        }]);

      if (error) throw error;

      // Build copyable reservation summary
      const castName = selectedCastId === "none" ? "指名なし" : (selectedCast?.name || "");
      const dateStr = format(selectedDate, "yyyy年M月d日(E)", { locale: ja });

      const paymentLink = findPaymentSetting(paymentSettings, paymentMethod)?.payment_link || null;

      // LINE通知（失敗しても予約完了表示は継続）
      try {
        const { error: notifyError } = await supabase.functions.invoke("notify-line-booking", {
          body: { reservation_id: reservationId },
        });
        if (notifyError) console.error("Booking notification failed:", notifyError.message);
      } catch (notifyErr) {
        console.error("Booking notification failed:", notifyErr);
      }
      const summaryLines = [
        `【予約詳細】`,
        `日付: ${dateStr}`,
        `時間: ${businessTimeLabel(startTime)}〜`,
        `コース: ${courseType} ${duration}分`,
        `セラピスト: ${castName}`,
        ...(finalNominationType && finalNominationType !== 'none' ? [`指名: ${finalNominationType}`] : []),
        ...(selectedOptions.length > 0 ? [`オプション: ${selectedOptions.join(', ')}`] : []),
        ...(appliedCoupon ? [
          `クーポン: ${appliedCoupon.name}`,
          `割引: -¥${finalPricing.discountAmount.toLocaleString()}`,
        ] : []),
        `料金: ¥${finalPrice.toLocaleString()}`,
        ...(finalPaymentFee > 0 ? [`決済手数料: ¥${finalPaymentFee.toLocaleString()}`, `総額: ¥${finalGrandTotal.toLocaleString()}`] : []),
        ...(finalPaymentFee > 0 && paymentLink
          ? [``, `▼決済はこちら`, paymentLink]
          : []),
        ``,
        `お名前: ${customerName}`,
        `電話番号: ${customerPhone}`,
        ...(notes ? [`備考: ${notes}`] : []),
      ];
      setCompletedBookingText(summaryLines.join('\n'));
      setBookingComplete(true);

      toast({
        title: "予約完了",
        description: "ご予約を承りました。担当者より確認のご連絡をさせていただきます。",
      });
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast({
        title: "エラー",
        description: "予約の登録に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getProfileText = (profile: string | null): string => {
    if (!profile) return '';
    try {
      const p = JSON.parse(profile);
      return p.self_introduction || p.comment || '';
    } catch {
      return profile;
    }
  };

  const drOptionRates = optionRates
    .filter(r => r.option_name.startsWith("DR"))
    .sort((a, b) => {
      const aMin = parseInt(a.option_name.replace(/\D/g, "")) || 0;
      const bMin = parseInt(b.option_name.replace(/\D/g, "")) || 0;
      return aMin - bMin;
    });

  const regularOptionRates = optionRates.filter(r => !r.option_name.startsWith("DR"));

  const handleDROptionChange = (value: string) => {
    setSelectedDROption(value);
    const withoutDR = selectedOptions.filter(o => !o.startsWith("DR"));
    setSelectedOptions(value === "none" ? withoutDR : [...withoutDR, value]);
  };

  const selectedCast = casts.find(c => c.id === selectedCastId);

  const referralSources = [
    "メンズエステランキング", "エステ魂", "メンズエステマガジン", "週刊エステ",
    "アロマパンダ", "シティヘブン", "駅ちか", "口コミ風俗情報局",
    "X（旧Twitter）", "TikTok", "Instagram", "GoogleMap",
    "店舗HP", "看板", "知人の紹介", "エステクイーン",
    "エステアイ", "エスナビ", "ME（メンエス）", "メンズエステタウン",
    "メンズエステLIFE", "メンズリラク", "メンズエステガイド", "エステラブ",
    "エステナビ", "メンエスじゃぱん", "メンエスイキタイ", "エスラブ",
    "エステ図鑑", "チョイエス", "メンズビズ", "該当なし"
  ];

  const handleCopyBooking = async () => {
    try {
      await navigator.clipboard.writeText(completedBookingText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "コピーしました", description: "予約詳細をクリップボードにコピーしました" });
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = completedBookingText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (bookingComplete) {
    return (
      <div className="min-h-screen pb-20" style={{ backgroundColor: "#f8f6f3" }}>
        <PublicNavigation />
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">ご予約を承りました</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">担当者より確認のご連絡をさせていただきます</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap font-sans leading-relaxed border">
                  {completedBookingText}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={handleCopyBooking}
                >
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? "コピー済" : "コピー"}
                </Button>
              </div>
              <Button className="w-full" onClick={() => navigate("/")}>
                トップページへ戻る
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: "#f8f6f3" }}>
      <PublicNavigation />

      <main className="container py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 
            className="text-4xl font-bold mb-2 text-center"
            style={{ 
              color: "#7a706c",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em"
            }}
          >
            WEB予約
          </h1>
          <p className="text-center mb-8" style={{ color: "#a89586" }}>
            下記のフォームよりご予約ください
          </p>

          {/* 今すぐ案内できるセラピスト */}
          {bottomTab === "now" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "#7a706c" }}>今すぐご案内できるセラピスト</h2>
              {loading ? (
                <div className="text-center p-12 text-muted-foreground">読み込み中...</div>
              ) : nowCasts.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">現在すぐにご案内できるセラピストはいません</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {nowCasts.map((cast) => (
                    <Card key={cast.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => goBookCast(cast.id)}>
                      <CardContent className="p-0">
                        <div className="aspect-[3/4] overflow-hidden rounded-t-md bg-muted">
                          {cast.photo ? (
                            <img src={driveImgUrl(cast.photo)} alt={cast.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground"><User className="h-12 w-12" /></div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                            <h3 className="font-bold" style={{ color: "#7a706c" }}>{cast.name}</h3>
                          </div>
                          <Button className="w-full mt-1" size="sm">このセラピストで予約</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* おすすめメニュー（バナー） */}
          {bottomTab === "menu" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "#7a706c" }}>おすすめメニュー</h2>
              {banners.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground">おすすめメニューはありません</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {banners.map((b) => {
                    const img = <img src={driveImgUrl(b.image_url)} alt="おすすめメニュー" className="w-full rounded-lg shadow" />;
                    return b.link_url ? (
                      <a key={b.id} href={b.link_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">{img}</a>
                    ) : (
                      <div key={b.id}>{img}</div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ステップインジケーター */}
          {bottomTab === "select" && (<>
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                      currentStep === step
                        ? "bg-[#c49480] text-white"
                        : currentStep > step
                        ? "bg-[#d4b5a8] text-white"
                        : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {step}
                  </div>
                  {step < 4 && (
                    <div
                      className={cn(
                        "w-12 h-1 mx-2",
                        currentStep > step ? "bg-[#d4b5a8]" : "bg-gray-200"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              {/* ステップ1: セラピスト選択 */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-4" style={{ color: "#7a706c" }}>
                      1. セラピストを選んでください
                    </h2>
                    
                    {/* 日付選択 */}
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newDate = new Date(selectedDate);
                          newDate.setDate(newDate.getDate() - 1);
                          setSelectedDate(newDate);
                        }}
                      >
                        前の日
                      </Button>
                      <div className="text-lg font-semibold" style={{ color: "#7a706c" }}>
                        {format(selectedDate, "M月d日 (E)", { locale: ja })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newDate = new Date(selectedDate);
                          newDate.setDate(newDate.getDate() + 1);
                          setSelectedDate(newDate);
                        }}
                      >
                        次の日
                      </Button>
                    </div>

                    {/* セラピストカード */}
                    {casts.length === 0 ? (
                      <div className="text-center p-12 text-muted-foreground">
                        <p className="text-lg mb-2">この日は出勤予定のセラピストがいません</p>
                        <p className="text-sm">別の日付をお選びください</p>
                      </div>
                    ) : (
                      <>
                      <p className="text-xs text-muted-foreground mb-2 md:hidden">← 左右にスワイプしてセラピストを見る →</p>
                      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1">
                        {/* 指名なしカード */}
                        <Card
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-lg shrink-0 w-56 snap-start",
                            selectedCastId === "none"
                              ? "ring-2 ring-[#c49480] shadow-lg"
                              : "hover:ring-1 hover:ring-[#d4b5a8]"
                          )}
                          onClick={() => setSelectedCastId("none")}
                        >
                          <CardContent className="p-0">
                            <div className="aspect-[3/4] overflow-hidden rounded-t-md bg-muted flex items-center justify-center">
                              <User className="h-16 w-16 text-muted-foreground" />
                            </div>
                            <div className="p-4">
                              <h3 className="text-xl font-bold mb-1" style={{ color: "#7a706c" }}>
                                指名なし
                              </h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                お店におまかせ
                              </p>
                              <Button
                                className="w-full"
                                variant={selectedCastId === "none" ? "default" : "outline"}
                              >
                                {selectedCastId === "none" ? "選択中" : "予約"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                        {casts.map((cast) => (
                          <Card
                            key={cast.id}
                            className={cn(
                              "cursor-pointer transition-all hover:shadow-lg shrink-0 w-56 snap-start",
                              selectedCastId === cast.id
                                ? "ring-2 ring-[#c49480] shadow-lg"
                                : "hover:ring-1 hover:ring-[#d4b5a8]"
                            )}
                            onClick={() => setSelectedCastId(cast.id)}
                          >
                            <CardContent className="p-0">
                              <div className="aspect-[3/4] overflow-hidden rounded-t-md bg-muted">
                                {cast.photo ? (
                                  <img 
                                    src={cast.photo} 
                                    alt={cast.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <User className="h-12 w-12" />
                                  </div>
                                )}
                              </div>
                              <div className="p-4">
                                <h3 className="text-xl font-bold mb-1" style={{ color: "#7a706c" }}>
                                  {cast.name}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {getProfileText(cast.profile) || "プロフィール情報なし"}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                  <span>{cast.age || "-"}歳</span>
                                  <span>•</span>
                                  <span>{cast.height || "-"}cm</span>
                                  {cast.cup_size && (
                                    <>
                                      <span>•</span>
                                      <span>({cast.cup_size})</span>
                                    </>
                                  )}
                                </div>
                                {cast.room && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    ■{cast.room}■
                                  </p>
                                )}
                                {/* 予約可能時間テーブル */}
                                {(() => {
                                  const slots = getCastTimeSlots(cast.id);
                                  if (slots.length === 0) return null;
                                  return (
                                    <div className="mb-3 overflow-x-auto">
                                      <div className="flex gap-1 min-w-max">
                                        {slots.map((slot) => (
                                          <div key={slot.time} className="flex flex-col items-center">
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                              {slot.time.slice(0, 5)}
                                            </span>
                                            <span className={cn(
                                              "text-xs font-bold",
                                              slot.available ? "text-green-600" : "text-red-400"
                                            )}>
                                              {slot.available ? "○" : "×"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                                <Button
                                  className="w-full"
                                  variant={selectedCastId === cast.id ? "default" : "outline"}
                                >
                                  {selectedCastId === cast.id ? "選択中" : "予約"}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      </>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        if (!selectedCastId) {
                          toast({
                            title: "セラピストを選択してください",
                            variant: "destructive",
                          });
                          return;
                        }
                        setCurrentStep(2);
                      }}
                      size="lg"
                    >
                      次へ
                    </Button>
                  </div>
                </div>
              )}

              {/* ステップ2: 時間選択 */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-4" style={{ color: "#7a706c" }}>
                      2. 予約時間を選んでください
                    </h2>
                    {selectedCast && (
                      <div className="mb-4 p-4 bg-muted rounded-lg">
                        <p className="font-semibold">選択中: {selectedCast.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(selectedDate, "M月d日 (E)", { locale: ja })}
                        </p>
                      </div>
                    )}
                    {availableTimeSlots.length > 0 ? (
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                        {availableTimeSlots.map((time) => (
                          <Button
                            key={time}
                            variant={startTime === time ? "default" : "outline"}
                            onClick={() => setStartTime(time)}
                            className="h-12"
                          >
                            {time}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-8 text-muted-foreground">
                        この日は空きがありません
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>
                      戻る
                    </Button>
                    <Button
                      onClick={() => {
                        if (!startTime) {
                          toast({
                            title: "時間を選択してください",
                            variant: "destructive",
                          });
                          return;
                        }
                        setCurrentStep(3);
                      }}
                      size="lg"
                    >
                      次へ
                    </Button>
                  </div>
                </div>
              )}

              {/* ステップ3: コース・オプション選択 */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "#7a706c" }}>
                    3. コースを選んでください
                  </h2>
                  
                  <div className="space-y-4">
                    {/* コースタイプ（DRを除く） */}
                    {(() => {
                      const courseTypes = [...new Set(backRates.map(r => r.course_type))];
                      const courseDescriptions: Record<string, string> = {
                        "アロマオイルトリートメント": "クイーンオイルを使用して全身をアロマオイルトリートメントしていきます。",
                        "全力": "疲れも悩みも全てを出し切るSPコース",
                        "DR": "ドクターズリラックスコース",
                      };
                      return courseTypes.map((type) => {
                        const rates = backRates
                          .filter(r => r.course_type === type)
                          .sort((a, b) => a.duration - b.duration);
                        return (
                          <div
                            key={type}
                            className={cn(
                              "border-2 rounded-lg p-4 cursor-pointer transition-all",
                              courseType === type ? "border-[#c49480] bg-[#f8f6f3]/50" : "border-gray-200"
                            )}
                            onClick={() => {
                              setCourseType(type);
                              if (!rates.find(r => r.duration === duration)) {
                                setDuration(rates[0]?.duration || 60);
                              }
                            }}
                          >
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 flex-wrap">
                              {type}コース
                              {type === "全力" && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm">
                                  ⭐ おすすめ
                                </span>
                              )}
                            </h3>
                            {courseDescriptions[type] && (
                              <p className="text-sm text-muted-foreground mb-3">{courseDescriptions[type]}</p>
                            )}
                            <div className={cn("grid gap-2", rates.length <= 2 ? "grid-cols-2" : "grid-cols-3")}>
                              {rates.map((rate) => (
                                <Button
                                  key={rate.id}
                                  variant={courseType === type && duration === rate.duration ? "default" : "outline"}
                                  className={cn(type === "全力" && rate.duration === 80 && "ring-2 ring-amber-400 ring-offset-1")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCourseType(type);
                                    setDuration(rate.duration);
                                  }}
                                >
                                  {type === "全力" && rate.duration === 80 ? "⭐ " : ""}{rate.duration}分<br/>¥{rate.customer_price.toLocaleString()}
                                </Button>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* 前日までの艶華80分限定クーポン（併用不可のため単一選択） */}
                    {publicCoupons.length > 0 && (
                      <div className="rounded-lg border-2 border-rose-200 bg-rose-50/50 p-4">
                        <h3 className="font-semibold mb-1">事前予約クーポン</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          前日までにご予約いただく艶華コース80分限定です。他のクーポンとは併用できません。
                        </p>
                        <div className="space-y-2">
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3">
                            <input
                              type="radio"
                              name="advance-booking-coupon"
                              checked={!selectedCouponId}
                              onChange={() => setSelectedCouponId("")}
                            />
                            <span className="text-sm font-medium">クーポンを利用しない</span>
                          </label>
                          {publicCoupons.map((coupon) => {
                            const basePrice = backRates.find(
                              (rate) => rate.course_type === "艶華" && rate.duration === 80,
                            )?.customer_price ?? 19000;
                            const couponPrice = Math.max(0, basePrice - Number(coupon.discount_value));
                            const badge = coupon.badge_text || `¥${Number(coupon.discount_value).toLocaleString()} OFF`;
                            const eligible = isAdvanceCouponEligible(coupon);
                            const unavailableReason = format(selectedDate, "yyyy-MM-dd") <= tokyoToday()
                              ? "当日予約には利用できません"
                              : !eligible
                                ? "艶華コース80分を選択すると利用できます"
                                : null;
                            return (
                              <label
                                key={coupon.id}
                                className={cn(
                                  "block rounded-lg border bg-white p-3 transition-colors",
                                  eligible ? "cursor-pointer hover:border-rose-300" : "cursor-not-allowed opacity-60",
                                  selectedCouponId === coupon.id && "border-rose-400 ring-1 ring-rose-300",
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="radio"
                                    name="advance-booking-coupon"
                                    className="mt-1"
                                    checked={selectedCouponId === coupon.id}
                                    disabled={!eligible}
                                    onChange={() => setSelectedCouponId(coupon.id)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold">{coupon.name}</span>
                                      <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{badge}</span>
                                    </div>
                                    <p className="mt-1 text-sm">
                                      通常80分 ¥{basePrice.toLocaleString()} → <span className="font-bold text-rose-600">¥{couponPrice.toLocaleString()}</span>
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {(coupon.terms.length > 0 ? coupon.terms : ["前日までの事前予約のみ", "当日利用不可", "他クーポンとの併用不可"]).join("／")}
                                    </p>
                                    {unavailableReason && (
                                      <p className="mt-1 text-xs font-medium text-amber-700">{unavailableReason}</p>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* DRオプション（プルダウン） */}
                    {drOptionRates.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">DR（ディープリンパ）</h3>
                        <Select value={selectedDROption} onValueChange={handleDROptionChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="なし（選択してください）" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">なし</SelectItem>
                            {drOptionRates.map((opt) => (
                              <SelectItem key={opt.id} value={opt.option_name}>
                                {opt.option_name}（+¥{opt.customer_price.toLocaleString()}）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* その他オプション */}
                    {regularOptionRates.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">オプション</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          ※オプションはセラピストごとに異なりますのでお問い合わせ下さい。
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {regularOptionRates.map((option) => (
                            <div
                              key={option.id}
                              className={cn(
                                "border rounded-lg p-3 cursor-pointer transition-all",
                                selectedOptions.includes(option.option_name)
                                  ? "border-[#c49480] bg-[#f8f6f3]/50"
                                  : "border-gray-200"
                              )}
                              onClick={() => {
                                if (selectedOptions.includes(option.option_name)) {
                                  setSelectedOptions(selectedOptions.filter(o => o !== option.option_name));
                                } else {
                                  setSelectedOptions([...selectedOptions, option.option_name]);
                                }
                              }}
                            >
                              <div className="font-semibold">{option.option_name}</div>
                              <div className="text-sm">+¥{option.customer_price.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 合計金額 */}
                    <div className="bg-muted p-4 rounded-lg">
                      {nominationType !== "none" && (() => {
                        const nr = nominationRates.find(n => n.nomination_type === nominationType);
                        if (!nr) return null;
                        return (
                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>指名料（{nominationType}）:</span>
                            <span>+¥{nr.customer_price.toLocaleString()}</span>
                          </div>
                        );
                      })()}
                      {(currentPricing.discountAmount > 0 || paymentFee > 0) && (
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>小計:</span>
                          <span>¥{currentPricing.subtotal.toLocaleString()}</span>
                        </div>
                      )}
                      {currentPricing.discountAmount > 0 && (
                        <div className="flex justify-between items-center text-sm text-rose-600">
                          <span>事前予約クーポン:</span>
                          <span>-¥{currentPricing.discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {paymentFee > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm text-muted-foreground mb-1">
                            <span>決済手数料:</span>
                            <span>+¥{paymentFee.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">合計金額:</span>
                        <span className="text-2xl font-bold" style={{ color: "#c49480" }}>
                          ¥{grandTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>
                      戻る
                    </Button>
                    <Button onClick={() => setCurrentStep(4)} size="lg">
                      次へ
                    </Button>
                  </div>
                </div>
              )}

              {/* ステップ4: お客様情報入力 */}
              {currentStep === 4 && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "#7a706c" }}>
                    4. お客様情報をご入力ください
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="customer_name">お名前（必須）</Label>
                      <Input
                        id="customer_name"
                        placeholder="山田太郎"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <Label htmlFor="customer_furigana">フリガナ（必須）</Label>
                      <Input
                        id="customer_furigana"
                        placeholder="ヤマダタロウ"
                        value={customerFurigana}
                        onChange={(e) => setCustomerFurigana(e.target.value)}
                        required
                        maxLength={100}
                      />
                      <p className="text-xs text-muted-foreground mt-1">カタカナ or ひらがな</p>
                    </div>

                    <div>
                      <Label htmlFor="customer_email">メールアドレス（必須）</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        placeholder="example@email.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        required
                        maxLength={255}
                      />
                    </div>

                    <div>
                      <Label htmlFor="customer_phone">電話番号（必須）</Label>
                      <Input
                        id="customer_phone"
                        type="tel"
                        placeholder="090-1234-5678"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        onBlur={handlePhoneBlur}
                        required
                        maxLength={20}
                      />
                      {selectedCastId !== "none" && selectedCastId !== "" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ※セラピストご指名のため指名料が加算されます{nominationType === "本指名" ? "（本指名）" : "（ネット指名）"}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="notes">その他ご希望</Label>
                      <Textarea
                        id="notes"
                        rows={4}
                        placeholder="ご要望やご質問などがございましたらご記入ください"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={1000}
                      />
                    </div>

                    <div>
                      <Label>お支払い方法</Label>
                      <div className="space-y-2 mt-2">
                        {[
                          { value: "cash", label: "現金" },
                          { value: "card", label: `カード${(findPaymentSetting(paymentSettings, "card")?.fee_percentage ?? 0) > 0 ? `（手数料${findPaymentSetting(paymentSettings, "card")!.fee_percentage}%）` : ""}` },
                          { value: "paypay", label: `PayPay${(findPaymentSetting(paymentSettings, "paypay")?.fee_percentage ?? 0) > 0 ? `（手数料${findPaymentSetting(paymentSettings, "paypay")!.fee_percentage}%）` : ""}` },
                        ].map((method) => (
                          <div key={method.value} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={`payment-${method.value}`}
                              checked={paymentMethod === method.value}
                              onChange={() => setPaymentMethod(method.value)}
                              className="rounded-full"
                            />
                            <label htmlFor={`payment-${method.value}`} className="text-sm">
                              {method.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">注意事項</h4>
                      <p className="text-sm text-muted-foreground">
                        『{shopPhone}』より予約詳細をショートメッセージにてお送りします。必ずショートメッセージを受け取れるように設定をお願いします。また、ひとこと返信をいただいた時点で予約確定となります。<br/>
                        領収書の発行は出来かねます。ご了承ください。
                      </p>
                    </div>

                    <div>
                      <Label>当店を知ったきっかけを教えてください</Label>
                      <Select value={referralSource} onValueChange={setReferralSource}>
                        <SelectTrigger>
                          <SelectValue placeholder="選択肢から選んでください" />
                        </SelectTrigger>
                        <SelectContent>
                          {referralSources.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {referralSource && !referralSources.includes(referralSource) && (
                      <div>
                        <Label htmlFor="referral_other">選択肢にない場合はこちらに記入ください</Label>
                        <Input
                          id="referral_other"
                          placeholder="その他の情報源"
                          value={referralOther}
                          onChange={(e) => setReferralOther(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(3)}>
                      戻る
                    </Button>
                    <Button type="submit" size="lg" disabled={submitting}>
                      {submitting ? "送信中..." : "確認画面へ"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
          </>)}
        </div>
      </main>

      {/* 予約ページ専用フッタータブ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-3 max-w-5xl mx-auto">
          {([
            { key: "now", label: "今すぐ", icon: Zap },
            { key: "select", label: "セラピストから選ぶ", icon: Users },
            { key: "menu", label: "おすすめメニュー", icon: LayoutGrid },
          ] as const).map((t) => {
            const Icon = t.icon;
            const active = bottomTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-white bg-[#c49480]" : "text-[#7a706c] hover:bg-[#f2e4de]"
                )}
              >
                <Icon size={18} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BookingReservation;
