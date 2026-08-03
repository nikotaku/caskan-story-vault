import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronDown, Loader2, CheckCircle, AlertCircle, Users, Receipt, Wallet, TrendingUp, Plus, Trash2, Lock, Download, PieChart } from "lucide-react";
import { toast } from "sonner";
import { downloadMonthlyReport } from "@/lib/monthlyClosingReport";
import { splitClearanceExtraItems, sumClearanceExtraItems } from "@/lib/clearanceExtraItems";

/**
 * 月別清算：毎月の締め作業。
 * ・セラピスト報酬（日別精算のバック合計・キャスト別内訳）
 * ・雑費・宿泊費・交通費（日別精算の各費目合計）
 * ・経費（固定費の未払い・未入力チェックリスト）
 * の3トグルで、タップすると内訳が開く。
 */

// 毎月チェックする固定費項目（経費入力の固定費カテゴリと同一）
const FIXED_ITEMS = [
  "賃借料（ラズルーム）",
  "賃借料（インルーム）",
  "広告媒体費（エスたま）",
  "広告媒体費（エスラン）",
  "紹介広告費",
  "ラズルーム電気代",
  "ラズルームガス代",
  "ラズルーム水道代",
  "インルーム電気代",
  "インルーム水道代",
  "固定交際費",
  "通信費",
];

// 変動費（月内に複数回計上しうる。登録ごとに合算されていく）
const VARIABLE_ITEMS = [
  "接待交際費",
  "備品購入費",
  "オイル代",
  "外注費",
  "内部留保",
  "特別損害金",
  "その他",
];
const FIXED_SET = new Set(FIXED_ITEMS);

interface ExpenseRec {
  id: string;
  date: string;
  category: string;
  amount: number;
  is_paid: boolean;
}

interface ClearanceRec {
  cast_name: string;
  total_sales: number;
  therapist_back: number;
  misc_expenses: number;
  accommodation_fee: number;
  transportation_fee: number;
  other_expenses: number;
  salary_adjustments: number;
}

const yen = (v: number) => `¥${v.toLocaleString()}`;

export default function SalesMonthlyClosing() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [records, setRecords] = useState<ExpenseRec[]>([]);
  const [clearances, setClearances] = useState<ClearanceRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["expenses"]));
  // 紹介広告費の推奨額（完了予約 × 紹介ルール単価）
  const [referralSuggested, setReferralSuggested] = useState(0);
  // 変動費の入力
  const [varCategory, setVarCategory] = useState<string>(VARIABLE_ITEMS[0]);
  const [varAmount, setVarAmount] = useState("");
  const [varSaving, setVarSaving] = useState(false);
  const [varUnpaid, setVarUnpaid] = useState(false);
  // 支払方法別・投函合計
  const [pay, setPay] = useState({ cash: 0, card: 0, paypay: 0, cashOnHand: 0 });
  // 締め状態
  const [closing, setClosing] = useState<any>(null);
  const [closingBusy, setClosingBusy] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
    const [expRes, clrRes, castsRes, rewardsRes, resvRes, closeRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("id, expense_date, expense_type, amount, is_paid")
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd),
      supabase
        .from("daily_clearances")
        .select("total_sales, therapist_back, misc_expenses, accommodation_fee, transportation_fee, other_expenses, payout_amount, casts(name)")
        .gte("date", monthStart)
        .lte("date", monthEnd),
      // 紹介広告費の推奨額算出用
      supabase.from("casts").select("id, referral_reward_id").not("referral_reward_id", "is", null),
      supabase.from("referral_rewards").select("id, amount"),
      // 支払方法別＋紹介広告費算出用
      supabase.from("reservations").select("cast_id, status, reservation_date, price, payment_method")
        .gte("reservation_date", monthStart).lte("reservation_date", monthEnd).eq("status", "completed"),
      // 締め状態
      supabase.from("monthly_closings").select("*").eq("month_date", monthStart).maybeSingle(),
    ]);
    setClosing((closeRes as any)?.data ?? null);
    // 支払方法別売上
    const payAgg = { cash: 0, card: 0, paypay: 0, cashOnHand: 0 };
    for (const r of (resvRes.data || []) as any[]) {
      const m = r.payment_method;
      const p = r.price ?? 0;
      if (m === "card") payAgg.card += p;
      else if (m === "paypay") payAgg.paypay += p;
      else payAgg.cash += p; // cash / null は現金扱い
    }
    payAgg.cashOnHand = ((clrRes.data || []) as any[]).reduce((s, r) => s + (r.payout_amount ?? 0), 0);
    setPay(payAgg);
    if (!expRes.error) {
      setRecords((expRes.data || []).map((r: any) => ({
        id: r.id,
        date: r.expense_date,
        category: r.expense_type,
        amount: r.amount,
        is_paid: r.is_paid ?? true,
      })));
    }
    if (!clrRes.error) {
      setClearances((clrRes.data || []).map((r: any) => {
        const { deductions, salaryAdditions } = splitClearanceExtraItems(r.other_expenses);
        return {
          cast_name: r.casts?.name ?? "不明",
          total_sales: r.total_sales ?? 0,
          therapist_back: r.therapist_back ?? 0,
          misc_expenses: r.misc_expenses ?? 0,
          accommodation_fee: r.accommodation_fee ?? 0,
          transportation_fee: r.transportation_fee ?? 0,
          other_expenses: sumClearanceExtraItems(deductions),
          salary_adjustments: sumClearanceExtraItems(salaryAdditions),
        };
      }));
    }
    // 紹介広告費の推奨額 = Σ（紹介ルール紐付きキャストの完了予約数 × 1本単価）
    const rewardAmt = new Map<string, number>();
    for (const r of rewardsRes.data || []) rewardAmt.set(r.id, (r as any).amount ?? 0);
    const castUnit = new Map<string, number>();
    for (const c of castsRes.data || []) {
      const amt = rewardAmt.get((c as any).referral_reward_id);
      if (amt) castUnit.set((c as any).id, amt);
    }
    let refTotal = 0;
    for (const r of resvRes.data || []) {
      const unit = castUnit.get((r as any).cast_id);
      if (unit) refTotal += unit;
    }
    setReferralSuggested(refTotal);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── セラピスト報酬（キャスト別バック合計） ──
  const backByCast = new Map<string, { total: number; days: number }>();
  for (const c of clearances) {
    const cur = backByCast.get(c.cast_name) || { total: 0, days: 0 };
    cur.total += c.therapist_back;
    cur.days += 1;
    backByCast.set(c.cast_name, cur);
  }
  const castRows = [...backByCast.entries()].sort((a, b) => b[1].total - a[1].total);
  const totalBack = clearances.reduce((s, c) => s + c.therapist_back, 0);

  // ── 売上（日別精算の売上合計） ──
  const totalSales = clearances.reduce((s, c) => s + c.total_sales, 0);

  // ── 雑費・宿泊費・交通費 ──
  const totalMisc = clearances.reduce((s, c) => s + c.misc_expenses, 0);
  const totalAccom = clearances.reduce((s, c) => s + c.accommodation_fee, 0);
  const totalTransport = clearances.reduce((s, c) => s + c.transportation_fee, 0);
  const totalOther = clearances.reduce((s, c) => s + c.other_expenses, 0);
  const totalSalaryAdjustments = clearances.reduce((s, c) => s + c.salary_adjustments, 0);
  // 回収＝セラピストのバックから差し引いた諸費（店側のプラス）
  const totalRecovered = totalMisc + totalAccom + totalOther;
  // 実支払給与 = バック − 雑費 − 宿泊費 − その他 ＋ 交通費 ＋ 給与調整（日別精算の給与式と同一）
  const totalSalaryPaid = totalBack - totalRecovered + totalTransport + totalSalaryAdjustments;

  // ── 経費（固定費チェックリスト） ──
  const sumFor = (item: string) =>
    records.filter((r) => r.category === item).reduce((s, r) => s + (r.amount || 0), 0);
  const isEntered = (item: string) => records.some((r) => r.category === item);
  const pendingItems = FIXED_ITEMS.filter((i) => !isEntered(i));
  const doneItems = FIXED_ITEMS.filter((i) => isEntered(i));
  const totalFixed = doneItems.reduce((s, i) => s + sumFor(i), 0);
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());
  const allDone = pendingItems.length === 0;

  // ── 変動費（固定費以外の当月経費。登録ごとに合算） ──
  const variableRecs = records
    .filter((r) => !FIXED_SET.has(r.category))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const totalVariable = variableRecs.reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpenses = totalFixed + totalVariable;
  const totalUnpaid = records.filter((r) => !r.is_paid).reduce((s, r) => s + (r.amount || 0), 0);

  // ── 会計サマリー（利益） ──
  const netProfit = totalSales - totalSalaryPaid - totalExpenses;
  const profitRate = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
  // 実質手元現金 = 投函合計 − 販管費（実際に支払った経費）

  // ── 販管費 費目別内訳 ──
  const EXPENSE_GROUPS: { label: string; cats: string[] }[] = [
    { label: "賃借料", cats: ["賃借料（ラズルーム）", "賃借料（インルーム）"] },
    { label: "広告費", cats: ["広告媒体費（エスたま）", "広告媒体費（エスラン）", "紹介広告費", "広告媒体費（キャスカン）"] },
    { label: "水道光熱費", cats: ["ラズルーム電気代", "ラズルームガス代", "ラズルーム水道代", "インルーム電気代", "インルーム水道代", "水道光熱費（①電気）", "水道光熱費（①水道）", "水道光熱費（①ガス）", "水道光熱費（②電気）", "水道光熱費（②水道）"] },
    { label: "通信費", cats: ["通信費"] },
    { label: "接待交際費", cats: ["固定交際費", "接待交際費"] },
    { label: "備品購入費", cats: ["備品購入費"] },
    { label: "オイル代", cats: ["オイル代"] },
  ];
  const groupedCats = new Set(EXPENSE_GROUPS.flatMap((g) => g.cats));
  const sumCats = (cats: string[]) =>
    records.filter((r) => cats.includes(r.category)).reduce((s, r) => s + (r.amount || 0), 0);
  const expenseBreakdown = EXPENSE_GROUPS
    .map((g) => ({ label: g.label, amount: sumCats(g.cats) }))
    .filter((g) => g.amount > 0);
  const otherExpense = records.filter((r) => !groupedCats.has(r.category)).reduce((s, r) => s + (r.amount || 0), 0);
  if (otherExpense > 0) expenseBreakdown.push({ label: "その他", amount: otherExpense });

  const handleRegister = async (item: string, paid = true) => {
    const raw = (inputs[item] ?? "").trim();
    if (raw === "") {
      toast.error("金額を入力してください（隔月請求などで請求が無い月は 0 を入力）");
      return;
    }
    const amount = Number(raw);
    if (isNaN(amount) || amount < 0) {
      toast.error("金額を正しく入力してください");
      return;
    }
    setSavingItem(item);
    // 登録日は当月なら今日、過去月なら月末
    const date = isCurrentMonth
      ? format(new Date(), "yyyy-MM-dd")
      : format(endOfMonth(selectedMonth), "yyyy-MM-dd");
    const { error } = await supabase.from("expenses").insert([{
      expense_date: date,
      expense_type: item,
      amount,
      description: `${format(selectedMonth, "M月", { locale: ja })}分 ${item}`,
      payment_method: "bank_transfer",
      is_paid: paid,
    }]);
    setSavingItem(null);
    if (error) {
      toast.error(`登録失敗: ${error.message}`);
      return;
    }
    toast.success(paid ? `${item} を登録しました` : `${item} を未払いで記録しました`);
    setInputs((p) => ({ ...p, [item]: "" }));
    fetchData();
  };

  const handleTogglePaid = async (rec: ExpenseRec) => {
    const { error } = await supabase.from("expenses").update({ is_paid: !rec.is_paid }).eq("id", rec.id);
    if (error) { toast.error("更新に失敗しました"); return; }
    setRecords((prev) => prev.map((r) => r.id === rec.id ? { ...r, is_paid: !r.is_paid } : r));
    toast.success(!rec.is_paid ? "支払済みにしました" : "未払いに戻しました");
  };

  const handleAddVariable = async () => {
    const amount = Number(varAmount || 0);
    if (!amount || amount <= 0) {
      toast.error("金額を入力してください");
      return;
    }
    setVarSaving(true);
    const date = isCurrentMonth
      ? format(new Date(), "yyyy-MM-dd")
      : format(endOfMonth(selectedMonth), "yyyy-MM-dd");
    const { error } = await supabase.from("expenses").insert([{
      expense_date: date,
      expense_type: varCategory,
      amount,
      description: `${format(selectedMonth, "M月", { locale: ja })}分 ${varCategory}`,
      payment_method: "cash",
      is_paid: !varUnpaid,
    }]);
    setVarSaving(false);
    if (error) {
      toast.error(`登録失敗: ${error.message}`);
      return;
    }
    toast.success(`${varCategory} ${yen(amount)} を${varUnpaid ? "未払いで記録" : "追加"}しました`);
    setVarAmount("");
    fetchData();
  };

  const handleDeleteVariable = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error("削除に失敗しました");
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    toast.success("削除しました");
  };

  const reportData = () => ({
    month: selectedMonth,
    totalSales, therapistPaid: totalSalaryPaid, expensesTotal: totalExpenses,
    netProfit, profitRate,
    cash: pay.cash, card: pay.card, paypay: pay.paypay, cashOnHand: pay.cashOnHand,
    cashRemaining: pay.cashOnHand - totalExpenses,
    breakdown: expenseBreakdown,
  });

  const handleClose = async () => {
    setClosingBusy(true);
    const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
    const { data, error } = await supabase.from("monthly_closings").upsert({
      month_date: monthStart,
      total_sales: totalSales,
      therapist_paid: totalSalaryPaid,
      expenses_total: totalExpenses,
      net_profit: netProfit,
      cash_sales: pay.cash,
      card_sales: pay.card,
      paypay_sales: pay.paypay,
      cash_on_hand: pay.cashOnHand,
      cash_remaining: pay.cashOnHand - totalExpenses,
      breakdown: expenseBreakdown,
      closed_at: new Date().toISOString(),
    }, { onConflict: "store_id,month_date" }).select().maybeSingle();
    setClosingBusy(false);
    if (error) { toast.error(`締めに失敗しました: ${error.message}`); return; }
    setClosing(data);
    toast.success(`${format(selectedMonth, "M月", { locale: ja })}を締めました（純利益 ${yen(netProfit)}）`);
  };

  const handleReport = () => {
    if (totalSales === 0) { toast.error("この月の精算データがありません"); return; }
    downloadMonthlyReport(reportData());
    toast.success("月次レポートを作成しました");
  };

  const SectionHeader = ({
    id, icon, title, total, sub,
  }: { id: string; icon: React.ReactNode; title: string; total: number; sub?: string }) => (
    <button
      type="button"
      className="w-full px-4 py-3.5 flex items-center gap-3"
      onClick={() => toggleSection(id)}
    >
      <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">{icon}</span>
      <span className="text-left min-w-0 flex-1">
        <span className="font-bold text-sm block">{title}</span>
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <span className="font-bold tabular-nums text-primary">{yen(total)}</span>
      <ChevronDown
        size={16}
        className={`text-muted-foreground shrink-0 transition-transform ${openSections.has(id) ? "rotate-180" : ""}`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">月別清算</h1>
              <p className="text-muted-foreground text-sm">毎月の締め作業：報酬・諸費・固定費のチェック</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth((d) => subMonths(d, 1))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-semibold px-3 w-28 text-center">
                {format(selectedMonth, "yyyy年M月", { locale: ja })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth((d) => addMonths(d, 1))} disabled={isCurrentMonth}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3">

              {/* ── 締め済みバナー ── */}
              {closing && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2 text-sm text-green-800">
                  <CheckCircle size={16} className="text-green-600 shrink-0" />
                  <span>
                    {format(selectedMonth, "M月", { locale: ja })}は締め済みです
                    {closing.closed_at && `（${format(new Date(closing.closed_at), "M/d HH:mm")}）`}。数字を変更した場合は再度「締める」で更新してください。
                  </span>
                </div>
              )}

              {/* ── 会計サマリー（純利益・利益率） ── */}
              <Card className="border-primary/30">
                <div className="px-4 py-3 border-b bg-primary/5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">純利益</span>
                    <span className="tabular-nums font-bold text-xl text-primary">
                      {yen(netProfit)}<span className="text-sm ml-1">（{profitRate.toFixed(1)}%）</span>
                    </span>
                  </div>
                </div>
                <div className="divide-y text-sm">
                  <div className="px-4 py-2 flex justify-between"><span>売上</span><span className="tabular-nums font-semibold">{yen(totalSales)}</span></div>
                  <div className="px-4 py-2 flex justify-between text-muted-foreground"><span>− セラピスト給与（実支払）</span><span className="tabular-nums">{yen(totalSalaryPaid)}</span></div>
                  <div className="px-4 py-2 flex justify-between text-muted-foreground"><span>− 販管費（経費合計）</span><span className="tabular-nums">{yen(totalExpenses)}</span></div>
                </div>
              </Card>

              {/* ── 支払方法別 ── */}
              <Card>
                <div className="px-4 py-2.5 border-b bg-muted/40 font-bold text-xs text-muted-foreground">売上内訳（支払方法別）</div>
                <div className="grid grid-cols-3 divide-x text-center">
                  <div className="py-3"><p className="text-[11px] text-muted-foreground">現金</p><p className="font-bold tabular-nums text-sm mt-0.5">{yen(pay.cash)}</p></div>
                  <div className="py-3"><p className="text-[11px] text-muted-foreground">カード</p><p className="font-bold tabular-nums text-sm mt-0.5">{yen(pay.card)}</p></div>
                  <div className="py-3"><p className="text-[11px] text-muted-foreground">PayPay</p><p className="font-bold tabular-nums text-sm mt-0.5">{yen(pay.paypay)}</p></div>
                </div>
                <div className="px-4 py-2.5 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">手元現金（投函合計）</span>
                  <span className="font-semibold tabular-nums">{yen(pay.cashOnHand)}</span>
                </div>
                <div className="px-4 py-2.5 border-t flex items-center justify-between text-sm bg-primary/5">
                  <span className="font-medium">実質手元現金<span className="text-[11px] text-muted-foreground ml-1">（− 販管費）</span></span>
                  <span className="font-bold tabular-nums text-primary">{yen(pay.cashOnHand - totalExpenses)}</span>
                </div>
              </Card>

              {/* ── 締め・レポート ── */}
              <div className="flex gap-2">
                <Button className="flex-1 h-11" onClick={handleClose} disabled={closingBusy}>
                  {closingBusy ? <Loader2 size={15} className="animate-spin" /> : <><Lock size={15} className="mr-1.5" />{closing ? "再度締める" : "データを締める"}</>}
                </Button>
                <Button variant="outline" className="flex-1 h-11" onClick={handleReport}>
                  <Download size={15} className="mr-1.5" />レポート出力
                </Button>
              </div>

              {/* ── 売上（日別精算ベース） ── */}
              <Card>
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><TrendingUp size={16} /></span>
                  <span className="text-left min-w-0 flex-1">
                    <span className="font-bold text-sm block">売上</span>
                    <span className="text-[11px] text-muted-foreground">日別精算の売上合計（{clearances.length}件）</span>
                  </span>
                  <span className="font-bold tabular-nums text-lg text-primary">{yen(totalSales)}</span>
                </div>
              </Card>

              {/* ── セラピスト報酬 ── */}
              <Card>
                <SectionHeader
                  id="back"
                  icon={<Users size={16} />}
                  title="セラピスト報酬"
                  sub={`バック合計・相殺前（実支払 ${yen(totalSalaryPaid)}）`}
                  total={totalBack}
                />
                {openSections.has("back") && (
                  <CardContent className="p-0 border-t">
                    {castRows.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-8">精算データがありません</p>
                    ) : (
                      <div className="divide-y">
                        {castRows.map(([name, v]) => (
                          <div key={name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <span className="text-sm">
                              {name}
                              <span className="ml-2 text-xs text-muted-foreground">{v.days}日</span>
                            </span>
                            <span className="font-semibold tabular-nums">{yen(v.total)}</span>
                          </div>
                        ))}
                        <div className="px-4 py-3 flex items-center justify-between bg-muted/30 font-bold">
                          <span className="text-sm">バック合計（相殺前）</span>
                          <span className="tabular-nums">{yen(totalBack)}</span>
                        </div>
                        <div className="px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
                          <span>回収（雑費・宿泊費・その他）</span>
                          <span className="tabular-nums">−{yen(totalRecovered)}</span>
                        </div>
                        <div className="px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
                          <span>交通費（追加支給）</span>
                          <span className="tabular-nums">＋{yen(totalTransport)}</span>
                        </div>
                        <div className="px-4 py-2 flex items-center justify-between text-sm text-emerald-700">
                          <span>給与調整（不足分・追加支給）</span>
                          <span className="tabular-nums">＋{yen(totalSalaryAdjustments)}</span>
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between bg-primary/5 font-bold">
                          <span className="text-sm">実際に支払った給与合計</span>
                          <span className="tabular-nums text-primary">{yen(totalSalaryPaid)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* ── 給与の控除・追加支給 ── */}
              <Card>
                <SectionHeader
                  id="allowance"
                  icon={<Wallet size={16} />}
                  title="給与の控除・追加支給"
                  sub={`回収 ${yen(totalRecovered)} ／ 追加支給 ${yen(totalTransport + totalSalaryAdjustments)}`}
                  total={totalRecovered}
                />
                {openSections.has("allowance") && (
                  <CardContent className="p-0 border-t">
                    <div className="divide-y">
                      <div className="px-4 py-2 bg-muted/40 text-xs font-bold text-muted-foreground">
                        回収した諸費（セラピストのバックから差引）
                      </div>
                      {[
                        ["雑費", totalMisc],
                        ["宿泊費", totalAccom],
                        ["その他（清算時入力）", totalOther],
                      ].map(([label, v]) => (
                        <div key={label as string} className="px-4 py-2.5 flex items-center justify-between">
                          <span className="text-sm">{label}</span>
                          <span className="font-semibold tabular-nums">{yen(v as number)}</span>
                        </div>
                      ))}
                      <div className="px-4 py-3 flex items-center justify-between bg-muted/30 font-bold">
                        <span className="text-sm">回収合計</span>
                        <span className="tabular-nums text-green-600">{yen(totalRecovered)}</span>
                      </div>
                      <div className="px-4 py-2 bg-muted/40 text-xs font-bold text-muted-foreground">
                        店から支払った費用
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between font-bold">
                        <span className="text-sm">交通費 合計</span>
                        <span className="tabular-nums text-rose-600">{yen(totalTransport)}</span>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between font-bold">
                        <span className="text-sm">給与調整（不足分など）合計</span>
                        <span className="tabular-nums text-emerald-700">{yen(totalSalaryAdjustments)}</span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* ── 経費（固定費チェックリスト） ── */}
              <Card className={pendingItems.length > 0 ? "border-amber-300" : ""}>
                <SectionHeader
                  id="expenses"
                  icon={<Receipt size={16} />}
                  title="経費"
                  sub={`固定費 ${yen(totalFixed)}${totalVariable > 0 ? ` ／ 変動費 ${yen(totalVariable)}` : ""}${allDone ? "" : `（固定費 未入力${pendingItems.length}件）`}`}
                  total={totalExpenses}
                />
                {openSections.has("expenses") && (
                  <CardContent className="p-3 border-t space-y-3">
                    {/* 進捗サマリー */}
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium ${
                      allDone
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}>
                      {allDone ? <CheckCircle size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-amber-600" />}
                      {allDone
                        ? `${format(selectedMonth, "M月", { locale: ja })}の固定費はすべて入力済みです（合計 ${yen(totalFixed)}）`
                        : `未入力・未払いが ${pendingItems.length}件 あります（入力済み ${doneItems.length}/${FIXED_ITEMS.length}件）`}
                    </div>

                    {/* 未入力・未払い一覧 */}
                    {pendingItems.length > 0 && (
                      <div className="rounded-lg border border-amber-300 overflow-hidden">
                        <div className="px-4 py-2.5 bg-amber-100 font-bold text-sm text-amber-800">
                          未入力・未払い（{pendingItems.length}件）
                        </div>
                        <div className="divide-y">
                          {pendingItems.map((item) => {
                            const showSuggest = item === "紹介広告費" && referralSuggested > 0;
                            return (
                            <div key={item} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                              <div className="flex-1 min-w-[160px]">
                                <span className="text-sm font-medium">{item}</span>
                                {showSuggest && (
                                  <button
                                    type="button"
                                    className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                                    onClick={() => setInputs((p) => ({ ...p, [item]: String(referralSuggested) }))}
                                    title="タップで金額欄にセット"
                                  >
                                    推奨 {yen(referralSuggested)}（完了予約から自動計算）
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  placeholder={showSuggest ? String(referralSuggested) : "金額"}
                                  className="w-32 h-9 text-sm"
                                  value={inputs[item] ?? ""}
                                  onChange={(e) => setInputs((p) => ({ ...p, [item]: e.target.value }))}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-2 text-xs"
                                  disabled={savingItem === item || (inputs[item] ?? "").trim() === ""}
                                  onClick={() => handleRegister(item, false)}
                                  title="支払い前でも金額だけ記録"
                                >
                                  未払いで記録
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-9"
                                  disabled={savingItem === item || (inputs[item] ?? "").trim() === ""}
                                  onClick={() => handleRegister(item, true)}
                                >
                                  {savingItem === item ? <Loader2 size={13} className="animate-spin" /> : "支払・登録"}
                                </Button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 入力済み一覧 */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-4 py-2.5 bg-muted/40 font-bold text-sm text-muted-foreground">
                        入力済み（{doneItems.length}件）
                      </div>
                      {doneItems.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">まだ入力がありません</p>
                      ) : (
                        <div className="divide-y">
                          {doneItems.map((item) => {
                            const rec = records.find((r) => r.category === item);
                            const unpaid = !!rec && !rec.is_paid;
                            return (
                            <div key={item} className="px-4 py-3 flex items-center justify-between gap-3">
                              <span className="text-sm flex items-center gap-2 min-w-0">
                                {unpaid
                                  ? <AlertCircle size={14} className="text-amber-500 shrink-0" />
                                  : <CheckCircle size={14} className="text-green-600 shrink-0" />}
                                <span className="truncate">{item}</span>
                                {unpaid && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">未払い</span>}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className="font-bold tabular-nums">{yen(sumFor(item))}</span>
                                {rec && (
                                  <button
                                    className="text-[11px] px-2 py-0.5 rounded border border-muted-foreground/30 text-muted-foreground hover:bg-muted transition-colors"
                                    onClick={() => handleTogglePaid(rec)}
                                    title={unpaid ? "支払済みにする" : "未払いに戻す"}
                                  >
                                    {unpaid ? "支払済みに" : "未払いに"}
                                  </button>
                                )}
                              </span>
                            </div>
                            );
                          })}
                          <div className="px-4 py-3 flex items-center justify-between bg-muted/30 font-bold">
                            <span className="text-sm">固定費 合計</span>
                            <span className="tabular-nums text-primary">{yen(totalFixed)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 変動費（登録ごとに合算） */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-4 py-2.5 bg-muted/40 font-bold text-sm text-muted-foreground">
                        変動費（都度計上・登録ごとに合算）
                      </div>
                      {/* 入力行 */}
                      <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b">
                        <Select value={varCategory} onValueChange={setVarCategory}>
                          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {VARIABLE_ITEMS.map((v) => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder="金額"
                          className="w-28 h-9 text-sm"
                          value={varAmount}
                          onChange={(e) => setVarAmount(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddVariable()}
                        />
                        <Button
                          size="sm"
                          className="h-9"
                          disabled={varSaving || !Number(varAmount || 0)}
                          onClick={handleAddVariable}
                        >
                          {varSaving ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={14} className="mr-1" />追加</>}
                        </Button>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-1 select-none">
                          <input type="checkbox" checked={varUnpaid} onChange={(e) => setVarUnpaid(e.target.checked)} className="accent-amber-500" />
                          未払いで記録
                        </label>
                      </div>
                      {/* 登録済み一覧 */}
                      {variableRecs.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-6">まだ登録がありません</p>
                      ) : (
                        <div className="divide-y">
                          {variableRecs.map((r) => (
                            <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <span className="text-sm min-w-0 flex items-center gap-2">
                                <span className="truncate">{r.category}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{format(new Date(r.date), "M/d", { locale: ja })}</span>
                                {!r.is_paid && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">未払い</span>}
                              </span>
                              <span className="flex items-center gap-2.5 shrink-0">
                                <button
                                  className="text-[11px] px-2 py-0.5 rounded border border-muted-foreground/30 text-muted-foreground hover:bg-muted transition-colors"
                                  onClick={() => handleTogglePaid(r)}
                                  title={!r.is_paid ? "支払済みにする" : "未払いに戻す"}
                                >
                                  {!r.is_paid ? "支払済みに" : "未払いに"}
                                </button>
                                <span className="font-semibold tabular-nums">{yen(r.amount)}</span>
                                <button
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => handleDeleteVariable(r.id)}
                                  title="削除"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </span>
                            </div>
                          ))}
                          <div className="px-4 py-3 flex items-center justify-between bg-muted/30 font-bold">
                            <span className="text-sm">変動費 合計</span>
                            <span className="tabular-nums text-primary">{yen(totalVariable)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 経費合計 */}
                    <div className="rounded-lg bg-primary/5 px-4 py-3 font-bold">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">経費 合計（固定費＋変動費）</span>
                        <span className="tabular-nums text-primary text-lg">{yen(totalExpenses)}</span>
                      </div>
                      {totalUnpaid > 0 && (
                        <div className="flex items-center justify-between mt-1 text-xs font-normal text-amber-700">
                          <span>うち未払い</span>
                          <span className="tabular-nums font-semibold">{yen(totalUnpaid)}</span>
                        </div>
                      )}
                    </div>

                    {/* 費目別内訳 */}
                    {expenseBreakdown.length > 0 && (
                      <div className="rounded-lg border overflow-hidden">
                        <div className="px-4 py-2.5 bg-muted/40 font-bold text-sm text-muted-foreground flex items-center gap-1.5">
                          <PieChart size={14} />販管費 費目別内訳
                        </div>
                        <div className="divide-y">
                          {expenseBreakdown.map((b) => (
                            <div key={b.label} className="px-4 py-2 flex items-center justify-between text-sm">
                              <span>{b.label}</span>
                              <span className="font-semibold tabular-nums">{yen(b.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      ※ 支払い前でも金額だけ先に記録したい場合は「未払いで記録」（変動費は「未払いで記録」にチェックして追加）。あとで「支払済みに」で切り替えられます。金額は集計に含まれます。
                    </p>
                  </CardContent>
                )}
              </Card>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
