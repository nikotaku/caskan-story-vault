import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Inbox,
  CalendarRange,
  CalendarCheck,
  CreditCard,
  Wallet,
  Target,
  CalendarClock,
  ReceiptText,
  Megaphone,
  MinusCircle,
  Gift,
  ClipboardList,
} from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface SummaryData {
  monthlySales: number;
  monthlyCount: number;
  pendingCount: number;
}

export default function SalesDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryData>({
    monthlySales: 0,
    monthlyCount: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) fetchSummary();
  }, [user]);

  const fetchSummary = async () => {
    setLoading(true);

    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    const { data } = await supabase
      .from("reservations")
      .select("price, status, reservation_date")
      .gte("reservation_date", monthStart)
      .lte("reservation_date", monthEnd);

    const rows = (data as any[]) ?? [];
    const active = rows.filter((r: any) => r.status !== "cancelled");

    const monthlySales = active.reduce((sum: number, r: any) => sum + (r.price || 0), 0);
    const monthlyCount = active.length;
    const pendingCount = rows.filter((r: any) => r.status === "pending").length;

    setSummary({ monthlySales, monthlyCount, pendingCount });
    setLoading(false);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div>読み込み中...</div></div>;
  }

  const moduleGroups: {
    title: string;
    modules: { href: string; label: string; icon: any; description: string }[];
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
      ],
    },
    {
      title: "経費",
      modules: [
        { href: "/expenses", label: "経費管理", icon: ClipboardList, description: "店舗経費の登録・管理" },
        { href: "/sales/advertising-cost", label: "広告費管理", icon: Megaphone, description: "広告費の管理" },
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

            <Card className={summary.pendingCount > 0 ? "border-amber-400" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">確認待ち件数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${summary.pendingCount > 0 ? "text-amber-500" : ""}`}>
                  {summary.pendingCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">件</p>
              </CardContent>
            </Card>
          </div>

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
