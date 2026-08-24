import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, ExternalLink, Loader2, RefreshCw, ShieldCheck, TimerReset } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { supabase } from "@/integrations/supabase/client";
import { RECRUIT_EXPERIMENT_ID, type RecruitVariant } from "@/lib/recruitExperiment";

interface MetricRow {
  date: string;
  experiment_id: string;
  variant: RecruitVariant;
  exposures: number;
  cta_clicks: number;
}

interface VariantSummary {
  exposures: number;
  clicks: number;
  days: number;
}

const VARIANT_LABELS: Record<RecruitVariant, { short: string; title: string; description: string }> = {
  safety_first: {
    short: "A",
    title: "安心・安全を先に伝える",
    description: "顔出し不要、ノルマなし、個室待機を最初に訴求",
  },
  freedom_first: {
    short: "B",
    title: "自由な働き方を先に伝える",
    description: "週1日、短時間、副業、短期相談を最初に訴求",
  },
};

function clickRate(summary: VariantSummary): number {
  if (summary.exposures === 0) return 0;
  return (summary.clicks / summary.exposures) * 100;
}

function formatRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function RecruitLpAnalytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { store, storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "求人LP A/B分析";
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, navigate, user]);

  const fetchMetrics = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 59);
    const fromDateKey = fromDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("recruit_lp_daily_metrics")
      .select("date,experiment_id,variant,exposures,cta_clicks")
      .eq("store_id", storeId)
      .eq("experiment_id", RECRUIT_EXPERIMENT_ID)
      .gte("date", fromDateKey)
      .order("date", { ascending: false });

    if (error) {
      console.error("求人LPのA/Bデータ取得に失敗しました", error);
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [storeId, storeLoading, user]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const summaries = useMemo(() => {
    const initial: Record<RecruitVariant, VariantSummary> = {
      safety_first: { exposures: 0, clicks: 0, days: 0 },
      freedom_first: { exposures: 0, clicks: 0, days: 0 },
    };
    rows.forEach((row) => {
      if (!initial[row.variant]) return;
      initial[row.variant].exposures += row.exposures;
      initial[row.variant].clicks += row.cta_clicks;
      initial[row.variant].days += 1;
    });
    return initial;
  }, [rows]);

  const dailyRows = useMemo(() => {
    const byDate = new Map<string, Record<RecruitVariant, VariantSummary>>();
    rows.forEach((row) => {
      if (!byDate.has(row.date)) {
        byDate.set(row.date, {
          safety_first: { exposures: 0, clicks: 0, days: 1 },
          freedom_first: { exposures: 0, clicks: 0, days: 1 },
        });
      }
      const target = byDate.get(row.date)![row.variant];
      target.exposures += row.exposures;
      target.clicks += row.cta_clicks;
    });
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const totalExposures = summaries.safety_first.exposures + summaries.freedom_first.exposures;
  const elapsedDays = new Set(rows.map((row) => row.date)).size;
  const isReviewReady = elapsedDays >= 14
    && summaries.safety_first.exposures >= 100
    && summaries.freedom_first.exposures >= 100;
  const publicRecruitUrl = store?.custom_domain
    ? `https://${store.custom_domain}/recruit-talk`
    : "/recruit-talk";
  const previewUrl = (variant: RecruitVariant) => {
    const separator = publicRecruitUrl.includes("?") ? "&" : "?";
    return `${publicRecruitUrl}${separator}recruit_preview=${variant}&recruit_tracking=off`;
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold">
                <BarChart3 size={21} className="text-primary" />
                求人LP A/B分析
                {store?.name && <span className="text-sm font-normal text-muted-foreground">（{store.name}）</span>}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                同じ日にAとBをおおむね50対50で表示し、同じブラウザには同じ案を固定します。
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
                <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} />
                更新
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={previewUrl("safety_first")} target="_blank" rel="noreferrer">
                  Aを確認<ExternalLink size={13} className="ml-1.5" />
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={previewUrl("freedom_first")} target="_blank" rel="noreferrer">
                  Bを確認<ExternalLink size={13} className="ml-1.5" />
                </a>
              </Button>
            </div>
          </div>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">現在の状態</p>
              <p className="mt-1 text-xl font-bold">{isReviewReady ? "集計確認可" : "計測中"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{elapsedDays}日・合計{totalExposures}初回表示</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">一次指標</p>
              <p className="mt-1 text-xl font-bold">LINE相談クリック率</p>
              <p className="mt-1 text-xs text-muted-foreground">初回クリックブラウザ ÷ 初回表示ブラウザ</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">判定の最低条件</p>
              <p className="mt-1 text-xl font-bold">14日＋各100表示</p>
              <p className="mt-1 text-xs text-muted-foreground">勝敗判定ではなく一次観察の目安です</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {(["safety_first", "freedom_first"] as RecruitVariant[]).map((variant) => {
              const label = VARIANT_LABELS[variant];
              const summary = summaries[variant];
              return (
                <article key={variant} className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-primary">VARIANT {label.short}</p>
                      <h2 className="mt-1 text-lg font-bold">{label.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{label.description}</p>
                    </div>
                    {variant === "safety_first" ? <ShieldCheck className="text-primary" /> : <TimerReset className="text-primary" />}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/40 p-3 text-center"><p className="text-[11px] text-muted-foreground">初回表示</p><p className="mt-1 text-xl font-bold">{summary.exposures}</p></div>
                    <div className="rounded-lg bg-muted/40 p-3 text-center"><p className="text-[11px] text-muted-foreground">初回クリック</p><p className="mt-1 text-xl font-bold">{summary.clicks}</p></div>
                    <div className="rounded-lg bg-muted/40 p-3 text-center"><p className="text-[11px] text-muted-foreground">率</p><p className="mt-1 text-xl font-bold">{formatRate(clickRate(summary))}</p></div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 className="font-bold">日別の結果</h2>
            <p className="mt-1 text-xs text-muted-foreground">毎日の偏りを確認できます。初回表示日と初回クリック日が異なる場合があるため、日別率は算出せず、傾向は複数週の累積で確認します。</p>
            {loading ? (
              <div className="py-14 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
            ) : dailyRows.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
                まだ計測データがありません。求人LPへの次回アクセスから自動集計されます。
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60">
                      <th className="px-3 py-2.5 text-left">日付</th>
                      <th className="px-3 py-2.5 text-right">A 初回表示</th>
                      <th className="px-3 py-2.5 text-right">A 初回クリック</th>
                      <th className="px-3 py-2.5 text-right">B 初回表示</th>
                      <th className="px-3 py-2.5 text-right">B 初回クリック</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map(([date, variants]) => (
                      <tr key={date} className="border-b last:border-b-0">
                        <td className="px-3 py-2.5 font-medium">{date}</td>
                        <td className="px-3 py-2.5 text-right">{variants.safety_first.exposures}</td>
                        <td className="px-3 py-2.5 text-right font-bold">{variants.safety_first.clicks}</td>
                        <td className="px-3 py-2.5 text-right">{variants.freedom_first.exposures}</td>
                        <td className="px-3 py-2.5 text-right font-bold">{variants.freedom_first.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            現段階ではLINE相談ボタンの初回押下を一次観察します。これは勝敗判定ではありません。実際の応募、面談、体験入店、初出勤、30日継続は個人情報と分離した別集計として段階的に追加します。
          </section>
        </div>
      </main>
    </div>
  );
}
