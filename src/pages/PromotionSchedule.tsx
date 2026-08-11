import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  Megaphone,
  PackageCheck,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PromotionPlan = Database["public"]["Tables"]["promotion_plans"]["Row"];
type PromotionTask = Database["public"]["Tables"]["promotion_plan_tasks"]["Row"];

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

const formatDate = (value: string | null) => {
  if (!value) return "日付未設定";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${month}/${day}（${DAY_NAMES[date.getDay()]}）`;
};

const formatPeriod = (startsOn: string | null, endsOn: string | null) => {
  if (!startsOn && !endsOn) return "期間未設定";
  if (startsOn === endsOn || !endsOn) return formatDate(startsOn);
  return `${formatDate(startsOn)}〜${formatDate(endsOn)}`;
};

const taskProgress = (tasks: PromotionTask[]) => ({
  completed: tasks.filter((task) => task.is_completed).length,
  total: tasks.length,
});

export default function PromotionSchedule() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  const [tasks, setTasks] = useState<PromotionTask[]>([]);
  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { user, loading: authLoading } = useAuth();
  const { store, storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, navigate, user]);

  const load = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    setErrorMessage("");

    const [plansResult, tasksResult] = await Promise.all([
      supabase
        .from("promotion_plans")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("starts_on", { ascending: false }),
      supabase
        .from("promotion_plan_tasks")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true }),
    ]);

    if (plansResult.error || tasksResult.error) {
      const message = plansResult.error?.message || tasksResult.error?.message || "読み込みに失敗しました";
      setErrorMessage(message);
      toast.error("投稿宣伝スケジュールを読み込めませんでした");
    } else {
      setPlans(plansResult.data || []);
      setTasks(tasksResult.data || []);
    }
    setLoading(false);
  }, [storeId, storeLoading, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const completed = tasks.filter((task) => task.is_completed).length;
    const postingTasks = tasks.filter((task) => task.task_type === "posting");
    return {
      plans: plans.length,
      completed,
      total: tasks.length,
      postingCompleted: postingTasks.filter((task) => task.is_completed).length,
      postingTotal: postingTasks.length,
    };
  }, [plans.length, tasks]);

  const togglePlan = (planId: string) => {
    setExpandedPlanIds((previous) => {
      const next = new Set(previous);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const toggleTask = async (task: PromotionTask, nextValue: boolean) => {
    if (savingTaskIds.has(task.id)) return;
    const changedAt = new Date().toISOString();
    const optimisticTask: PromotionTask = {
      ...task,
      is_completed: nextValue,
      completed_at: nextValue ? changedAt : null,
      completed_by: nextValue ? user?.id || null : null,
      updated_at: changedAt,
    };

    setTasks((previous) => previous.map((item) => item.id === task.id ? optimisticTask : item));
    setSavingTaskIds((previous) => new Set(previous).add(task.id));

    const { error } = await supabase
      .from("promotion_plan_tasks")
      .update({
        is_completed: nextValue,
        completed_at: optimisticTask.completed_at,
        completed_by: optimisticTask.completed_by,
        updated_at: changedAt,
      })
      .eq("id", task.id)
      .eq("store_id", storeId);

    setSavingTaskIds((previous) => {
      const next = new Set(previous);
      next.delete(task.id);
      return next;
    });

    if (error) {
      setTasks((previous) => previous.map((item) => item.id === task.id ? task : item));
      toast.error("チェック状況を保存できませんでした");
      return;
    }

    toast.success(nextValue ? "完了にしました" : "未完了に戻しました");
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((value) => !value)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="overflow-x-hidden p-4 pt-[76px] md:ml-[240px] md:p-6 md:pt-[84px]">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <Megaphone className="text-primary" size={24} />
                投稿宣伝スケジュール
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {store?.name || "店舗"}の撮影準備と、投稿日・投稿先ごとの進捗を管理
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} className={loading ? "mr-1.5 animate-spin" : "mr-1.5"} />
              再読み込み
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><UsersRound size={15} />計画</div>
              <p className="mt-1 text-2xl font-bold">{summary.plans}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={15} />全体完了</div>
              <p className="mt-1 text-2xl font-bold">{summary.completed}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {summary.total}</span></p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Megaphone size={15} />告知完了</div>
              <p className="mt-1 text-2xl font-bold">{summary.postingCompleted}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {summary.postingTotal}</span></p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={15} />残り</div>
              <p className="mt-1 text-2xl font-bold text-amber-600">{Math.max(summary.total - summary.completed, 0)}</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-card py-20 text-center">
              <Loader2 className="inline-block animate-spin text-primary" size={28} />
              <p className="mt-3 text-sm text-muted-foreground">スケジュールを読み込んでいます</p>
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="font-semibold text-destructive">読み込みに失敗しました</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{errorMessage}</p>
              <Button className="mt-4" variant="outline" onClick={() => void load()}>再試行</Button>
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">
              投稿宣伝スケジュールはまだ登録されていません
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => {
                const planTasks = tasks.filter((task) => task.plan_id === plan.id);
                const preparationTasks = planTasks.filter((task) => task.task_type === "preparation");
                const postingTasks = planTasks.filter((task) => task.task_type === "posting");
                const overall = taskProgress(planTasks);
                const preparation = taskProgress(preparationTasks);
                const posting = taskProgress(postingTasks);
                const expanded = expandedPlanIds.has(plan.id);
                const percentage = overall.total ? Math.round((overall.completed / overall.total) * 100) : 0;
                const postingGroups = postingTasks.reduce<Array<{ key: string; date: string | null; label: string; tasks: PromotionTask[] }>>((groups, task) => {
                  const key = `${task.scheduled_on || "none"}:${task.group_label}`;
                  const existing = groups.find((group) => group.key === key);
                  if (existing) existing.tasks.push(task);
                  else groups.push({ key, date: task.scheduled_on, label: task.group_label, tasks: [task] });
                  return groups;
                }, []);

                return (
                  <section key={plan.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <button
                      type="button"
                      className="w-full p-4 text-left transition-colors hover:bg-muted/30 sm:p-5"
                      onClick={() => togglePlan(plan.id)}
                      aria-expanded={expanded}
                      aria-controls={`promotion-plan-${plan.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UsersRound size={21} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold">{plan.therapist_label}</h2>
                            {overall.completed === overall.total && overall.total > 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">すべて完了</Badge>
                            ) : (
                              <Badge variant="secondary">進行中</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm font-medium">{plan.title}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays size={13} />{formatPeriod(plan.starts_on, plan.ends_on)}
                          </p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>全体 {overall.completed}/{overall.total}</span>
                            <span>準備物 {preparation.completed}/{preparation.total}</span>
                            <span>告知 {posting.completed}/{posting.total}</span>
                          </div>
                        </div>
                        {expanded ? <ChevronDown className="mt-2 flex-shrink-0 text-muted-foreground" size={20} /> : <ChevronRight className="mt-2 flex-shrink-0 text-muted-foreground" size={20} />}
                      </div>
                    </button>

                    {expanded && (
                      <div id={`promotion-plan-${plan.id}`} className="space-y-6 border-t bg-muted/10 p-4 sm:p-5">
                        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}

                        <div>
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 font-bold"><PackageCheck size={18} className="text-primary" />準備物</h3>
                            <span className="text-xs font-semibold text-muted-foreground">{preparation.completed}/{preparation.total} 完了</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {preparationTasks.map((task) => (
                              <TaskCheckbox key={task.id} task={task} saving={savingTaskIds.has(task.id)} onChange={toggleTask} />
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 font-bold"><Megaphone size={18} className="text-primary" />告知スケジュール</h3>
                            <span className="text-xs font-semibold text-muted-foreground">{posting.completed}/{posting.total} 完了</span>
                          </div>
                          <div className="space-y-3">
                            {postingGroups.map((group) => {
                              const groupProgress = taskProgress(group.tasks);
                              const done = groupProgress.completed === groupProgress.total;
                              return (
                                <div key={group.key} className="overflow-hidden rounded-xl border bg-background">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/35 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-primary">{formatDate(group.date)}</span>
                                      <span className="text-sm font-semibold">{group.label}</span>
                                    </div>
                                    <Badge variant={done ? "default" : "outline"} className={done ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                                      {done ? "完了" : `${groupProgress.completed}/${groupProgress.total}`}
                                    </Badge>
                                  </div>
                                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                                    {group.tasks.map((task) => (
                                      <TaskCheckbox key={task.id} task={task} saving={savingTaskIds.has(task.id)} onChange={toggleTask} />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TaskCheckbox({
  task,
  saving,
  onChange,
}: {
  task: PromotionTask;
  saving: boolean;
  onChange: (task: PromotionTask, nextValue: boolean) => void;
}) {
  const checkboxId = `promotion-task-${task.id}`;
  return (
    <label
      htmlFor={checkboxId}
      className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        task.is_completed
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
          : "cursor-pointer border-border bg-card hover:border-primary/40 hover:bg-primary/5"
      } ${saving ? "cursor-wait opacity-60" : ""}`}
    >
      <Checkbox
        id={checkboxId}
        checked={task.is_completed}
        disabled={saving}
        onCheckedChange={(checked) => onChange(task, checked === true)}
        aria-label={`${task.label}の完了状態`}
      />
      <span className={task.is_completed ? "font-medium line-through decoration-emerald-400" : "font-medium"}>{task.label}</span>
      {saving && <Loader2 className="ml-auto animate-spin text-muted-foreground" size={14} />}
      {!saving && task.is_completed && <CheckCircle2 className="ml-auto flex-shrink-0 text-emerald-600" size={16} />}
    </label>
  );
}
