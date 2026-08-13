import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { Check, RefreshCw } from "lucide-react";
import { toExtTime } from "@/lib/timeFormat";

interface SalesRecord {
  id: string;
  date: string;
  cast_id: string | null;
  store_id: string;
  cash_amount: number;
  card_amount: number;
  paypay_amount: number;
  total_amount: number;
  manual_adjustment: number;
  customer_count: number;
  notes: string | null;
  status: string;
  created_at: string;
  casts: { name: string } | null;
}

interface ReservationDetail {
  customer_name: string;
  course_name: string;
  price: number;
  payment_fee: number;
  options: string[];
  start_time: string | null;
}

interface CleaningRecord {
  id: string;
  date: string;
  room_cleaned: boolean;
  supplies_stocked: boolean;
  trash_taken_out: boolean;
  equipment_checked: boolean;
  notes: string | null;
  status: string;
  created_at: string;
  casts: { name: string } | null;
}

interface FeedbackRecord {
  id: string;
  date: string;
  rating: number;
  good_points: string | null;
  improvement_points: string | null;
  customer_feedback: string | null;
  status: string;
  created_at: string;
  casts: { name: string } | null;
}

type Tab = "sales" | "cleaning" | "feedback";

const yen = (v: number) => `¥${v.toLocaleString()}`;
const fmtDate = (d: string) => format(parseISO(d), "M月d日(E)", { locale: ja });

export default function SalesPendingReports() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("sales");
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<CleaningRecord[]>([]);
  const [feedbackRecords, setFeedbackRecords] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // key: "YYYY-MM-DD_castId" → 予約詳細リスト
  const [reservationsByKey, setReservationsByKey] = useState<Record<string, ReservationDetail[]>>({});
  // store_id:option_name → customer_price
  const [optionPriceMap, setOptionPriceMap] = useState<Record<string, number>>({});

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, showAll]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const statusFilter = showAll ? ["pending", "confirmed"] : ["pending"];
      const [s, c, f, optResult] = await Promise.all([
        supabase
          .from("daily_sales_records")
          .select("*, cast_id, casts(name)")
          .in("status", statusFilter)
          .order("date", { ascending: false }),
        supabase
          .from("cleaning_checklists")
          .select("*, casts(name)")
          .in("status", statusFilter)
          .order("date", { ascending: false }),
        supabase
          .from("daily_feedback")
          .select("*, casts(name)")
          .in("status", statusFilter)
          .order("date", { ascending: false }),
        supabase
          .from("option_rates")
          .select("store_id, option_name, customer_price"),
      ]);

      const salesData = (s.data as SalesRecord[]) || [];
      setSalesRecords(salesData);
      setCleaningRecords((c.data as CleaningRecord[]) || []);
      setFeedbackRecords((f.data as FeedbackRecord[]) || []);

      // オプション料金マップ
      const priceMap: Record<string, number> = {};
      for (const o of optResult.data || []) {
        priceMap[`${o.store_id}:${o.option_name}`] = o.customer_price ?? 0;
      }
      setOptionPriceMap(priceMap);

      // 予約詳細を営業日の (date, cast_id) ごとに取得する。
      // 営業日には翌日の営業開始時刻前までを含める。
      const uniqueDates = [...new Set(salesData.map((r) => r.date))];
      if (uniqueDates.length > 0) {
        const storeIds = [...new Set(salesData.map((r) => r.store_id))];
        const calendarDates = [...new Set(uniqueDates.flatMap((date) => [
          date,
          format(addDays(parseISO(date), 1), "yyyy-MM-dd"),
        ]))];
        const [{ data: resData }, { data: settingsData }] = await Promise.all([
          supabase
            .from("reservations")
            .select("store_id, cast_id, reservation_date, price, payment_fee, customer_name, course_name, start_time, options")
            .in("store_id", storeIds)
            .in("reservation_date", calendarDates)
            .in("status", ["confirmed", "completed"])
            .order("reservation_date", { ascending: true })
            .order("start_time", { ascending: true }),
          supabase
            .from("shop_settings")
            .select("store_id, business_day_start")
            .in("store_id", storeIds),
        ]);

        const dayStartByStore: Record<string, string> = {};
        for (const setting of settingsData || []) {
          const configuredStart = setting.business_day_start || "10:00";
          dayStartByStore[setting.store_id] = configuredStart.length === 5
            ? `${configuredStart}:00`
            : configuredStart;
        }
        const requestedBusinessDates = new Set(uniqueDates);

        const detailsMap: Record<string, ReservationDetail[]> = {};
        for (const res of resData || []) {
          const dayStartTime = dayStartByStore[res.store_id] || "10:00:00";
          const businessDate = res.start_time < dayStartTime
            ? format(addDays(parseISO(res.reservation_date), -1), "yyyy-MM-dd")
            : res.reservation_date;
          if (!requestedBusinessDates.has(businessDate)) continue;

          const key = `${businessDate}_${res.cast_id}`;
          if (!detailsMap[key]) detailsMap[key] = [];
          detailsMap[key].push({
            customer_name: res.customer_name ?? "不明",
            course_name: res.course_name ?? "不明",
            price: res.price ?? 0,
            payment_fee: res.payment_fee ?? 0,
            options: Array.isArray(res.options) ? res.options : [],
            start_time: res.start_time ?? null,
          });
        }
        setReservationsByKey(detailsMap);
      } else {
        setReservationsByKey({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (table: string, id: string, setter: (id: string) => void) => {
    setConfirming(id);
    try {
      const { error } = await supabase
        .from(table)
        .update({ status: "confirmed" })
        .eq("id", id);
      if (error) throw error;
      toast.success("確認済みにしました");
      setter(id);
    } catch (e: unknown) {
      toast.error(`失敗しました：${e instanceof Error ? e.message : "不明なエラー"}`);
    } finally {
      setConfirming(null);
    }
  };

  const confirmSales = async (id: string) => {
    setConfirming(id);
    try {
      // 売上報告の行固定・権限確認・予約完了・報告承認をDB内の1処理で行う。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.rpc("confirm_daily_sales_report", {
        p_report_id: id,
      });
      if (error) throw error;
      toast.success("承認しました（予約を完了にしました）");
      setSalesRecords((rs) => rs.map((r) => r.id === id ? { ...r, status: "confirmed" } : r));
    } catch (e: unknown) {
      toast.error(`失敗しました：${e instanceof Error ? e.message : "不明なエラー"}`);
    } finally {
      setConfirming(null);
    }
  };
  const confirmCleaning = (id: string) => {
    confirm("cleaning_checklists", id, (rid) =>
      setCleaningRecords((rs) => rs.map((r) => r.id === rid ? { ...r, status: "confirmed" } : r))
    );
  };
  const confirmFeedback = (id: string) => {
    confirm("daily_feedback", id, (rid) =>
      setFeedbackRecords((rs) => rs.map((r) => r.id === rid ? { ...r, status: "confirmed" } : r))
    );
  };

  const pendingCount = {
    sales: salesRecords.filter((r) => r.status === "pending").length,
    cleaning: cleaningRecords.filter((r) => r.status === "pending").length,
    feedback: feedbackRecords.filter((r) => r.status === "pending").length,
  };

  const tabLabel = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {label}
      {pendingCount[key] > 0 && (
        <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
          {pendingCount[key]}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">確認待ちボックス</h1>
              <p className="text-muted-foreground text-sm">セラピストからの報告を確認してください</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
                {showAll ? "未確認のみ" : "すべて表示"}
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchAll}>
                <RefreshCw size={14} />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {tabLabel("sales", "売上報告")}
            {tabLabel("cleaning", "清掃チェック")}
            {tabLabel("feedback", "フィードバック")}
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">読み込み中...</div>
          ) : tab === "sales" ? (
            salesRecords.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">確認待ちの報告はありません</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {salesRecords.map((r) => {
                  const resDetails = r.cast_id ? (reservationsByKey[`${r.date}_${r.cast_id}`] ?? []) : [];
                  const resTotal = resDetails.length > 0
                    ? resDetails.reduce((s, rd) => s + rd.price + rd.payment_fee, 0)
                    : null;
                  const expectedTotal = resTotal !== null ? resTotal + (r.manual_adjustment || 0) : null;
                  const diff = expectedTotal !== null ? r.total_amount - expectedTotal : null;
                  const hasDiff = diff !== null && diff !== 0;
                  return (
                    <Card key={r.id} className={hasDiff ? "border-orange-300" : ""}>
                      <CardContent className="pt-4 pb-4">
                        {/* ヘッダー行 */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{fmtDate(r.date)}</span>
                              <span className="text-sm text-muted-foreground">{r.casts?.name ?? "不明"}</span>
                              {r.status === "confirmed" ? (
                                <Badge variant="secondary">確認済</Badge>
                              ) : (
                                <Badge variant="destructive">未確認</Badge>
                              )}
                              {hasDiff && (
                                <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">差異あり</Badge>
                              )}
                            </div>

                            {/* 申告額サマリー */}
                            <div className="flex flex-wrap gap-3 text-sm tabular-nums">
                              <span>申請額 <strong>{yen(r.total_amount)}</strong></span>
                              <span className="text-muted-foreground">現金 {yen(r.cash_amount)}</span>
                              <span className="text-muted-foreground">カード {yen(r.card_amount)}</span>
                              <span className="text-muted-foreground">PayPay {yen(r.paypay_amount)}</span>
                              {!!r.manual_adjustment && (
                                <span className="text-muted-foreground">調整 {yen(r.manual_adjustment)}</span>
                              )}
                              <span className="text-muted-foreground">{r.customer_count}件</span>
                            </div>

                            {/* 予約詳細（DBから取得した予約1件ずつ） */}
                            {resDetails.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {resDetails.map((rd, i) => {
                                  const optTotal = rd.options.reduce((s, o) => s + (optionPriceMap[`${r.store_id}:${o}`] ?? 0), 0);
                                  return (
                                    <div key={i} className="text-xs bg-muted/30 rounded px-2.5 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">
                                          {rd.start_time ? `${toExtTime(rd.start_time)} ` : ""}
                                          {rd.customer_name}｜{rd.course_name}
                                        </span>
                                        <span className="tabular-nums font-semibold flex-shrink-0">
                                          {yen(rd.price + rd.payment_fee)}
                                        </span>
                                      </div>
                                      {rd.options.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-1 text-muted-foreground">
                                          {rd.options.map((o, j) => (
                                            <span key={j} className="text-blue-600">
                                              +{o}{optionPriceMap[`${r.store_id}:${o}`] !== undefined ? ` ${yen(optionPriceMap[`${r.store_id}:${o}`])}` : ""}
                                            </span>
                                          ))}
                                          {optTotal > 0 && (
                                            <span className="text-muted-foreground">（OP合計 {yen(optTotal)}）</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* 予約データとの合計比較 */}
                            {resTotal !== null && (
                              <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${hasDiff ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"}`}>
                                <span>
                                  予約データ合計{r.manual_adjustment ? "＋調整" : ""}: <strong>{yen(expectedTotal!)}</strong>
                                </span>
                                {hasDiff && (
                                  <span className="font-semibold">
                                    （{diff! > 0 ? "+" : ""}{yen(diff!)} のズレ）
                                  </span>
                                )}
                                {!hasDiff && <span>✓ 一致</span>}
                              </div>
                            )}

                            {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                          </div>

                          {/* 承認ボタン */}
                          {r.status === "pending" && (
                            <Button
                              size="sm"
                              className={hasDiff ? "bg-orange-500 hover:bg-orange-600 text-white flex-shrink-0" : "flex-shrink-0"}
                              onClick={() => confirmSales(r.id)}
                              disabled={confirming === r.id}
                            >
                              <Check size={14} className="mr-1" />申告を承認する
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          ) : tab === "cleaning" ? (
            cleaningRecords.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">確認待ちの報告はありません</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {cleaningRecords.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{fmtDate(r.date)}</span>
                            <span className="text-sm text-muted-foreground">{r.casts?.name ?? "不明"}</span>
                            {r.status === "confirmed" ? (
                              <Badge variant="secondary">確認済</Badge>
                            ) : (
                              <Badge variant="destructive">未確認</Badge>
                            )}
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className={r.room_cleaned ? "text-green-600" : "text-red-500"}>ルーム清掃 {r.room_cleaned ? "✓" : "✗"}</span>
                            <span className={r.supplies_stocked ? "text-green-600" : "text-red-500"}>備品補充 {r.supplies_stocked ? "✓" : "✗"}</span>
                            <span className={r.trash_taken_out ? "text-green-600" : "text-red-500"}>ゴミ {r.trash_taken_out ? "✓" : "✗"}</span>
                            <span className={r.equipment_checked ? "text-green-600" : "text-red-500"}>設備確認 {r.equipment_checked ? "✓" : "✗"}</span>
                          </div>
                          {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                        </div>
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => confirmCleaning(r.id)}
                            disabled={confirming === r.id}
                          >
                            <Check size={14} className="mr-1" />確認
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            feedbackRecords.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">確認待ちの報告はありません</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {feedbackRecords.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{fmtDate(r.date)}</span>
                            <span className="text-sm text-muted-foreground">{r.casts?.name ?? "不明"}</span>
                            <span className="text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                            {r.status === "confirmed" ? (
                              <Badge variant="secondary">確認済</Badge>
                            ) : (
                              <Badge variant="destructive">未確認</Badge>
                            )}
                          </div>
                          {r.good_points && (
                            <p className="text-xs"><span className="text-muted-foreground">良かった点：</span>{r.good_points}</p>
                          )}
                          {r.improvement_points && (
                            <p className="text-xs"><span className="text-muted-foreground">改善点：</span>{r.improvement_points}</p>
                          )}
                          {r.customer_feedback && (
                            <p className="text-xs"><span className="text-muted-foreground">お客様の声：</span>{r.customer_feedback}</p>
                          )}
                        </div>
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => confirmFeedback(r.id)}
                            disabled={confirming === r.id}
                          >
                            <Check size={14} className="mr-1" />確認
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
