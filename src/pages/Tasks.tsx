import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, Trash2, CheckSquare, Loader2, CalendarDays } from "lucide-react";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  is_done: boolean;
  due_date: string | null;
  priority: "low" | "normal" | "high";
  sort_order: number;
  created_at: string;
}

const PRIORITY_META: Record<Task["priority"], { label: string; cls: string }> = {
  high:   { label: "高", cls: "bg-rose-100 text-rose-700 border-rose-300" },
  normal: { label: "中", cls: "bg-slate-100 text-slate-600 border-slate-300" },
  low:    { label: "低", cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

export default function Tasks() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [dueDate, setDueDate] = useState("");
  const [showDone, setShowDone] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { store: adminStore } = useAdminStore();
  const navigate = useNavigate();
  const storeName = adminStore?.name ?? "店舗";

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // 店舗切替（再ログイン）でRLSが変わるため、adminStore の変化で読み直す
  useEffect(() => {
    if (user) fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, adminStore?.id]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks" as any)
      .select("*")
      .order("is_done", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(`読み込みに失敗しました: ${error.message}`);
    else setTasks((data || []) as unknown as Task[]);
    setLoading(false);
  };

  const addTask = async () => {
    const t = title.trim();
    if (!t) return;
    setAdding(true);
    // store_id は set_store_id トリガーがログイン店舗で自動補完する
    const { data, error } = await supabase
      .from("tasks" as any)
      .insert({ title: t, priority, due_date: dueDate || null })
      .select("*")
      .single();
    setAdding(false);
    if (error) { toast.error("追加に失敗しました"); return; }
    setTasks((prev) => [data as unknown as Task, ...prev]);
    setTitle(""); setPriority("normal"); setDueDate("");
  };

  const toggleDone = async (task: Task) => {
    const next = !task.is_done;
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, is_done: next } : x)));
    const { error } = await supabase
      .from("tasks" as any)
      .update({ is_done: next, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) { toast.error("更新に失敗しました"); fetchTasks(); }
  };

  const removeTask = async (task: Task) => {
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
    const { error } = await supabase.from("tasks" as any).delete().eq("id", task.id);
    if (error) { toast.error("削除に失敗しました"); fetchTasks(); }
  };

  const open = tasks.filter((t) => !t.is_done);
  const done = tasks.filter((t) => t.is_done);

  const row = (task: Task) => (
    <div
      key={task.id}
      className="flex items-center gap-3 border rounded-lg px-3 py-2.5 bg-card"
    >
      <Checkbox checked={task.is_done} onCheckedChange={() => toggleDone(task)} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.is_done ? "line-through text-muted-foreground" : "font-medium"}`}>
          {task.title}
        </p>
        {(task.due_date || task.priority !== "normal") && (
          <div className="flex items-center gap-2 mt-0.5">
            {task.due_date && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays size={11} />
                {format(new Date(task.due_date), "M/d(E)", { locale: ja })}
              </span>
            )}
            {task.priority !== "normal" && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_META[task.priority].cls}`}>
                優先度：{PRIORITY_META[task.priority].label}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={() => removeTask(task)}
        className="text-muted-foreground hover:text-destructive shrink-0"
        aria-label="削除"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-2xl mx-auto">
          <div className="mb-5">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CheckSquare size={22} className="text-primary" />タスクリスト
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{storeName}のタスク管理</p>
          </div>

          {/* 追加フォーム */}
          <div className="border rounded-lg bg-card p-3 mb-5 space-y-2">
            <Input
              placeholder="やることを入力（例：バナー差し替え）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">優先度：高</SelectItem>
                  <SelectItem value="normal">優先度：中</SelectItem>
                  <SelectItem value="low">優先度：低</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-40 h-9"
              />
              <Button onClick={addTask} disabled={adding || !title.trim()} className="ml-auto h-9">
                {adding ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Plus size={14} className="mr-1" />}
                追加
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">読み込み中...</div>
          ) : (
            <>
              {/* 未完了 */}
              <div className="space-y-2">
                {open.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">未完了のタスクはありません 🎉</p>
                ) : (
                  open.map(row)
                )}
              </div>

              {/* 完了 */}
              {done.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowDone((v) => !v)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showDone ? "▲ 完了済みを隠す" : `▼ 完了済み（${done.length}）を表示`}
                  </button>
                  {showDone && <div className="space-y-2 mt-2 opacity-70">{done.map(row)}</div>}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
