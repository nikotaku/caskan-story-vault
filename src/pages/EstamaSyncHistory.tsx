import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, ExternalLink, Image, RefreshCw, XCircle } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Status = "success" | "warning" | "error";

type Evidence = {
  path?: string;
  publicUrl?: string;
  label?: string;
  castName?: string;
  weekStart?: string;
  verified?: boolean;
  capturedAt?: string;
  publicUrlChecked?: string;
  error?: string;
};

type SyncReport = {
  id: string;
  status: Status;
  started_at: string | null;
  finished_at: string;
  total_count: number;
  success_count: number;
  cast_names: string[];
  summary: string;
  results: unknown;
  evidence: unknown;
  missing_profiles: string[];
  fatal_error: string | null;
};

type ShiftJob = {
  id: string;
  job_type: string;
  status: string;
  cast_id: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

const statusView: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  success: {
    label: "正常",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  warning: {
    label: "要確認",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: AlertTriangle,
  },
  error: {
    label: "処理停止",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
};

const readEvidence = (value: unknown): Evidence[] => Array.isArray(value)
  ? value.filter((item): item is Evidence => Boolean(item) && typeof item === "object")
  : [];

type ReportKind = "sync" | "availability" | "appeal";

const reportKind = (value: unknown): ReportKind => {
  const items = Array.isArray(value) ? value : [value];
  if (items.some((item) => (
    item && typeof item === "object" && (item as { kind?: unknown }).kind === "therapist_appeal"
  ))) return "appeal";
  if (items.some((item) => (
    item && typeof item === "object" && (item as { kind?: unknown }).kind === "availability_refresh"
  ))) return "availability";
  return "sync";
};

const shiftJobStatus = (status: string): Status => {
  if (["completed", "success", "succeeded"].includes(status)) return "success";
  if (["failed", "error", "cancelled", "canceled"].includes(status)) return "error";
  return "warning";
};

const shiftJobTitle = (jobType: string) => jobType === "estama_reconcile_shifts"
  ? "シフト突合・同期"
  : "シフト同期";

export default function EstamaSyncHistory() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reports, setReports] = useState<SyncReport[]>([]);
  const [shiftJobs, setShiftJobs] = useState<ShiftJob[]>([]);
  const [castNames, setCastNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/login");
  }, [authLoading, isAdmin, navigate, user]);

  const loadReports = useCallback(async (isRefresh = false) => {
    if (!user || !isAdmin || storeLoading) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError("");

    try {
      const [reportResult, sessionResult] = await Promise.all([
        supabase
          .from("estama_sync_reports")
          .select("id,status,started_at,finished_at,total_count,success_count,cast_names,summary,results,evidence,missing_profiles,fatal_error")
          .eq("store_id", storeId)
          .order("finished_at", { ascending: false })
          .limit(50),
        supabase.auth.getSession(),
      ]);

      if (reportResult.error) throw reportResult.error;
      setReports((reportResult.data ?? []) as SyncReport[]);

      const token = sessionResult.data.session?.access_token;
      if (token) {
        const response = await fetch(`/api/automations/estama?storeId=${encodeURIComponent(storeId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => ({}));
        if (response.ok) {
          const jobs = Array.isArray(body.jobs) ? body.jobs as ShiftJob[] : [];
          const shiftOnly = jobs.filter((job) => ["estama_sync_shift", "estama_reconcile_shifts"].includes(job.job_type));
          setShiftJobs(shiftOnly);

          const ids = [...new Set(shiftOnly.map((job) => job.cast_id).filter((id): id is string => Boolean(id)))];
          if (ids.length > 0) {
            const { data: casts } = await supabase.from("casts").select("id,name").in("id", ids);
            setCastNames(Object.fromEntries((casts ?? []).map((cast) => [cast.id, cast.name])));
          } else {
            setCastNames({});
          }
        } else {
          setShiftJobs([]);
        }
      }
    } catch (error) {
      console.error(error);
      setLoadError("同期履歴を読み込めませんでした。少し待ってから再読み込みしてください。");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, storeId, storeLoading, user]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const latest = reports[0];
  const attentionCount = reports.filter((report) => report.status !== "success").length
    + shiftJobs.filter((job) => shiftJobStatus(job.status) !== "success").length;
  const latestShift = shiftJobs[0];
  const shiftSuccessCount = useMemo(
    () => shiftJobs.filter((job) => shiftJobStatus(job.status) === "success").length,
    [shiftJobs],
  );

  if (authLoading || storeLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[76px] px-4 pb-10 md:ml-[240px] md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">エスたま自動化履歴</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                自動同期、シフト同期、ご案内状況、セラピストアピールの結果をここで確認できます。
              </p>
            </div>
            <Button variant="outline" disabled={refreshing} onClick={() => void loadReports(true)}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              再読み込み
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">最新の結果</p>
                <p className="mt-1 text-lg font-bold">
                  {latest ? statusView[latest.status].label : "履歴なし"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">最新の処理件数</p>
                <p className="mt-1 text-lg font-bold">
                  {latest?.total_count ? `${latest.success_count}/${latest.total_count}件` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">シフト同期</p>
                <p className="mt-1 text-lg font-bold">
                  {shiftJobs.length > 0 ? `${shiftSuccessCount}/${shiftJobs.length}件成功` : "履歴なし"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">要確認</p>
                <p className="mt-1 text-lg font-bold">{attentionCount}件</p>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : loadError ? (
            <Card className="border-rose-200">
              <CardContent className="p-6 text-sm text-rose-700">{loadError}</CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">シフト同期履歴</CardTitle>
                  {latestShift && (
                    <p className="text-xs text-muted-foreground">
                      最終実行 {format(new Date(latestShift.finished_at || latestShift.created_at), "yyyy/M/d HH:mm", { locale: ja })}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {shiftJobs.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">まだシフト同期の履歴はありません。</p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {shiftJobs.map((job) => {
                        const status = shiftJobStatus(job.status);
                        const view = statusView[status];
                        const StatusIcon = view.icon;
                        return (
                          <div key={job.id} className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
                            <div className="min-w-[150px]">
                              <p className="font-medium">{shiftJobTitle(job.job_type)}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(job.finished_at || job.created_at), "yyyy/M/d HH:mm", { locale: ja })}
                              </p>
                            </div>
                            <div className="min-w-[100px] text-muted-foreground">
                              {job.cast_id ? castNames[job.cast_id] || "セラピスト確認中" : "店舗全体"}
                            </div>
                            {job.error_message && (
                              <p className="min-w-[180px] flex-1 text-xs text-rose-600">{job.error_message}</p>
                            )}
                            <Badge variant="outline" className={`ml-auto ${view.className}`}>
                              <StatusIcon className="mr-1 h-3.5 w-3.5" />{view.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {reports.length === 0 ? (
                <Card>
                  <CardContent className="p-10 text-center text-sm text-muted-foreground">
                    通常の自動同期履歴はまだありません。次回の自動同期から、この画面に結果が保存されます。
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => {
                    const view = statusView[report.status];
                    const StatusIcon = view.icon;
                    const evidence = readEvidence(report.evidence);
                    const kind = reportKind(report.results);
                    const title = kind === "appeal"
                      ? "セラピストアピール"
                      : kind === "availability"
                        ? "ご案内状況更新"
                        : "同期";
                    const countLabel = kind === "appeal"
                      ? "アピール"
                      : kind === "availability"
                        ? "更新対象"
                        : "掲載確認";
                    return (
                      <Card key={report.id} className={report.status === "success" ? "" : "border-amber-200"}>
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">
                                {format(new Date(report.finished_at), "yyyy/M/d HH:mm", { locale: ja })}
                                {` の${title}`}
                              </CardTitle>
                              {report.cast_names.length > 0 && (
                                <p className="mt-1 text-sm text-muted-foreground">{report.cast_names.join("、")}</p>
                              )}
                            </div>
                            <Badge variant="outline" className={view.className}>
                              <StatusIcon className="mr-1 h-3.5 w-3.5" />{view.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {report.total_count > 0 && (
                            <p className="text-sm font-medium">
                              {countLabel} {report.success_count}/{report.total_count}件
                            </p>
                          )}
                          <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-6">
                            {report.summary}
                          </p>
                          {report.missing_profiles.length > 0 && (
                            <p className="text-sm text-amber-700">
                              エスたま連携未設定: {report.missing_profiles.join("、")}
                            </p>
                          )}
                          {evidence.length > 0 && (
                            <div>
                              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                                <Image className="h-4 w-4" />公開ページの確認画像
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {evidence.map((item, index) => (
                                  <a
                                    key={`${report.id}-${item.path || index}`}
                                    href={item.publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group overflow-hidden rounded-lg border bg-background"
                                  >
                                    <img
                                      src={item.publicUrl}
                                      alt={item.label || `確認画像 ${index + 1}`}
                                      className="aspect-[4/3] w-full object-cover object-top transition group-hover:opacity-90"
                                      loading="lazy"
                                    />
                                    <div className="flex items-start justify-between gap-2 p-3">
                                      <p className="text-xs leading-5">{item.label || `確認画像 ${index + 1}`}</p>
                                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
