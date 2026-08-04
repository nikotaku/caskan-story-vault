import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronDown, ChevronRight } from "lucide-react";
import { splitClearanceExtraItems, sumClearanceExtraItems } from "@/lib/clearanceExtraItems";

interface TherapistRow {
  castName: string;
  totalSales: number;
  therapistBack: number;
  miscExpenses: number;
  accommodationFee: number;
  transportationFee: number;
  otherExpenses: number;
  salaryAdjustments: number;
  payoutAmount: number;
}

interface DayGroup {
  date: string;
  therapists: TherapistRow[];
}

interface MonthGroup {
  month: string;
  days: DayGroup[];
}

type AmountKey = keyof Omit<TherapistRow, "castName">;

const COLS: { key: AmountKey; label: string; cls: string }[] = [
  { key: "totalSales", label: "売上", cls: "text-foreground font-semibold" },
  { key: "therapistBack", label: "報酬", cls: "text-blue-600" },
  { key: "miscExpenses", label: "雑費", cls: "text-orange-600" },
  { key: "accommodationFee", label: "宿泊費", cls: "text-orange-600" },
  { key: "transportationFee", label: "交通費", cls: "text-green-700" },
  { key: "otherExpenses", label: "その他", cls: "text-rose-600" },
  { key: "salaryAdjustments", label: "追加支給", cls: "text-emerald-700" },
  { key: "payoutAmount", label: "投函額", cls: "text-primary font-semibold" },
];

const yen = (v: number) => `¥${v.toLocaleString()}`;

function totalize(rows: TherapistRow[]): Omit<TherapistRow, "castName"> {
  return rows.reduce(
    (acc, r) => ({
      totalSales: acc.totalSales + r.totalSales,
      therapistBack: acc.therapistBack + r.therapistBack,
      miscExpenses: acc.miscExpenses + r.miscExpenses,
      accommodationFee: acc.accommodationFee + r.accommodationFee,
      transportationFee: acc.transportationFee + r.transportationFee,
      otherExpenses: acc.otherExpenses + r.otherExpenses,
      salaryAdjustments: acc.salaryAdjustments + r.salaryAdjustments,
      payoutAmount: acc.payoutAmount + r.payoutAmount,
    }),
    { totalSales: 0, therapistBack: 0, miscExpenses: 0, accommodationFee: 0, transportationFee: 0, otherExpenses: 0, salaryAdjustments: 0, payoutAmount: 0 }
  );
}

function AmountGrid({ data, bold = false }: { data: Omit<TherapistRow, "castName">; bold?: boolean }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-1 mt-1">
      {COLS.map(({ key, label, cls }) => (
        <div key={key}>
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className={`text-xs tabular-nums ${cls} ${bold ? "font-bold" : ""}`}>{yen(data[key])}</p>
        </div>
      ))}
    </div>
  );
}

export default function SalesMonthlySales() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [groups, setGroups] = useState<MonthGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("daily_clearances")
        .select("date, total_sales, therapist_back, misc_expenses, accommodation_fee, transportation_fee, other_expenses, payout_amount, casts(name)")
        .order("date", { ascending: false });
      if (error) throw error;

      // 月 → 日 → セラピスト にグループ化
      const byMonth: Record<string, Record<string, TherapistRow[]>> = {};
      for (const row of (data || []) as any[]) {
        const month = row.date.slice(0, 7);
        const date = row.date;
        if (!byMonth[month]) byMonth[month] = {};
        if (!byMonth[month][date]) byMonth[month][date] = [];
        const { deductions, salaryAdditions } = splitClearanceExtraItems(row.other_expenses);
        byMonth[month][date].push({
          castName: row.casts?.name ?? "不明",
          totalSales: row.total_sales ?? 0,
          therapistBack: row.therapist_back ?? 0,
          miscExpenses: row.misc_expenses ?? 0,
          accommodationFee: row.accommodation_fee ?? 0,
          transportationFee: row.transportation_fee ?? 0,
          otherExpenses: sumClearanceExtraItems(deductions),
          salaryAdjustments: sumClearanceExtraItems(salaryAdditions),
          payoutAmount: row.payout_amount ?? 0,
        });
      }

      const result: MonthGroup[] = Object.keys(byMonth)
        .sort((a, b) => b.localeCompare(a))
        .map((month) => ({
          month,
          days: Object.keys(byMonth[month])
            .sort((a, b) => b.localeCompare(a))
            .map((date) => ({ date, therapists: byMonth[month][date] })),
        }));

      setGroups(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-5">
            <h1 className="text-2xl font-bold">月別サマリー</h1>
            <p className="text-xs text-muted-foreground mt-1">日別精算データ（月 → 日 → セラピスト）</p>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">読み込み中...</div>
          ) : groups.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">精算データがありません</div>
          ) : (
            <div className="space-y-2">
              {groups.map((mg) => {
                const open = expandedMonths.has(mg.month);
                const allTherapists = mg.days.flatMap((d) => d.therapists);
                const monthTotal = totalize(allTherapists);
                return (
                  <div key={mg.month} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    {/* 月ヘッダー */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleMonth(mg.month)}
                    >
                      <span className="flex items-center gap-2">
                        {open
                          ? <ChevronDown size={15} className="text-muted-foreground flex-shrink-0" />
                          : <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />}
                        <span className="font-bold text-base">
                          {format(parseISO(`${mg.month}-01`), "yyyy年M月", { locale: ja })}
                        </span>
                        <span className="text-xs text-muted-foreground">{mg.days.length}日</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {yen(monthTotal.totalSales)}
                      </span>
                    </button>

                    {/* 展開: 日ごと */}
                    {open && (
                      <div className="border-t">
                        {mg.days.map((dg) => {
                          const dayTotal = totalize(dg.therapists);
                          const dayOpen = expandedDays.has(dg.date);
                          return (
                            <div key={dg.date} className="border-b last:border-b-0">
                              {/* 日付ヘッダー（トグル） */}
                              <button
                                className="w-full px-4 pt-3 pb-2 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
                                onClick={() => toggleDay(dg.date)}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  {dayOpen
                                    ? <ChevronDown size={13} className="text-muted-foreground flex-shrink-0" />
                                    : <ChevronRight size={13} className="text-muted-foreground flex-shrink-0" />}
                                  <span className="text-sm font-semibold text-muted-foreground">
                                    {format(parseISO(dg.date), "M月d日(E)", { locale: ja })}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-1">{dg.therapists.length}名</span>
                                </div>
                                <div className="pl-5">
                                  <AmountGrid data={dayTotal} />
                                </div>
                              </button>

                              {/* セラピストごと（展開時のみ） */}
                              {dayOpen && dg.therapists.map((t, i) => (
                                <div key={i} className="px-4 py-2.5 bg-muted/5 border-t border-border/40">
                                  <p className="text-xs font-medium mb-1">{t.castName}</p>
                                  <AmountGrid data={t} />
                                </div>
                              ))}
                            </div>
                          );
                        })}

                        {/* 月合計 */}
                        <div className="px-4 py-3 bg-muted/20 border-t-2 border-border">
                          <p className="text-xs font-bold text-muted-foreground mb-1">月合計</p>
                          <AmountGrid data={monthTotal} bold />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
