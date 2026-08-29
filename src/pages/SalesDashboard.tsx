import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Inbox,
  CalendarRange,
  CalendarCheck,
  CreditCard,
  Wallet,
  Target,
  CalendarClock,
  ReceiptText,
  MinusCircle,
  Gift,
  ClipboardList,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface ReservationSummaryRow {
  price: number | null;
  status: string;
  reservation_date: string;
}

interface SummaryData {
  monthlySales: number;
  monthlyCount: number;
  pendingCount: number;
  averageCustomerSpend: number;
  previousAverageCustomerSpend: number | null;
  averageCustomerSpendChange: number | null;
}

export default function SalesDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryData>({
    monthlySales: 0,
    monthlyCount: 0,
    pendingCount: 0,
    averageCustomerSpend: 0,
    previousAverageCustomerSpend: null,
    averageCustomerSpendChange: null,
  });
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchSummary();
  }, [user]);

  const fetchSummary = async () => {
    setLoading(true);

    const currentMonth = new Date();
    const previousMonth = subMonths(currentMonth, 1);
    const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    const previousMonthStart = format(startOfMonth(previousMonth), "yyyy-MM-dd");
    const previousMonthEnd = format(endOfMonth(previousMonth), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("reservations")
      .select("price, status, reservation_date")
      .gte("reservation_date", previousMonthStart)
      .lte("reservation_date", monthEnd);

    if (error) {
      console.error("売上ダッシュボードの集計取得に失敗しました:", error);
      setLoading(false);
      return;
    }

    const rows = (data || []) as ReservationSummaryRow[];
    const currentRows = rows.filter((row) => row.reservation_date >= monthStart && row.reservation_date <= monthEnd);
    const previousRows = rows.filter((row) => row.reservation_date >= previousMonthStart && row.reservation_date <= previousMonthEnd);
    const active = currentRows.filter((row) => row.status !== "cancelled");
    const previousActive = previousRows.filter((row) => row.status !== "cancelled");

    const monthlySales = active.reduce((sum, row) => sum + (row.price || 0), 0);
    const monthlyCount = active.length;
    const previousSales = previousActive.reduce((sum, row) => sum + (row.price || 0), 0);
    const previousCount = previousActive.length;
    const averageCustomerSpend = monthlyCount > 0 ? Math.round(monthlySales / monthlyCount) : 0;
    const previousAverageCustomerSpend = previousCount > 0 ? Math.round(previousSales / previousCount) : null;
    const averageCustomerSpendChange = previousAverageCustomerSpend && previousAverageCustomerSpend > 0
      ? ((averageCustomerSpend - previousAverageCustomerSpend) / previousAverageCustomerSpend) * 100
      : null;
    const pendingCount = currentRows.filter((row) => row.status === "pending").length;

    setSummary({
      monthlySales,
      monthlyCount,
      pendingCount,
      averageCustomerSpend,
      previousAverageCustomerSpend,
      averageCustomerSpendChange,
    });
    setLoading(false);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div>読み込み中...</div></div>;
  }

  const moduleGroups: {
    title: string;
    modules: { href: string; label: string; icon: LucideIcon; description: string }[];
  }[] = [
    {
      title: "売上",
      modules: [
        { href: "/sales/pending-reports", label: "確認待ちボックス", icon: Inbox, description: "確認待ちの売上報告" },
        { href: "/sales/monthly-sales", label: "月別サマリー", icon: CalendarRange, description: "日別精算の月別集計" },
        { href: "/sales/daily-sales", label: "日別清算", icon: CalendarCheck, description: "日別の清算管理" },
        { href: "/sales/monthly-closing", label: "月別清算", icon: CalendarRange, description: "全店舗合算の月別精算・セラピスト実績" },
        { href: "/sales/card-sales", label: "カード売上", icon: CreditCard, description: "カード決済の売上" },
        { href: "/sales/paypay-sales", label: "PayPay売上", icon: Wallet, description: "PayPay決済の売上" },
        { href: "/sales/monthly-target", label: "月別売上目標", icon: Target, description: "月別の売上目標設定" },
        { href: "/sales/daily-target", label: "日別売上目標", icon: CalendarClock, description: "日別の売上目標設定" },
        { href: "/sales/expense-input", label: "経費入力", icon: ReceiptText, description: "経費の入力" },
        { href: "/sales/price-analysis", label: "単価分析", icon: TrendingUp, description: "サービス別の単価と売上構成" },
      ],
    },
    {
      title: "経費",
      modules: [
        { href: "/expenses", label: "経費管理", icon: ClipboardList, description: "店舗経費の登録・管理" },
        { href: "/sales/deduction-summary", label: "控除集計", icon: MinusCircle, description: "控除の集計" },
        { href: "/sales/referral-fees", label: "紹介報酬管理", icon: Gift, description: "紹介報酬の管理" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">売上管理ダッシュボード</h1>
            <p className="text-sm text-muted-foreground mt-1">売上・経費・レポートの一元管理</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">今月の売上合計</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">¥{summary.monthlySales.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">/ 今月</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">今月の予約件数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{summary.monthlyCount}</p>
                <p className="text-xs text-muted-foreground mt-1">件</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">平均客単価</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">¥{summary.averageCustomerSpend.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">有効予約 {summary.monthlyCount.toLocaleString()}件の平均</p>
              </CardContent>
            </Card>

            <Card className={summary.pendingCount > 0 ? "border-amber-400" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">客単価の前月比</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${summary.averageCustomerSpendChange !== null && summary.averageCustomerSpendChange < 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {summary.averageCustomerSpendChange === null ? "—" : `${summary.averageCustomerSpendChange >= 0 ? "+" : ""}${summary.averageCustomerSpendChange.toFixed(1)}%`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{summary.previousAverageCustomerSpend === null ? "前月の有効予約なし" : `前月 ¥${summary.previousAverageCustomerSpend.toLocaleString()}`}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardContent className="flex items-start gap-3 p-4">
              <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-sm">平均客単価分析</p>
                <p className="mt-0.5 text-sm text-muted-foreground">今月の有効予約あたりの売上を前月と比較しています。詳細ではサービス別の単価と売上構成を確認できます。</p>
              </div>
              <Link to="/sales/price-analysis" className="ml-auto shrink-0"><Button variant="outline" size="sm">詳細を見る</Button></Link>
            </CardContent>
          </Card>

          {/* Pending shortcut */}
          {summary.pendingCount > 0 && (
            <Card className="border-amber-300">
              <CardHeader>
                <CardTitle className="text-base text-amber-600 flex items-center gap-2">
                  <Inbox size={16} />
                  確認待ちの予約があります
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    確認待ち <Badge variant="secondary">{summary.pendingCount}件</Badge>
                  </p>
                  <Link to="/sales/pending-reports">
                    <Button variant="outline" size="sm">確認待ちボックスを開く</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Module Links */}
          <div className="space-y-6">
            {moduleGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-base font-semibold mb-3">{group.title}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {group.modules.map((m) => {
                    const Icon = m.icon;
                    return (
                      <Link key={m.href} to={m.href}>
                        <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
                              <Icon size={18} className="text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{m.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-8 py-4 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-xs text-muted-foreground">© 2025 caskan.jp All rights reserved</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
