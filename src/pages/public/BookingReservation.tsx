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

interface Cast {
  id: string;
  name: string;
  type: string;
  photo: string | null;
  status: string;
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
  customer_phone: z.string().trim().min(10, "電話番号を入力してください").max(20, "電話番号は20文字以内で入力してください"),
  customer_email: z.string().trim().email("有効なメールアドレスを入力してください").max(255, "メールアドレスは255文字以内で入力してください").optional().or(z.literal("")),
  notes: z.string().max(1000, "備考は1000文字以内で入力してください").optional(),
});

const BookingReservation = () => {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedCastId, setSelectedCastId] = useState<string>("");
  const [courseType, setCourseType] = useState<string>("aroma");
  const [startTime, setStartTime] = useState<string>("14:00");
  const [duration, setDuration] = useState<number>(80);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [nominationType, setNominationType] = useState<string>("none");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState<number>(0);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCasts();
    fetchRates();
  }, []);

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

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from("casts")
        .select("id, name, type, photo, status")
        .order("name");

      if (error) throw error;
      setCasts(data || []);
    } catch (error) {
      console.error("Error fetching casts:", error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    try {
      reservationSchema.parse({
        customer_name: customerName,
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

    if (!selectedDate || !selectedCastId || !courseType) {
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
          customer_email: customerEmail.trim() || null,
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
          created_by: "00000000-0000-0000-0000-000000000000", // 匿名ユーザー
        }]);

      if (error) throw error;

      toast({
        title: "予約完了",
        description: "ご予約を承りました。担当者より確認のご連絡をさせていただきます。",
      });

      // フォームをリセット
      setSelectedDate(undefined);
      setSelectedCastId("");
      setCourseType("aroma");
      setStartTime("14:00");
      setDuration(80);
      setSelectedOptions([]);
      setNominationType("none");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setNotes("");

      // 少し待ってからトップページに戻る
      setTimeout(() => {
        navigate("/public");
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

      {/* Navigation Menu */}
      <nav className="bg-white border-y border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/public" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">TOP</div>
              <div className="text-xs text-[#a89586]">トップ</div>
            </Link>
            <Link to="/public/schedule" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SCHEDULE</div>
              <div className="text-xs text-[#a89586]">出勤情報</div>
            </Link>
            <Link to="/public/casts" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">THERAPIST</div>
              <div className="text-xs text-[#a89586]">セラピスト</div>
            </Link>
            <Link to="/public/system" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SYSTEM</div>
              <div className="text-xs text-[#a89586]">システム</div>
            </Link>
            <Link to="/public/booking" className="px-8 py-4 bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">BOOKING</div>
              <div className="text-xs text-[#a89586]">WEB予約</div>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 
            className="text-4xl font-bold mb-2 text-center"
            style={{ 
              color: "#8b7355",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em"
            }}
          >
            BOOKING - WEB予約
          </h1>
          <p className="text-center mb-8" style={{ color: "#a89586" }}>
            下記のフォームよりご予約ください。担当者より確認のご連絡をさせていただきます。
          </p>

          <Card>
            <CardHeader>
              <CardTitle>予約情報入力</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* お客様情報 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    お客様情報
                  </h3>
                  
                  <div>
                    <Label htmlFor="customer_name">お名前 *</Label>
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
                    <Label htmlFor="customer_phone">電話番号 *</Label>
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
                    <Label htmlFor="customer_email">メールアドレス（任意）</Label>
                    <Input
                      id="customer_email"
                      type="email"
                      placeholder="example@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      maxLength={255}
                    />
                  </div>
                </div>

                {/* 予約内容 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    予約内容
                  </h3>

                  <div>
                    <Label>セラピスト *</Label>
                    <Select value={selectedCastId} onValueChange={setSelectedCastId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="セラピストを選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {casts.map((cast) => (
                          <SelectItem key={cast.id} value={cast.id}>
                            {cast.name} ({cast.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>コースタイプ *</Label>
                      <Select value={courseType} onValueChange={setCourseType} required>
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
                      <Label>時間 *</Label>
                      <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))} required>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {courseType === "aroma" ? (
                            <>
                              <SelectItem value="80">80分 - ¥12,000</SelectItem>
                              <SelectItem value="100">100分 - ¥15,000</SelectItem>
                              <SelectItem value="120">120分 - ¥18,000</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="60">60分 - ¥15,000</SelectItem>
                              <SelectItem value="80">80分 - ¥19,000</SelectItem>
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
                            checked={selectedOptions.includes(option.option_name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOptions([...selectedOptions, option.option_name]);
                              } else {
                                setSelectedOptions(selectedOptions.filter(o => o !== option.option_name));
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

                  <div>
                    <Label>指名</Label>
                    <Select value={nominationType} onValueChange={setNominationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">指名なし</SelectItem>
                        {nominationRates.map((nom) => (
                          <SelectItem key={nom.id} value={nom.nomination_type}>
                            {nom.nomination_type} (+¥{nom.customer_price.toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>ご希望日 *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP", { locale: ja }) : <span>日付を選択</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="start_time">開始時刻 *</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">ご要望・備考（任意）</Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      placeholder="ご要望やご質問などがございましたらご記入ください"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={1000}
                    />
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">合計金額:</span>
                      <span className="text-2xl font-bold" style={{ color: "#d4a574" }}>
                        ¥{totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                    {submitting ? "送信中..." : "予約を確定する"}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    ※予約確定後、担当者より確認のご連絡をさせていただきます
                  </p>
                </div>
              </form>
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
                <Link to="/public/casts" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  セラピスト
                </Link>
                <Link to="/public/schedule" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  出勤情報
                </Link>
                <Link to="/public/system" className="text-white/85 hover:text-[#d4a574] transition-colors">
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