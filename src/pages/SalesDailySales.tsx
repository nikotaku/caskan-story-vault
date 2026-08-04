import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useShopSettings, getBusinessDateFromCache } from "@/hooks/useShopSettings";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, addDays, isToday } from "date-fns";
import { toExtTime } from "@/lib/timeFormat";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, CreditCard, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { downloadClearanceReceipt } from "@/lib/clearanceReceipt";
import {
  type ClearanceExtraItem,
  combineClearanceExtraItems,
  splitClearanceExtraItems,
  sumClearanceExtraItems,
} from "@/lib/clearanceExtraItems";

interface Reservation {
  id: string;
  customer_name: string;
  start_time: string;
  course_name: string;
  price: number;
  discount: number | null;
  status: string;
  course_type: string | null;
  duration: number | null;
  cast_id: string | null;
  options: string[] | null;
  nomination_type: string | null;
  payment_fee: number | null;
  payment_method: string | null;
  payment_details: { method: string; amount: number }[] | null;
  casts: { id: string; name: string; access_token: string | null } | null;
  // 計算済みバック内訳
  courseBack?: number;
  optionBacks?: { name: string; back: number }[];
  nominationBack?: number;
  nominationType?: string | null;
  totalBack?: number;
}

interface CastGroup {
  castId: string;
  castName: string;
  accessToken: string | null;
  reservations: Reservation[];
  totalSales: number;
  cashSales: number;
  autoBack: number;
}

interface Clearance {
  id: string;
  cast_id: string;
  therapist_back: number;
  misc_expenses: number;
  accommodation_fee: number;
  transportation_fee: number;
  payout_amount: number;
  payout_method: string | null;
  status: string;
  cleared_at: string | null;
  other_expenses: unknown;
}

interface ClearanceInput {
  therapistBack: number;
  miscExpenses: number;
  accommodationFee: number;
  transportationFee: number;
  otherItems: ClearanceExtraItem[];
  salaryAdjustmentItems: ClearanceExtraItem[];
  payoutMethod: string;
  submitting: boolean;
}

const yen = (v: number) => v === 0 ? "¥0" : `¥${v.toLocaleString()}`;

const getClearanceAmounts = (input: ClearanceInput) => {
  const otherTotal = sumClearanceExtraItems(input.otherItems);
  const salaryAdjustmentTotal = sumClearanceExtraItems(input.salaryAdjustmentItems);
  const salary = input.therapistBack
    - input.miscExpenses
    - input.accommodationFee
    + input.transportationFee
    - otherTotal
    + salaryAdjustmentTotal;

  return { otherTotal, salaryAdjustmentTotal, salary };
};

export default function SalesDailySales() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getBusinessDateFromCache);
  const [castGroups, setCastGroups] = useState<CastGroup[]>([]);
  const [clearances, setClearances] = useState<Record<string, Clearance>>({});
  const [clearanceInputs, setClearanceInputs] = useState<Record<string, ClearanceInput>>({});
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const { dayStartTime, loaded: settingsLoaded, businessToday } = useShopSettings();
  useEffect(() => {
    if (settingsLoaded) setSelectedDate(businessToday);
  }, [settingsLoaded]); // eslint-disable-line
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchDay();
  }, [user, selectedDate]);

  const fetchDay = useCallback(async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const nextDateStr = format(addDays(selectedDate, 1), "yyyy-MM-dd");
    try {
      const [resResult, nextResResult, backRatesResult, optionRatesResult, nominationRatesResult, clearResult] = await Promise.all([
        supabase
          .from("reservations")
          .select("id, customer_name, start_time, course_name, price, discount, status, course_type, duration, cast_id, options, nomination_type, payment_fee, payment_method, payment_details, casts(id, name, access_token)")
          .eq("reservation_date", dateStr)
          .gte("start_time", dayStartTime) // 営業開始時刻以前は前日の深夜またぎ分なので除外
          .in("status", ["confirmed", "completed"])
          .order("start_time"),
        // 深夜またぎ分：翌日日付で保存されているが営業開始前の予約は当日扱い
        supabase
          .from("reservations")
          .select("id, customer_name, start_time, course_name, price, discount, status, course_type, duration, cast_id, options, nomination_type, payment_fee, payment_method, payment_details, casts(id, name, access_token)")
          .eq("reservation_date", nextDateStr)
          .lt("start_time", dayStartTime)
          .in("status", ["confirmed", "completed"])
          .order("start_time"),
        supabase.from("back_rates").select("course_type, duration, therapist_back"),
        supabase.from("option_rates").select("option_name, therapist_back"),
        supabase.from("nomination_rates").select("nomination_type, therapist_back"),
        supabase
          .from("daily_clearances" as any)
          .select("*")
          .eq("date", dateStr),
      ]);

      const brMap: Record<string, number> = {};
      for (const br of backRatesResult.data || []) {
        brMap[`${br.course_type}_${br.duration}`] = br.therapist_back ?? 0;
      }
      const optMap: Record<string, number> = {};
      for (const or of optionRatesResult.data || []) {
        optMap[or.option_name] = or.therapist_back ?? 0;
      }
      const nomMap: Record<string, number> = {};
      for (const nr of nominationRatesResult.data || []) {
        nomMap[nr.nomination_type] = nr.therapist_back ?? 0;
      }

      // 予約の course_type は null や旧表記（「全力コース」等）が多く、
      // バック表（course_type = 「アロマオイルトリートメント」「全力」）と一致しないため、
      // course_name からコース種別を推定してバック額を照合する
      const findCourseBack = (
        courseType: string | null,
        courseName: string | null,
        duration: number | null
      ): number => {
        const direct = brMap[`${courseType}_${duration}`];
        if (direct !== undefined) return direct;
        const name = courseName ?? "";
        let inferred: string | null = null;
        if (name.includes("アロマ")) inferred = "アロマオイルトリートメント";
        else if (name.includes("全力")) inferred = "全力";
        if (inferred) {
          const byName = brMap[`${inferred}_${duration}`];
          if (byName !== undefined) return byName;
        }
        return 0;
      };

      // 当日 + 翌日早朝（深夜またぎ）を結合し start_time 昇順にソート
      const allRes = [
        ...((resResult.data as Reservation[]) || []),
        ...((nextResResult.data as Reservation[]) || []),
      ].sort((a, b) => {
        const toMin = (t: string) => {
          const [h, m] = t.slice(0, 5).split(":").map(Number);
          return (h < 6 ? h + 24 : h) * 60 + m;
        };
        return toMin(a.start_time) - toMin(b.start_time);
      });

      const groups: Record<string, CastGroup> = {};
      for (const r of allRes) {
        if (!r.cast_id) continue;
        const castId = r.cast_id;
        const castName = r.casts?.name ?? "未設定";
        if (!groups[castId]) {
          const accessToken = r.casts?.access_token ?? null;
          groups[castId] = { castId, castName, accessToken, reservations: [], totalSales: 0, cashSales: 0, autoBack: 0 };
        }
        // 予約ごとのバック内訳を計算
        const courseBack = findCourseBack(r.course_type, r.course_name, r.duration);
        const optionBacks = (r.options ?? []).map((opt) => ({
          name: opt,
          back: optMap[opt] ?? 0,
        }));
        const optionBackSum = optionBacks.reduce((s, o) => s + o.back, 0);
        // 指名バック（本指名・姫予約など）
        const nominationBack = r.nomination_type ? (nomMap[r.nomination_type] ?? 0) : 0;
        const totalBack = courseBack + optionBackSum + nominationBack;
        r.courseBack = courseBack;
        r.optionBacks = optionBacks;
        r.nominationBack = nominationBack;
        r.nominationType = r.nomination_type;
        r.totalBack = totalBack;

        groups[castId].reservations.push(r);
        // 売上は決済手数料込みの金額で集計
        const totalPrice = (r.price ?? 0) + (r.payment_fee ?? 0);
        groups[castId].totalSales += totalPrice;
        // 現金集計: payment_details がある場合は cash エントリのみ合算
        if (r.payment_details && r.payment_details.length > 0) {
          groups[castId].cashSales += r.payment_details.filter(d => d.method === "cash").reduce((s, d) => s + d.amount, 0);
        } else if (r.payment_method !== "card" && r.payment_method !== "paypay") {
          // 明示的にカード/PayPayのもの以外（null・未入力含む）はデフォルトで現金扱い
          groups[castId].cashSales += totalPrice;
        }
        groups[castId].autoBack += totalBack;
      }

      const groupList = Object.values(groups).sort((a, b) => a.castName.localeCompare(b.castName));
      setCastGroups(groupList);

      const clearMap: Record<string, Clearance> = {};
      for (const c of (clearResult.data as Clearance[]) || []) clearMap[c.cast_id] = c;
      setClearances(clearMap);

      const inputs: Record<string, ClearanceInput> = {};
      for (const g of groupList) {
        const ex = clearMap[g.castId];
        const { deductions, salaryAdditions } = splitClearanceExtraItems(ex?.other_expenses);
        inputs[g.castId] = {
          therapistBack: ex?.therapist_back ?? g.autoBack,
          miscExpenses: ex?.misc_expenses ?? 0,
          accommodationFee: ex?.accommodation_fee ?? 0,
          transportationFee: ex?.transportation_fee ?? 0,
          otherItems: deductions,
          salaryAdjustmentItems: salaryAdditions,
          payoutMethod: ex?.payout_method ?? "",
          submitting: false,
        };
      }
      setClearanceInputs(inputs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const updateInput = (castId: string, field: keyof ClearanceInput, value: any) => {
    setClearanceInputs((prev) => ({ ...prev, [castId]: { ...prev[castId], [field]: value } }));
  };

  const handleDownloadReceipt = (group: CastGroup) => {
    const input = clearanceInputs[group.castId];
    if (!input) return;
    const { salary } = getClearanceAmounts(input);
    const payout = group.totalSales - salary;
    downloadClearanceReceipt({
      date: selectedDate,
      castName: group.castName,
      cashTotal: group.cashSales,
      reservations: group.reservations.map((r) => ({
        start_time: r.start_time,
        customer_name: r.customer_name,
        course_name: r.course_name,
        price: (r.price ?? 0) + (r.payment_fee ?? 0),
        totalBack: r.totalBack ?? 0,
      })),
      totalSales: group.totalSales,
      therapistBack: input.therapistBack,
      miscExpenses: input.miscExpenses,
      accommodationFee: input.accommodationFee,
      transportationFee: input.transportationFee,
      deductionItems: input.otherItems,
      salaryAdjustmentItems: input.salaryAdjustmentItems,
      salary,
      payout,
      payoutMethod: input.payoutMethod,
    });
    toast.success(`${group.castName} の清算明細をダウンロードしました`);
  };

  const handleClear = async (group: CastGroup) => {
    const input = clearanceInputs[group.castId];
    if (!input) return;
    updateInput(group.castId, "submitting", true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    // セラピスト給与 = バック - 雑費 - 宿泊費 + 交通費 - その他控除 + 給与調整
    const { salary } = getClearanceAmounts(input);
    // 投函金額 = 店舗取り分 = 売上 - セラピスト給与
    const payout = group.totalSales - salary;
    try {
      const { error } = await supabase.from("daily_clearances" as any).upsert(
        {
          cast_id: group.castId,
          date: dateStr,
          total_sales: group.totalSales,
          therapist_back: input.therapistBack,
          misc_expenses: input.miscExpenses,
          accommodation_fee: input.accommodationFee,
          transportation_fee: input.transportationFee,
          other_expenses: combineClearanceExtraItems(input.otherItems, input.salaryAdjustmentItems),
          payout_amount: payout,
          payout_method: input.payoutMethod || null,
          status: "pending",
          points_awarded: 0.5,
          cleared_at: new Date().toISOString(),
        },
        { onConflict: "cast_id,date" }
      );
      if (error) throw error;

      if (!clearances[group.castId]) {
        // ポイント加算（RPC が無い/失敗してもエラーで止めない）
        const { error: ptErr } = await supabase.rpc("increment_cast_points" as any, {
          p_cast_id: group.castId,
          p_points: 0.5,
        });
        if (ptErr) console.warn("ポイント加算に失敗:", ptErr.message);
      }

      // 交通費を経費管理テーブルに連携（既存レコード削除→再挿入）
      await supabase
        .from("expenses" as any)
        .delete()
        .eq("cast_id", group.castId)
        .eq("expense_date", dateStr)
        .eq("expense_type", "交通費")
        .ilike("description", "日別清算より%");
      if (input.transportationFee > 0) {
        await supabase.from("expenses" as any).insert({
          expense_date: dateStr,
          expense_type: "交通費",
          amount: input.transportationFee,
          cast_id: group.castId,
          description: `日別清算より（${group.castName}）`,
          payment_method: "現金",
        });
      }

      toast.success(`${group.castName} の清算が完了しました`);
      const { data } = await supabase.from("daily_clearances" as any).select("*").eq("date", dateStr);
      const clearMap: Record<string, Clearance> = {};
      for (const c of (data as Clearance[]) || []) clearMap[c.cast_id] = c;
      setClearances(clearMap);
    } catch (e: any) {
      toast.error(`清算に失敗しました: ${e?.message ?? "不明なエラー"}`);
    } finally {
      updateInput(group.castId, "submitting", false);
    }
  };

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const allCleared = castGroups.length > 0 && castGroups.every((g) => clearances[g.castId]);

  // 当日合計
  const dayTotalSales = castGroups.reduce((s, g) => s + g.totalSales, 0);
  const dayTotalBack = castGroups.reduce((s, g) => s + (clearanceInputs[g.castId]?.therapistBack ?? 0), 0);
  const dayTotalMisc = castGroups.reduce((s, g) => s + (clearanceInputs[g.castId]?.miscExpenses ?? 0), 0);
  const dayTotalAccom = castGroups.reduce((s, g) => s + (clearanceInputs[g.castId]?.accommodationFee ?? 0), 0);
  const dayTotalTransport = castGroups.reduce((s, g) => s + (clearanceInputs[g.castId]?.transportationFee ?? 0), 0);
  const dayTotalOther = castGroups.reduce((s, g) => s + sumClearanceExtraItems(clearanceInputs[g.castId]?.otherItems ?? []), 0);
  const dayTotalSalaryAdjustments = castGroups.reduce(
    (s, g) => s + sumClearanceExtraItems(clearanceInputs[g.castId]?.salaryAdjustmentItems ?? []),
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header with date nav */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">日別清算</h1>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) => subDays(d, 1))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-semibold px-3 w-44 text-center">
                {format(selectedDate, "yyyy年M月d日(E)", { locale: ja })}
                {isToday(selectedDate) && <span className="ml-1 text-xs text-primary">今日</span>}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                disabled={isToday(selectedDate)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          {/* 当日合計サマリー */}
          {!loading && castGroups.length > 0 && (
            <Card className="mb-4">
              <CardContent className="py-3 px-4">
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center">
                  {[
                    { label: "売上", value: dayTotalSales, className: "font-bold" },
                    { label: "報酬", value: dayTotalBack, className: "font-bold text-blue-700" },
                    { label: "雑費", value: dayTotalMisc, className: "font-bold text-orange-600" },
                    { label: "宿泊費", value: dayTotalAccom, className: "font-bold text-orange-600" },
                    { label: "交通費", value: dayTotalTransport, className: "font-bold text-green-700" },
                    { label: "その他", value: dayTotalOther, className: "font-bold text-rose-600" },
                    { label: "給与調整", value: dayTotalSalaryAdjustments, className: "font-bold text-emerald-700" },
                  ].map(({ label, value, className }) => (
                    <div key={label}>
                      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
                      <p className={`text-sm tabular-nums ${className}`}>{yen(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : castGroups.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                この日の予約がありません
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {allCleared && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium">
                  <CheckCircle size={14} className="text-green-600" />
                  全員の清算が完了しています
                </div>
              )}

              {/* ── 集計テーブル ── */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-3 py-2.5 font-semibold text-xs text-muted-foreground">セラピスト</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-xs text-muted-foreground">売上</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-xs text-muted-foreground">給与</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-xs text-muted-foreground">店舗</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-xs text-muted-foreground w-16">状態</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {castGroups.map((g) => {
                          const input = clearanceInputs[g.castId] ?? { therapistBack: 0, miscExpenses: 0, accommodationFee: 0, transportationFee: 0, otherItems: [], salaryAdjustmentItems: [], payoutMethod: "", submitting: false };
                          const cleared = clearances[g.castId];
                          const { salary } = getClearanceAmounts(input);
                          const storeShare = g.totalSales - salary;
                          return (
                            <tr key={g.castId} className="hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-2.5 font-medium">{g.castName}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{yen(g.totalSales)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-blue-700 font-semibold">{yen(salary)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-green-700 font-semibold">{yen(storeShare)}</td>
                              <td className="px-3 py-2.5 text-right">
                                {cleared
                                  ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">済</span>
                                  : <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">未</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30 font-bold">
                          <td className="px-3 py-2.5 text-xs">合計</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                            {yen(castGroups.reduce((s, g) => s + g.totalSales, 0))}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs text-blue-700">
                            {yen(castGroups.reduce((s, g) => {
                              const inp = clearanceInputs[g.castId];
                              if (!inp) return s;
                              return s + getClearanceAmounts(inp).salary;
                            }, 0))}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs text-green-700">
                            {yen(castGroups.reduce((s, g) => {
                              const inp = clearanceInputs[g.castId];
                              const salary = inp ? getClearanceAmounts(inp).salary : 0;
                              return s + g.totalSales - salary;
                            }, 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* ── 個別清算フォーム ── */}
              {castGroups.map((g) => {
                const input = clearanceInputs[g.castId] ?? { therapistBack: 0, miscExpenses: 0, accommodationFee: 0, transportationFee: 0, otherItems: [], salaryAdjustmentItems: [], payoutMethod: "", submitting: false };
                const cleared = clearances[g.castId];
                const { otherTotal, salaryAdjustmentTotal, salary } = getClearanceAmounts(input);
                // 店落ち（店舗取り分）= 売上 - セラピスト給与
                const payout = g.totalSales - salary;
                // 投函する現金 = 現金預かり額 - セラピスト給与（クレカ分は店舗が別途回収）
                const cashPayout = g.cashSales - salary;
                const hasCard = g.cashSales !== g.totalSales;

                return (
                  <Card key={g.castId} className={cleared ? "border-green-200" : "border-primary/20"}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CreditCard size={15} className="text-primary" />
                          {g.castName}
                        </span>
                        {cleared ? (
                          <Badge className="bg-green-100 text-green-700 text-xs border-0">
                            <CheckCircle size={10} className="mr-1" />清算済み
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">未清算</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Reservations */}
                      <div className="border rounded-md divide-y text-sm">
                        {g.reservations.map((r) => (
                          <div key={r.id} className="px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-medium tabular-nums text-xs w-12">{toExtTime(r.start_time)}</span>
                                <span>{r.customer_name}</span>
                                <span className="text-muted-foreground text-xs">{r.course_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  r.status === "completed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                }`}>
                                  {r.status === "completed" ? "完了" : "確定"}
                                </span>
                                <span className="font-semibold tabular-nums text-xs">¥{(r.price + (r.payment_fee ?? 0)).toLocaleString()}</span>
                              </div>
                            </div>
                            {(r.discount ?? 0) > 0 && (
                              <div className="text-[10px] text-rose-500 text-right">
                                割引 −{yen(r.discount ?? 0)}（定価 {yen((r.price ?? 0) + (r.discount ?? 0) + (r.payment_fee ?? 0))}）
                              </div>
                            )}
                            {(r.payment_fee ?? 0) > 0 && (
                              <div className="text-[10px] text-muted-foreground text-right">
                                （内 決済手数料 {yen(r.payment_fee ?? 0)}）
                              </div>
                            )}
                            {/* バック内訳 */}
                            <div className="mt-1 ml-12 space-y-0.5 text-[11px] text-muted-foreground">
                              <div className="flex justify-between">
                                <span>
                                  コースバック（{r.course_name}）
                                  {(r.courseBack ?? 0) === 0 && (
                                    <span className="text-orange-500 ml-1">※バック表未設定</span>
                                  )}
                                </span>
                                <span className="tabular-nums">{yen(r.courseBack ?? 0)}</span>
                              </div>
                              {(r.optionBacks ?? []).map((o, i) => (
                                <div key={i} className="flex justify-between">
                                  <span>
                                    OP: {o.name}
                                    {o.back === 0 && <span className="text-orange-500 ml-1">※未設定</span>}
                                  </span>
                                  <span className="tabular-nums">{yen(o.back)}</span>
                                </div>
                              ))}
                              {(r.nominationBack ?? 0) > 0 && (
                                <div className="flex justify-between">
                                  <span>指名バック（{r.nominationType}）</span>
                                  <span className="tabular-nums">{yen(r.nominationBack ?? 0)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-medium text-foreground/70 border-t border-dashed pt-0.5">
                                <span>バック小計</span>
                                <span className="tabular-nums">{yen(r.totalBack ?? 0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {g.reservations.reduce((s, r) => s + (r.discount ?? 0), 0) > 0 && (
                          <div className="flex justify-between px-3 py-2 text-xs text-rose-600">
                            <span>割引合計</span>
                            <span>−{yen(g.reservations.reduce((s, r) => s + (r.discount ?? 0), 0))}</span>
                          </div>
                        )}
                        <div className="flex justify-between px-3 py-2 bg-muted/30 font-semibold text-sm">
                          <span>売上合計</span>
                          <span>{yen(g.totalSales)}</span>
                        </div>
                        <div className="flex justify-between px-3 py-2 bg-blue-50 font-semibold text-sm text-blue-800">
                          <span>給与バック合計（自動計算）</span>
                          <span className="tabular-nums">{yen(g.autoBack)}</span>
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">給与バック（円）</Label>
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={input.therapistBack === 0 ? "" : input.therapistBack}
                            onChange={(e) => updateInput(g.castId, "therapistBack", Number(e.target.value) || 0)}
                          />
                          {g.autoBack > 0 && input.therapistBack === g.autoBack && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">バック表より自動入力</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">雑費（円）</Label>
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={input.miscExpenses === 0 ? "" : input.miscExpenses}
                            onChange={(e) => updateInput(g.castId, "miscExpenses", Number(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">宿泊費（円）</Label>
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={input.accommodationFee === 0 ? "" : input.accommodationFee}
                            onChange={(e) => updateInput(g.castId, "accommodationFee", Number(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">交通費（円）</Label>
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={input.transportationFee === 0 ? "" : input.transportationFee}
                            onChange={(e) => updateInput(g.castId, "transportationFee", Number(e.target.value) || 0)}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">給与に加算・経費計上</p>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs">その他（給与から控除）</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => updateInput(g.castId, "otherItems", [...input.otherItems, { label: "", amount: 0, kind: "deduction" }])}
                            >
                              <Plus size={12} className="mr-1" />追加
                            </Button>
                          </div>
                          {input.otherItems.length > 0 && (
                            <div className="space-y-1.5">
                              {input.otherItems.map((item, idx) => (
                                <div key={idx} className="flex gap-1.5 items-center">
                                  <Input
                                    className="h-8 text-xs flex-1"
                                    placeholder="項目名"
                                    value={item.label}
                                    onChange={(e) => {
                                      const next = [...input.otherItems];
                                      next[idx] = { ...next[idx], label: e.target.value };
                                      updateInput(g.castId, "otherItems", next);
                                    }}
                                  />
                                  <Input
                                    className="h-8 text-xs w-24"
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={item.amount === 0 ? "" : item.amount}
                                    onChange={(e) => {
                                      const next = [...input.otherItems];
                                      next[idx] = { ...next[idx], amount: Number(e.target.value) || 0 };
                                      updateInput(g.castId, "otherItems", next);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`その他控除 ${idx + 1} を削除`}
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      const next = input.otherItems.filter((_, i) => i !== idx);
                                      updateInput(g.castId, "otherItems", next);
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs text-emerald-900">給与の不足分・追加支給</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                              onClick={() => updateInput(g.castId, "salaryAdjustmentItems", [
                                ...input.salaryAdjustmentItems,
                                { label: "給与不足分", amount: 0, kind: "salary_addition" },
                              ])}
                            >
                              <Plus size={12} className="mr-1" />項目を追加
                            </Button>
                          </div>
                          <p className="text-[10px] text-emerald-800/70 mb-2">前回の不足分など、今回の給与に上乗せする金額を入力します</p>
                          {input.salaryAdjustmentItems.length > 0 && (
                            <div className="space-y-1.5">
                              {input.salaryAdjustmentItems.map((item, idx) => (
                                <div key={idx} className="flex gap-1.5 items-center">
                                  <Input
                                    className="h-8 text-xs flex-1 bg-white"
                                    aria-label={`追加支給項目 ${idx + 1} の項目名`}
                                    placeholder="例：前回給与の不足分"
                                    value={item.label}
                                    onChange={(e) => {
                                      const next = [...input.salaryAdjustmentItems];
                                      next[idx] = { ...next[idx], label: e.target.value };
                                      updateInput(g.castId, "salaryAdjustmentItems", next);
                                    }}
                                  />
                                  <Input
                                    className="h-8 text-xs w-28 bg-white"
                                    aria-label={`追加支給項目 ${idx + 1} の金額`}
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={item.amount === 0 ? "" : item.amount}
                                    onChange={(e) => {
                                      const next = [...input.salaryAdjustmentItems];
                                      next[idx] = { ...next[idx], amount: Number(e.target.value) || 0 };
                                      updateInput(g.castId, "salaryAdjustmentItems", next);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`追加支給項目 ${idx + 1} を削除`}
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => updateInput(
                                      g.castId,
                                      "salaryAdjustmentItems",
                                      input.salaryAdjustmentItems.filter((_, i) => i !== idx)
                                    )}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <div className="w-full p-3 bg-primary/5 rounded-md space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">❶ 現金預かり額{hasCard && <span className="text-orange-500">（うちカード {yen(g.totalSales - g.cashSales)}）</span>}</span>
                              <span className="tabular-nums font-medium">{yen(g.cashSales)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">❷ 店落ち（売上 − 給与）</span>
                              <span className="tabular-nums font-medium">{yen(payout)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t pt-1.5">
                              <span className="text-sm font-bold text-primary">❸ 投函する現金（❶ − 給与）</span>
                              <span className="text-lg font-bold text-primary tabular-nums">{yen(cashPayout)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-right">セラピスト給与 {yen(salary)}</p>
                          </div>
                        </div>
                      </div>

                      {/* 計算内訳 */}
                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">売上合計</span>
                          <span className="tabular-nums">{yen(g.totalSales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            − セラピスト給与（バック {yen(input.therapistBack)} − 雑費 {yen(input.miscExpenses)} − 宿泊費 {yen(input.accommodationFee)}{input.transportationFee > 0 && ` + 交通費 ${yen(input.transportationFee)}`}{otherTotal > 0 && ` − その他 ${yen(otherTotal)}`}{salaryAdjustmentTotal > 0 && ` + 給与調整 ${yen(salaryAdjustmentTotal)}`}）
                          </span>
                          <span className="tabular-nums text-blue-700">{yen(salary)}</span>
                        </div>
                        {salaryAdjustmentTotal > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>給与調整（不足分・追加支給）</span>
                            <span className="tabular-nums">＋{yen(salaryAdjustmentTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold border-t pt-1">
                          <span>＝ 店落ち（店舗取り分）</span>
                          <span className="tabular-nums text-primary">{yen(payout)}</span>
                        </div>
                        {hasCard && (
                          <div className="flex justify-between text-[11px] text-muted-foreground pt-1 mt-1 border-t border-dashed">
                            <span>うち現金で投函する額（現金預かり {yen(g.cashSales)} − 給与 {yen(salary)}）</span>
                            <span className="tabular-nums font-semibold text-primary">{yen(cashPayout)}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs mb-1 block">投函方法・アナウンス</Label>
                        <Textarea
                          value={input.payoutMethod}
                          onChange={(e) => updateInput(g.castId, "payoutMethod", e.target.value)}
                          placeholder="例：〇〇ルームの引き出しに入れています"
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => handleClear(g)}
                          disabled={input.submitting}
                        >
                          {input.submitting ? (
                            <><Loader2 size={14} className="mr-2 animate-spin" />処理中...</>
                          ) : cleared ? (
                            <><CheckCircle size={14} className="mr-2" />再清算（上書き）</>
                          ) : (
                            <><CreditCard size={14} className="mr-2" />{g.castName} を清算する</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDownloadReceipt(g)}
                          title="清算明細をダウンロード（セラピスト送付用）"
                        >
                          <Download size={14} className="mr-2" />明細
                        </Button>
                      </div>

                      {cleared && (
                        <p className="text-xs text-center text-muted-foreground">
                          {format(new Date(cleared.cleared_at!), "M/d HH:mm")} に清算済み · 投函金額 {yen(cleared.payout_amount)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
