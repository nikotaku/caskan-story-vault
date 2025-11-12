import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Clock, User, Phone, Mail, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { z } from "zod";
import caskanLogo from "@/assets/caskan-logo.png";

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

const reservationSchema = z.object({
  customer_name: z.string().trim().min(1, "お名前を入力してください").max(100, "お名前は100文字以内で入力してください"),
  customer_furigana: z.string().trim().min(1, "フリガナを入力してください").max(100, "フリガナは100文字以内で入力してください"),
  customer_phone: z.string().trim().min(10, "電話番号を入力してください").max(20, "電話番号は20文字以内で入力してください"),
  customer_email: z.string().trim().email("有効なメールアドレスを入力してください").max(255, "メールアドレスは255文字以内で入力してください"),
  notes: z.string().max(1000, "備考は1000文字以内で入力してください").optional(),
});

const BookingReservation = () => {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCastId, setSelectedCastId] = useState<string>("");
  const [courseType, setCourseType] = useState<string>("aroma");
  const [startTime, setStartTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(80);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [nominationType, setNominationType] = useState<string>("none");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerFurigana, setCustomerFurigana] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [referralSource, setReferralSource] = useState<string>("");
  const [referralOther, setReferralOther] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState<number>(0);

  useEffect(() => {
    document.title = "全力エステ - WEB予約";
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRates();
  }, []);

  // Fetch available casts when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableCasts();
      setSelectedCastId(""); // 日付変更時にセラピスト選択をリセット
    }
  }, [selectedDate]);

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

  // Calculate price when course, options, or nomination changes
  useEffect(() => {
    calculatePrice();
  }, [courseType, duration, selectedOptions, nominationType, backRates, optionRates, nominationRates]);

  const calculatePrice = () => {
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
    if (nominationType && nominationType !== 'none') {
      const matchingNomination = nominationRates.find(
        nom => nom.nomination_type === nominationType
      );
      if (matchingNomination) {
        price += matchingNomination.customer_price;
      }
    }

    setTotalPrice(price);
  };

  const fetchAvailableCasts = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      // Get shifts for the selected date
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shifts")
        .select("cast_id")
        .eq("shift_date", dateStr);

      if (shiftsError) throw shiftsError;

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

  const fetchShiftsAndReservations = async () => {
    if (!selectedDate || !selectedCastId) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shifts")
        .select("*")
        .eq("cast_id", selectedCastId)
        .eq("shift_date", dateStr);

      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("*")
        .eq("cast_id", selectedCastId)
        .eq("reservation_date", dateStr);

      if (shiftsError) throw shiftsError;
      if (reservationsError) throw reservationsError;

      setShifts(shiftsData || []);
      setReservations(reservationsData || []);
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
    const shiftEnd = shiftEndHour * 60 + shiftEndMinute;

    // インターバル時間（分）- 予約と予約の間に必要な準備時間
    const intervalMinutes = 30;

    // 30分刻みで可能な時間を生成
    const slots: string[] = [];
    for (let time = shiftStart; time + duration <= shiftEnd; time += 30) {
      const hour = Math.floor(time / 60);
      const minute = time % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // この時間帯が予約可能かチェック（インターバルを考慮）
      const isBooked = reservations.some(reservation => {
        const [resHour, resMinute] = reservation.start_time.split(':').map(Number);
        const resStart = resHour * 60 + resMinute;
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
      const courseName = courseType === "aroma" 
        ? `${duration}分 アロマオイルコース` 
        : `${duration}分 全力コース`;
      
      const { error } = await supabase
        .from("reservations")
        .insert([{
          cast_id: selectedCastId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim(),
          reservation_date: format(selectedDate, "yyyy-MM-dd"),
          start_time: startTime,
          duration: duration,
          course_type: courseType,
          course_name: courseName,
          options: selectedOptions.length > 0 ? selectedOptions : null,
          nomination_type: nominationType !== 'none' ? nominationType : null,
          price: totalPrice,
          notes: notes.trim() || null,
          status: "pending",
          payment_status: "unpaid",
          created_by: "00000000-0000-0000-0000-000000000000",
        }]);

      if (error) throw error;

      toast({
        title: "予約完了",
        description: "ご予約を承りました。担当者より確認のご連絡をさせていただきます。",
      });

      setTimeout(() => {
        navigate("/");
      }, 2000);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5e8e4" }}>
      {/* Top Contact Bar */}
      <div className="bg-[#d4b5a8] text-white py-2 px-4 flex justify-between items-center text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white py-6">
        <div className="container mx-auto text-center">
          <Link to="/">
            <img src={caskanLogo} alt="全力エステ" className="h-24 md:h-32 mx-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
          </Link>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-white border-y border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">TOP</div>
              <div className="text-xs text-[#a89586]">トップ</div>
            </Link>
            <Link to="/schedule" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SCHEDULE</div>
              <div className="text-xs text-[#a89586]">出勤情報</div>
            </Link>
            <Link to="/casts" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">THERAPIST</div>
              <div className="text-xs text-[#a89586]">セラピスト</div>
            </Link>
            <Link to="/system" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SYSTEM</div>
              <div className="text-xs text-[#a89586]">システム</div>
            </Link>
            <Link to="/booking" className="px-8 py-4 bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">BOOKING</div>
              <div className="text-xs text-[#a89586]">WEB予約</div>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 
            className="text-4xl font-bold mb-2 text-center"
            style={{ 
              color: "#8b7355",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em"
            }}
          >
            WEB予約
          </h1>
          <p className="text-center mb-8" style={{ color: "#a89586" }}>
            下記のフォームよりご予約ください
          </p>

          {/* ステップインジケーター */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                      currentStep === step
                        ? "bg-[#d4a574] text-white"
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
                    <h2 className="text-2xl font-bold mb-4" style={{ color: "#8b7355" }}>
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
                      <div className="text-lg font-semibold" style={{ color: "#8b7355" }}>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {casts.map((cast) => (
                          <Card
                            key={cast.id}
                            className={cn(
                              "cursor-pointer transition-all hover:shadow-lg",
                              selectedCastId === cast.id 
                                ? "ring-2 ring-[#d4a574] shadow-lg" 
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
                                <h3 className="text-xl font-bold mb-1" style={{ color: "#8b7355" }}>
                                  {cast.name}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {cast.profile || "プロフィール情報なし"}
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
                    <h2 className="text-2xl font-bold mb-4" style={{ color: "#8b7355" }}>
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
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "#8b7355" }}>
                    3. コースを選んでください
                  </h2>
                  
                  <div className="space-y-4">
                    {/* アロマオイルコース */}
                    <div
                      className={cn(
                        "border-2 rounded-lg p-4 cursor-pointer transition-all",
                        courseType === "aroma" ? "border-[#d4a574] bg-[#f5e8e4]/50" : "border-gray-200"
                      )}
                      onClick={() => setCourseType("aroma")}
                    >
                      <h3 className="text-lg font-bold mb-2">アロマオイルコース</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        クイーンオイルを使用して全身で全身をアロマオイルトリートメントしていきます。
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={courseType === "aroma" && duration === 80 ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseType("aroma");
                            setDuration(80);
                          }}
                        >
                          80分<br/>¥12,000
                        </Button>
                        <Button
                          variant={courseType === "aroma" && duration === 100 ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseType("aroma");
                            setDuration(100);
                          }}
                        >
                          100分<br/>¥15,000
                        </Button>
                        <Button
                          variant={courseType === "aroma" && duration === 120 ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseType("aroma");
                            setDuration(120);
                          }}
                        >
                          120分<br/>¥18,000
                        </Button>
                      </div>
                    </div>

                    {/* 全力コース */}
                    <div
                      className={cn(
                        "border-2 rounded-lg p-4 cursor-pointer transition-all",
                        courseType === "zenryoku" ? "border-[#d4a574] bg-[#f5e8e4]/50" : "border-gray-200"
                      )}
                      onClick={() => setCourseType("zenryoku")}
                    >
                      <h3 className="text-lg font-bold mb-2">疲れも悩みも全てを出し切るSPコース</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={courseType === "zenryoku" && duration === 60 ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseType("zenryoku");
                            setDuration(60);
                          }}
                        >
                          60分<br/>¥15,000
                        </Button>
                        <Button
                          variant={courseType === "zenryoku" && duration === 80 ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseType("zenryoku");
                            setDuration(80);
                          }}
                        >
                          80分<br/>¥19,000
                        </Button>
                      </div>
                    </div>

                    {/* オプション */}
                    <div>
                      <h3 className="font-semibold mb-2">オプション</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        ※オプションはセラピストごとに異なりますのでお問い合わせ下さい。
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {optionRates.map((option) => (
                          <div
                            key={option.id}
                            className={cn(
                              "border rounded-lg p-3 cursor-pointer transition-all",
                              selectedOptions.includes(option.option_name)
                                ? "border-[#d4a574] bg-[#f5e8e4]/50"
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

                    {/* 合計金額 */}
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">合計金額:</span>
                        <span className="text-2xl font-bold" style={{ color: "#d4a574" }}>
                          ¥{totalPrice.toLocaleString()}
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
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "#8b7355" }}>
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
                        required
                        maxLength={20}
                      />
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
                          { value: "card", label: "カード（別途手数料が発生します）" },
                          { value: "paypay", label: "PayPay（別途手数料が発生します）" },
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
                        『08031921209』より予約詳細をショートメッセージにてお送りします。必ずショートメッセージを受け取れるように設定をお願いします。また、ひとこと返信をいただいた時点で予約確定となります。<br/>
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
        </div>
      </main>

      {/* Footer */}
      <footer className="py-16 px-4 text-white" style={{ background: "linear-gradient(180deg, #d4b5a8 0%, #c5a89b 100%)" }}>
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <h4 className="font-bold mb-4 text-lg">営業時間</h4>
              <p className="text-white/95">12:00〜26:00</p>
              <p className="text-sm text-white/80">(24:40最終受付)</p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-lg">メニュー</h4>
              <div className="flex flex-col gap-3 text-sm">
                <Link to="/casts" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  セラピスト
                </Link>
                <Link to="/schedule" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  出勤情報
                </Link>
                <Link to="/system" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  システム
                </Link>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-white/70 pt-10 border-t border-white/20">
            © 2025 全力エステ ZR. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BookingReservation;