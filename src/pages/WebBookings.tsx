import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import {
  AlertCircle,
  Inbox,
  Loader2,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toExtTime } from "@/lib/timeFormat";
import { cn } from "@/lib/utils";

type WebBookingStatus = "unhandled" | "in_progress" | "handled";
type StatusFilter = WebBookingStatus | "all";
type BookingOrigin = "web_form" | "cast_form";

interface WebBooking {
  id: string;
  booking_origin: BookingOrigin;
  cast_id: string | null;
  casts: { name: string } | { name: string }[] | null;
  course_name: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  duration: number;
  price: number;
  reservation_date: string;
  start_time: string;
  status: string;
  web_booking_status: WebBookingStatus | null;
  web_booking_status_updated_at: string | null;
  web_booking_status_updated_by: string | null;
}

const WEB_BOOKING_STATUSES: Record<
  WebBookingStatus,
  { label: string; className: string }
> = {
  unhandled: {
    label: "未対応",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  in_progress: {
    label: "対応中",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  handled: {
    label: "対応済み",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  confirmed: "確定",
  hold: "保留",
  completed: "完了",
  cancelled: "キャンセル",
  pending: "確認待ち",
  sms_waiting: "SMS確認待ち",
};

const RESERVATION_STATUS_STYLES: Record<string, string> = {
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  hold: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  sms_waiting: "border-violet-200 bg-violet-50 text-violet-700",
};

const ORIGIN_LABELS: Record<BookingOrigin, string> = {
  web_form: "WEB予約フォーム",
  cast_form: "セラピスト専用フォーム",
};

const RECEIVED_AT_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function operationalStatus(booking: WebBooking): WebBookingStatus {
  return booking.web_booking_status ?? "unhandled";
}

function castName(booking: WebBooking): string {
  if (Array.isArray(booking.casts)) return booking.casts[0]?.name ?? "未設定";
  return booking.casts?.name ?? "未設定";
}

function formatReceivedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : RECEIVED_AT_FORMATTER.format(date);
}

function formatBookingDate(dateValue: string, timeValue: string): string {
  const storedDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(storedDate.getTime())) return dateValue;
  const displayedDate = toExtTime(timeValue) !== timeValue.slice(0, 5)
    ? subDays(storedDate, 1)
    : storedDate;
  return format(displayedDate, "yyyy/MM/dd（E）", { locale: ja });
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/(?!^\+)\D/g, "")}`;
}

function reservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABELS[status] ?? status;
}

function ReservationStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-medium",
        RESERVATION_STATUS_STYLES[status] ?? "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      {reservationStatusLabel(status)}
    </Badge>
  );
}

interface OperationalStatusSelectProps {
  booking: WebBooking;
  disabled: boolean;
  onChange: (booking: WebBooking, status: WebBookingStatus) => void;
}

function OperationalStatusSelect({
  booking,
  disabled,
  onChange,
}: OperationalStatusSelectProps) {
  const currentStatus = operationalStatus(booking);

  return (
    <Select
      value={currentStatus}
      disabled={disabled}
      onValueChange={(value) => onChange(booking, value as WebBookingStatus)}
    >
      <SelectTrigger
        aria-label={`${booking.customer_name}様の対応状況`}
        className={cn(
          "h-9 min-w-[112px] border font-semibold shadow-none",
          WEB_BOOKING_STATUSES[currentStatus].className,
        )}
      >
        {disabled ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(WEB_BOOKING_STATUSES) as [
          WebBookingStatus,
          (typeof WEB_BOOKING_STATUSES)[WebBookingStatus],
        ][]).map(([value, item]) => (
          <SelectItem key={value} value={value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function WebBookings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bookings, setBookings] = useState<WebBooking[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unhandled");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "WEB予約受付";
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, navigate, user]);

  const fetchBookings = useCallback(
    async ({ background = false, notifyOnError = true } = {}) => {
      if (!background) setLoading(true);
      setFetchError(null);

      try {
        const { data, error } = await supabase
          .from("reservations")
          .select(
            "id, booking_origin, cast_id, casts(name), course_name, created_at, customer_name, customer_phone, duration, price, reservation_date, start_time, status, web_booking_status, web_booking_status_updated_at, web_booking_status_updated_by",
          )
          .in("booking_origin", ["web_form", "cast_form"])
          .eq("store_id", storeId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setBookings((data ?? []) as WebBooking[]);
      } catch (error) {
        console.error("Failed to fetch web bookings", error);
        setFetchError("WEB予約を読み込めませんでした。時間をおいて再度お試しください。");
        if (notifyOnError) toast.error("WEB予約の取得に失敗しました");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [storeId],
  );

  useEffect(() => {
    if (!user || !isAdmin || storeLoading) return;
    void fetchBookings();
  }, [fetchBookings, isAdmin, storeLoading, user]);

  useEffect(() => {
    if (!user || !isAdmin || storeLoading) return;

    const channel = supabase
      .channel(`web-bookings-${user.id}-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `store_id=eq.${storeId}`,
        },
        () => void fetchBookings({ background: true, notifyOnError: false }),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          toast.error("WEB予約の自動更新に接続できませんでした");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchBookings, isAdmin, storeId, storeLoading, user]);

  const counts = useMemo(() => {
    const next = { all: bookings.length, unhandled: 0, in_progress: 0, handled: 0 };
    bookings.forEach((booking) => {
      next[operationalStatus(booking)] += 1;
    });
    return next;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ja");
    const phoneQuery = searchQuery.replace(/\D/g, "");

    return bookings.filter((booking) => {
      if (statusFilter !== "all" && operationalStatus(booking) !== statusFilter) return false;
      if (!normalizedQuery) return true;

      const matchesName = booking.customer_name
        .toLocaleLowerCase("ja")
        .includes(normalizedQuery);
      const matchesPhone = phoneQuery.length > 0
        && booking.customer_phone.replace(/\D/g, "").includes(phoneQuery);
      return matchesName || matchesPhone;
    });
  }, [bookings, searchQuery, statusFilter]);

  const handleOperationalStatusChange = async (
    booking: WebBooking,
    nextStatus: WebBookingStatus,
  ) => {
    if (!user) {
      toast.error("ログイン状態を確認できませんでした");
      return;
    }
    if (operationalStatus(booking) === nextStatus) return;

    setUpdatingIds((current) => [...current, booking.id]);

    try {
      // Do not update reservations.status here. It is the booking lifecycle status,
      // while web_booking_status is the separate form-response workflow.
      const { data, error } = await supabase.rpc("update_web_booking_status", {
        p_reservation_id: booking.id,
        p_status: nextStatus,
        p_store_id: storeId,
      });

      if (error) throw error;
      const updatedRow = data?.[0];
      if (!updatedRow) throw new Error("Updated web booking was not returned");

      setBookings((current) => current.map((item) => (
        item.id === booking.id
          ? {
              ...item,
              web_booking_status: updatedRow.web_booking_status as WebBookingStatus | null,
              web_booking_status_updated_at: updatedRow.web_booking_status_updated_at,
              web_booking_status_updated_by: updatedRow.web_booking_status_updated_by,
            }
          : item
      )));
      toast.success(`対応状況を「${WEB_BOOKING_STATUSES[nextStatus].label}」に変更しました`);
    } catch (error) {
      console.error("Failed to update web booking status", error);
      toast.error("対応状況の変更に失敗しました");
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== booking.id));
    }
  };

  const tabs: { value: StatusFilter; label: string; count: number }[] = [
    { value: "unhandled", label: "未対応", count: counts.unhandled },
    { value: "in_progress", label: "対応中", count: counts.in_progress },
    { value: "handled", label: "対応済み", count: counts.handled },
    { value: "all", label: "すべて", count: counts.all },
  ];

  const pageContent = (() => {
    if (authLoading || storeLoading || !user) {
      return (
        <div className="grid min-h-[45vh] place-items-center text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>管理者権限が必要です</AlertTitle>
          <AlertDescription>このページは管理者のみ利用できます。</AlertDescription>
        </Alert>
      );
    }

    return (
      <>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">WEB予約受付</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              予約の確定・キャンセルとは別に、フォームへの対応状況を管理します。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={loading}
            onClick={() => void fetchBookings()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            再読み込み
          </Button>
        </div>

        <Card className="mb-5">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="min-w-0 gap-1 px-1.5 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
                  >
                    <span>{tab.label}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground data-[state=active]:bg-primary/10 sm:text-xs">
                      {tab.count}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="お客様名・電話番号で検索"
                aria-label="お客様名・電話番号で検索"
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {fetchError ? (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>読み込みエラー</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{fetchError}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void fetchBookings()}
              >
                再試行
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="grid min-h-64 place-items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                WEB予約を読み込み中...
              </div>
            </CardContent>
          </Card>
        ) : filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">
                {searchQuery.trim()
                  ? "検索条件に一致するWEB予約はありません"
                  : statusFilter === "unhandled"
                    ? "未対応のWEB予約はありません"
                    : "該当するWEB予約はありません"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                新しいフォーム予約はここに自動で追加されます。
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="hidden overflow-hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1260px] text-sm">
                  <caption className="sr-only">WEB予約フォームから受け付けた予約一覧</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="whitespace-nowrap px-4 py-3 font-medium">受付日時</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">予約日時</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">お客様</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">電話番号</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">セラピスト</th>
                      <th className="px-4 py-3 font-medium">コース</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium">料金</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">予約状況</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">受付元</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">対応状況</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="align-middle transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {formatReceivedAt(booking.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-medium">
                            {formatBookingDate(booking.reservation_date, booking.start_time)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {toExtTime(booking.start_time)}（{booking.duration}分）
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {booking.customer_name} 様
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <a
                            href={phoneHref(booking.customer_phone)}
                            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {booking.customer_phone}
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{castName(booking)}</td>
                        <td className="max-w-56 px-4 py-3">{booking.course_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                          ¥{Number(booking.price || 0).toLocaleString("ja-JP")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <ReservationStatusBadge status={booking.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {ORIGIN_LABELS[booking.booking_origin] ?? booking.booking_origin}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <OperationalStatusSelect
                            booking={booking}
                            disabled={updatingIds.includes(booking.id)}
                            onChange={handleOperationalStatusChange}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-3 lg:hidden">
              {filteredBookings.map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold">{booking.customer_name} 様</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          受付 {formatReceivedAt(booking.created_at)}
                        </p>
                      </div>
                      <OperationalStatusSelect
                        booking={booking}
                        disabled={updatingIds.includes(booking.id)}
                        onChange={handleOperationalStatusChange}
                      />
                    </div>

                    <a
                      href={phoneHref(booking.customer_phone)}
                      className="flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2.5 font-semibold text-primary"
                    >
                      <Phone className="h-4 w-4" />
                      {booking.customer_phone}
                    </a>

                    <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2.5 text-sm">
                      <span className="text-muted-foreground">予約日時</span>
                      <span className="font-medium">
                        {formatBookingDate(booking.reservation_date, booking.start_time)}<br />
                        {toExtTime(booking.start_time)}（{booking.duration}分）
                      </span>

                      <span className="text-muted-foreground">セラピスト</span>
                      <span>{castName(booking)}</span>

                      <span className="text-muted-foreground">コース</span>
                      <span>{booking.course_name}</span>

                      <span className="text-muted-foreground">料金</span>
                      <span className="font-semibold tabular-nums">
                        ¥{Number(booking.price || 0).toLocaleString("ja-JP")}
                      </span>

                      <span className="text-muted-foreground">予約状況</span>
                      <span><ReservationStatusBadge status={booking.status} /></span>

                      <span className="text-muted-foreground">受付元</span>
                      <span>{ORIGIN_LABELS[booking.booking_origin] ?? booking.booking_origin}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </>
    );
  })();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[68px] md:ml-[240px] md:pt-[76px]">
        <div className="mx-auto max-w-[1500px] px-4 pb-8 sm:px-6">
          {pageContent}
        </div>
      </main>
    </div>
  );
}
