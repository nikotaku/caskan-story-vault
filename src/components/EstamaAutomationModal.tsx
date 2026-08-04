import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, ExternalLink, Loader2, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/useStore";
import { supabase } from "@/integrations/supabase/client";
import { runQueuedEstamaAutomation } from "@/lib/estamaAutomation";
import { useToast } from "@/hooks/use-toast";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };
type Connection = {
  status: "setup_required" | "login_in_progress" | "ready" | "expired" | "error";
  last_verified_at?: string | null;
  last_reconciled_at?: string | null;
  last_error?: string | null;
};
type Job = {
  id: string;
  job_type: string;
  status: string;
  error_message?: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  setup_required: "未設定", login_in_progress: "ログイン待ち", ready: "稼働中",
  expired: "再ログインが必要", error: "エラー",
};
const JOB_LABEL: Record<string, string> = {
  estama_register_cast: "セラピスト登録",
  estama_sync_shift: "シフト同期",
  estama_reconcile_shifts: "日次照合",
};

export function EstamaAutomationModal({ open, onOpenChange }: Props) {
  const { storeId } = useStore();
  const { toast } = useToast();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"setup" | "verify" | "run" | null>(null);

  const authenticatedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("ログインが期限切れです");
    const response = await fetch(url, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "通信に失敗しました");
    return result;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await authenticatedFetch(`/api/automations/estama?storeId=${encodeURIComponent(storeId)}`);
      setConnection(result.connection || null);
      setJobs(result.jobs || []);
    } catch (error) {
      toast({ title: "自動化状態を取得できません", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setLoading(false); }
  }, [authenticatedFetch, storeId, toast]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const setup = async () => {
    const popup = window.open("about:blank", "_blank");
    setAction("setup");
    try {
      const result = await authenticatedFetch("/api/automations/estama", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup", storeId }),
      });
      if (popup) popup.location.href = result.debuggerUrl;
      else window.open(result.debuggerUrl, "_blank", "noopener,noreferrer");
      setConnection(result.connection);
      toast({ title: "エステ魂ログイン画面を開きました", description: "ログイン後、この画面へ戻って「ログイン完了を確認」を押してください" });
    } catch (error) {
      popup?.close();
      toast({ title: "ログイン設定を開始できません", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setAction(null); }
  };

  const verify = async () => {
    setAction("verify");
    try {
      const result = await authenticatedFetch("/api/automations/estama", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", storeId }),
      });
      setConnection(result.connection);
      toast({ title: "エスたま自動化を有効にしました" });
      await load();
    } catch (error) {
      toast({ title: "ログインを確認できません", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setAction(null); }
  };

  const run = async () => {
    setAction("run");
    try {
      const result = await runQueuedEstamaAutomation(storeId);
      const completed = (result.results || []).filter((item) => item.status === "completed").length;
      toast({ title: `${completed}件のエスたま処理を完了しました` });
      await load();
    } catch (error) {
      toast({ title: "自動処理に失敗しました", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setAction(null); }
  };

  const ready = connection?.status === "ready";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />エスたま自動化</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
                  <span className="font-semibold">Browserbase接続</span>
                </div>
                <Badge variant={ready ? "default" : "secondary"}>{STATUS_LABEL[connection?.status || "setup_required"]}</Badge>
              </div>
              {connection?.last_error && <p className="mt-2 text-xs text-destructive">{connection.last_error}</p>}
              <p className="mt-2 text-xs text-muted-foreground">ログイン情報そのものはキャスカンに保存せず、Browserbaseの暗号化されたブラウザ状態だけを利用します。</p>
            </div>

            {!ready && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button onClick={setup} disabled={!!action} variant="outline">
                  {action === "setup" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  エステ魂へログイン
                </Button>
                <Button onClick={verify} disabled={!!action || connection?.status !== "login_in_progress"}>
                  {action === "verify" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  ログイン完了を確認
                </Button>
              </div>
            )}

            {ready && (
              <Button onClick={run} disabled={!!action} className="w-full">
                {action === "run" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                待機中の自動処理を今すぐ実行
              </Button>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">最近の実行</span>
                <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {jobs.length === 0 && <p className="text-xs text-muted-foreground">実行履歴はまだありません。</p>}
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-start justify-between gap-2 rounded border px-3 py-2 text-xs">
                    <div><p className="font-medium">{JOB_LABEL[job.job_type] || job.job_type}</p>{job.error_message && <p className="mt-0.5 text-destructive">{job.error_message}</p>}</div>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
