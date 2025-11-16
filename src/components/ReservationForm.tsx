import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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
  price: number;
  payment_method: string;
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
  onSubmit: () => void;
}

export function ReservationForm({
  formData,
  setFormData,
  casts,
  rooms,
  backRates,
  optionRates,
  nominationRates,
  onSubmit,
}: ReservationFormProps) {
  const courseTypeMapping: { [key: string]: string } = {
    aroma: "アロマオイル",
    mens: "メンズエステ",
    relaxation: "リラクゼーション",
  };

  const calculatePrice = useCallback(() => {
    let totalPrice = 0;

    const backRate = backRates.find(
      (rate) =>
        rate.course_type === (courseTypeMapping[formData.course_type] || formData.course_type) &&
        rate.duration === formData.duration
    );

    if (backRate) {
      totalPrice += backRate.customer_price;
    }

    formData.selectedOptions.forEach((optionName) => {
      const optionRate = optionRates.find((rate) => rate.option_name === optionName);
      if (optionRate) {
        totalPrice += optionRate.customer_price;
      }
    });

    if (formData.nomination_type && formData.nomination_type !== "none") {
      const nominationRate = nominationRates.find(
        (rate) => rate.nomination_type === formData.nomination_type
      );
      if (nominationRate) {
        totalPrice += nominationRate.customer_price;
      }
    }

    setFormData({ ...formData, price: totalPrice });
  }, [formData, backRates, optionRates, nominationRates, courseTypeMapping, setFormData]);

  useEffect(() => {
    calculatePrice();
  }, [formData.course_type, formData.duration, formData.selectedOptions, formData.nomination_type]);

  const handleOptionToggle = useCallback((optionName: string) => {
    const newOptions = formData.selectedOptions.includes(optionName)
      ? formData.selectedOptions.filter((o) => o !== optionName)
      : [...formData.selectedOptions, optionName];
    setFormData({ ...formData, selectedOptions: newOptions });
  }, [formData, setFormData]);

  const availableOptions = useMemo(() => 
    optionRates.map(rate => rate.option_name),
    [optionRates]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="customer_name">予約者</Label>
          <Input
            id="customer_name"
            placeholder="山田太郎"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="customer_phone">電話番号</Label>
          <Input
            id="customer_phone"
            placeholder="090-1234-5678"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
          />
        </div>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_time">開始時間</Label>
          <Input
            id="start_time"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="end_time">終了時間</Label>
          <Input
            id="end_time"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="room">ルーム</Label>
          <Select
            value={formData.room}
            onValueChange={(value) => setFormData({ ...formData, room: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="ルームを選択" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.name}>
                  {room.name}
                  {room.address && ` - ${room.address}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>コースタイプ</Label>
          <Select
            value={formData.course_type}
            onValueChange={(value) => setFormData({ ...formData, course_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aroma">アロマオイル</SelectItem>
              <SelectItem value="mens">メンズエステ</SelectItem>
              <SelectItem value="relaxation">リラクゼーション</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>時間</Label>
          <Select
            value={formData.duration.toString()}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                duration: parseInt(value),
                course_name: `${value}分 ${courseTypeMapping[formData.course_type] || formData.course_type}コース`,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {backRates
                .filter((rate) => rate.course_type === (courseTypeMapping[formData.course_type] || formData.course_type))
                .map((rate) => (
                  <SelectItem key={rate.id} value={rate.duration.toString()}>
                    {rate.duration}分 (¥{rate.customer_price.toLocaleString()})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>オプション</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {availableOptions.map((optionName) => {
            const rate = optionRates.find((r) => r.option_name === optionName);
            return (
              <div key={optionName} className="flex items-center space-x-2">
                <Checkbox
                  id={optionName}
                  checked={formData.selectedOptions.includes(optionName)}
                  onCheckedChange={() => handleOptionToggle(optionName)}
                />
                <label
                  htmlFor={optionName}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {optionName} (+¥{rate?.customer_price.toLocaleString()})
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">備考</Label>
        <Textarea
          id="notes"
          placeholder="特記事項があれば記入してください"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div className="pt-4 border-t">
        <div className="text-right">
          <p className="text-sm text-muted-foreground mb-1">合計金額</p>
          <p className="text-2xl font-bold text-primary">¥{formData.price.toLocaleString()}</p>
        </div>
      </div>

      <Button onClick={onSubmit} className="w-full" size="lg">
        予約を追加
      </Button>
    </div>
  );
}
