import {
  enqueueReconcileJobs,
  getAdminClient,
  processAvailableJobs,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = { method?: string; headers?: Record<string, string | string[] | undefined> };
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type SyncReport = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  reconciliationJobs: number;
  processed: number;
  succeeded: number;
  skipped: number;
  retrying: number;
  waitingForLogin: number;
  failed: number;
  remainingQueued: number;
  remainingWaitingForLogin: number;
  errors: string[];
};

type TaskItem = {
  title: string;
  due_date: string | null;
  priority: string;
  store_id: string;
  created_at: string;
};

type TaskReportData = {
  tasks: TaskItem[];
  stores: Array<{ id: string; name: string }>;
  total: number;
  error: string;
};

const supabaseUrl = () =>
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://imrxzkivwrkqbhqfbbes.supabase.co";

const numberValue = (value: unknown) =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;

const formatJst = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value));

const jstDate = () => new Date(Date.now() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);

const dueLabel = (dueDate: string | null) => {
  if (!dueDate) return "期限なし";
  const [, month, day] = dueDate.slice(0, 10).split("-");
  return `${dueDate < jstDate() ? "期限超過" : "期限"} ${Number(month)}/${Number(day)}`;
};

function buildDashboardMessage(report: SyncReport, taskData: TaskReportData) {
  const lines = [
    `${report.ok ? "✅" : "⚠️"} エスたま シフト同期結果`,
    `実行: ${formatJst(report.finishedAt)}（毎日23:00）`,
    "対象: 本日から14日分",
    "",
    `接続店舗: ${numberValue(report.reconciliationJobs)}店舗`,
    `処理: ${numberValue(report.processed)}件`,
    `成功: ${numberValue(report.succeeded)}件`,
    `対象外スキップ: ${numberValue(report.skipped)}件`,
    `自動再試行: ${numberValue(report.retrying)}件`,
    `再ログイン待ち: ${numberValue(report.waitingForLogin)}件`,
    `失敗: ${numberValue(report.failed)}件`,
    `未処理残り: ${numberValue(report.remainingQueued)}件`,
  ];
  if (report.remainingWaitingForLogin > 0) {
    lines.push(`ログイン待ち残り: ${numberValue(report.remainingWaitingForLogin)}件`);
  }

  lines.push("", `📋 未完了タスク（${taskData.total}件）`);
  if (taskData.error) {
    lines.push(`⚠️ タスク取得エラー: ${taskData.error.replace(/\s+/g, " ").slice(0, 180)}`);
  } else if (taskData.total === 0) {
    lines.push("未完了タスクはありません。");
  } else {
    const storeNames = new Map(taskData.stores.map((store) => [store.id, store.name]));
    const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    const sorted = [...taskData.tasks].sort((left, right) =>
      (left.due_date || "9999-12-31").localeCompare(right.due_date || "9999-12-31")
      || (priorityOrder[left.priority] ?? 1) - (priorityOrder[right.priority] ?? 1)
      || left.created_at.localeCompare(right.created_at)
    );
    const byStore = new Map<string, TaskItem[]>();
    sorted.forEach((task) => {
      const storeName = storeNames.get(task.store_id) || "店舗未設定";
      byStore.set(storeName, [...(byStore.get(storeName) || []), task]);
    });
    let shown = 0;
    for (const [storeName, tasks] of byStore) {
      if (shown >= 20) break;
      lines.push(`【${storeName}】`);
      for (const task of tasks) {
        if (shown >= 20) break;
        const mark = task.priority === "high" ? "🔴" : task.priority === "low" ? "△" : "・";
        lines.push(`${mark}${task.title.replace(/\s+/g, " ").slice(0, 120)}（${dueLabel(task.due_date)}）`);
        shown += 1;
      }
    }
    if (taskData.total > shown) lines.push(`ほか ${taskData.total - shown}件（管理画面で確認）`);
  }

  if (report.errors.length) {
    lines.push("", "エラー:");
    report.errors.slice(0, 3).forEach((error) =>
      lines.push(`・${error.replace(/\s+/g, " ").slice(0, 180)}`)
    );
  }
  if (report.remainingQueued > 0) {
    lines.push("", "残りのジョブは次回実行または手動実行で継続します。");
  }
  return lines.join("\n").slice(0, 4_900);
}

async function loadTaskReportData(admin: ReturnType<typeof getAdminClient>): Promise<TaskReportData> {
  const [taskResult, storeResult] = await Promise.all([
    admin
      .from("tasks")
      .select("title,due_date,priority,store_id,created_at", { count: "exact" })
      .eq("is_done", false)
      .limit(100),
    admin.from("stores").select("id,name"),
  ]);
  return {
    tasks: (taskResult.data || []) as TaskItem[],
    stores: (storeResult.data || []) as Array<{ id: string; name: string }>,
    total: taskResult.count || 0,
    error: taskResult.error?.message || storeResult.error?.message || "",
  };
}

const emptyTaskReport = (error = ""): TaskReportData => ({ tasks: [], stores: [], total: 0, error });

async function saveDashboardReport(report: SyncReport, taskData: TaskReportData) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const storeIds = [...new Set(taskData.stores.map((store) => store.id).filter(Boolean))];
  if (!storeIds.length) throw new Error("同期履歴の保存先店舗がありません");

  const saved = [];
  for (const storeId of storeIds) {
    const response = await fetch(`${supabaseUrl()}/functions/v1/notify-estama-shift-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: buildDashboardMessage(report, taskData),
        report: {
          storeId,
          startedAt: report.startedAt,
          finishedAt: report.finishedAt,
          results: [],
          evidence: [],
          fatalError: report.ok ? undefined : report.errors.join(" / ") || "同期処理に要確認項目があります",
        },
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`同期履歴の保存に失敗しました (${response.status}): ${body.slice(0, 500)}`);
    }
    saved.push(body ? JSON.parse(body) : { success: true });
  }
  return saved;
}

async function countShiftJobs(
  admin: ReturnType<typeof getAdminClient>,
  status: "queued" | "waiting_for_login",
) {
  const { count, error } = await admin
    .from("automation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("provider", "estama")
    .eq("job_type", "estama_sync_shift")
    .eq("status", status);
  if (error) throw error;
  return count || 0;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  const header = req.headers?.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  const cronSecret = process.env.CRON_SECRET;
  if (req.method !== "GET" || !cronSecret || authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const startedAt = new Date().toISOString();
  try {
    const admin = getAdminClient();
    const reconciliations = await enqueueReconcileJobs(admin);
    const results = await processAvailableJobs(admin, { limit: 60 });
    const ids = results.map((result) => result.id);
    const { data: processedRows, error: processedError } = ids.length
      ? await admin
        .from("automation_jobs")
        .select("id,job_type,status,result,error_message")
        .in("id", ids)
      : { data: [], error: null };
    if (processedError) throw processedError;

    const shiftRows = (processedRows || []).filter((row) => row.job_type === "estama_sync_shift");
    const skipped = shiftRows.filter((row) =>
      row.status === "completed" && row.result && typeof row.result === "object" && "skipped" in row.result && row.result.skipped === true
    ).length;
    const succeeded = shiftRows.filter((row) => row.status === "completed").length - skipped;
    const retrying = shiftRows.filter((row) => row.status === "queued").length;
    const waitingForLogin = shiftRows.filter((row) => row.status === "waiting_for_login").length;
    const failed = shiftRows.filter((row) => row.status === "failed").length;
    const [remainingQueued, remainingWaitingForLogin] = await Promise.all([
      countShiftJobs(admin, "queued"),
      countShiftJobs(admin, "waiting_for_login"),
    ]);
    const errors = shiftRows
      .map((row) => typeof row.error_message === "string" ? row.error_message : "")
      .filter(Boolean)
      .slice(0, 3);
    const report: SyncReport = {
      ok: failed === 0 && waitingForLogin === 0 && remainingQueued === 0 && remainingWaitingForLogin === 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      reconciliationJobs: reconciliations,
      processed: shiftRows.length,
      succeeded,
      skipped,
      retrying,
      waitingForLogin,
      failed,
      remainingQueued,
      remainingWaitingForLogin,
      errors,
    };
    const taskData = await loadTaskReportData(admin);
    const dashboardReports = await saveDashboardReport(report, taskData);
    res.status(200).json({ ok: true, report, dashboardReports });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let notificationError: string | null = null;
    try {
      let taskData = emptyTaskReport();
      try {
        taskData = await loadTaskReportData(getAdminClient());
      } catch (taskError) {
        taskData = emptyTaskReport(taskError instanceof Error ? taskError.message : String(taskError));
      }
      await saveDashboardReport({
        ok: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        reconciliationJobs: 0,
        processed: 0,
        succeeded: 0,
        skipped: 0,
        retrying: 0,
        waitingForLogin: 0,
        failed: 1,
        remainingQueued: 0,
        remainingWaitingForLogin: 0,
        errors: [message.slice(0, 300)],
      }, taskData);
    } catch (notifyError) {
      notificationError = notifyError instanceof Error ? notifyError.message : String(notifyError);
    }
    res.status(500).json({ error: message, notificationError });
  }
}
