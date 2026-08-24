import { useState, useEffect, useMemo } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Save, Plus, Trash2, ChevronDown, GraduationCap, Star,
  CircleCheck, CircleDashed, CircleDot, Loader2, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { driveImgUrl } from "@/lib/drive";
import { format } from "date-fns";

interface Cast {
  id: string;
  name: string;
  photo: string | null;
}

interface Module {
  id: string;
  category: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface TrainingRecord {
  id?: string;
  cast_id: string;
  module_id: string;
  status: "not_started" | "in_progress" | "completed";
  implemented_date: string | null;
  instructor: string | null;
  score: number | null;
  feedback: string | null;
  improvement: string | null;
}

const STATUS_META: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  not_started: { label: "未実施", icon: CircleDashed, color: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  in_progress: { label: "受講中", icon: CircleDot, color: "text-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  completed: { label: "完了", icon: CircleCheck, color: "text-green-600", badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

const emptyRecord = (cast_id: string, module_id: string): TrainingRecord => ({
  cast_id, module_id, status: "not_started",
  implemented_date: null, instructor: null, score: null, feedback: null, improvement: null,
});

export default function Education() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [records, setRecords] = useState<Record<string, TrainingRecord>>({}); // key: module_id (for selected cast)
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [castSort, setCastSort] = useState<"name" | "progressAsc" | "progressDesc">("name");
  const [moduleSort, setModuleSort] = useState<"category" | "status">("category");
  // 全セラピストの受講状況（一覧の進捗率ソート用）key: `${cast_id}:${module_id}`
  const [allStatuses, setAllStatuses] = useState<Record<string, string>>({});
  const [selectedCast, setSelectedCast] = useState<Cast | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [savingModule, setSavingModule] = useState<string | null>(null);

  // Curriculum management
  const [newModule, setNewModule] = useState({ category: "", title: "", description: "" });
  const [addingModule, setAddingModule] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchBase();
  }, [user]);

  const fetchBase = async () => {
    setLoading(true);
    const [castsRes, modulesRes, recordsRes] = await Promise.all([
      supabase.from("casts").select("id,name,photo").eq("is_active", true).order("name"),
      supabase.from("training_modules" as any).select("*").eq("is_active", true).order("display_order"),
      supabase.from("cast_training_records" as any).select("cast_id, module_id, status"),
    ]);
    setCasts((castsRes.data || []) as Cast[]);
    setModules((modulesRes.data || []) as Module[]);
    const statusMap: Record<string, string> = {};
    ((recordsRes.data || []) as any[]).forEach((r) => { statusMap[`${r.cast_id}:${r.module_id}`] = r.status; });
    setAllStatuses(statusMap);
    setLoading(false);
  };

  const selectCast = async (cast: Cast) => {
    setSelectedCast(cast);
    setExpandedModule(null);
    setRecordsLoading(true);
    const { data } = await supabase
      .from("cast_training_records" as any)
      .select("*")
      .eq("cast_id", cast.id);
    const map: Record<string, TrainingRecord> = {};
    (data || []).forEach((r: any) => { map[r.module_id] = r; });
    setRecords(map);
    setRecordsLoading(false);
  };

  const getRecord = (moduleId: string): TrainingRecord =>
    records[moduleId] ?? (selectedCast ? emptyRecord(selectedCast.id, moduleId) : emptyRecord("", moduleId));

  const setRecordField = (moduleId: string, field: keyof TrainingRecord, value: any) => {
    setRecords((prev) => {
      const base = prev[moduleId] ?? (selectedCast ? emptyRecord(selectedCast.id, moduleId) : emptyRecord("", moduleId));
      return { ...prev, [moduleId]: { ...base, [field]: value } };
    });
  };

  const saveRecord = async (moduleId: string, overrides?: Partial<TrainingRecord>) => {
    if (!selectedCast) return;
    setSavingModule(moduleId);
    const current = { ...getRecord(moduleId), ...overrides };
    // auto-set implemented_date when first completed
    if (current.status === "completed" && !current.implemented_date) {
      current.implemented_date = format(new Date(), "yyyy-MM-dd");
    }
    const payload = {
      cast_id: selectedCast.id,
      module_id: moduleId,
      status: current.status,
      implemented_date: current.implemented_date || null,
      instructor: current.instructor || null,
      score: current.score ?? null,
      feedback: current.feedback || null,
      improvement: current.improvement || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("cast_training_records" as any)
      .upsert(payload, { onConflict: "cast_id,module_id" })
      .select()
      .single();
    setSavingModule(null);
    if (error) { toast.error("保存に失敗しました"); return; }
    setRecords((prev) => ({ ...prev, [moduleId]: data as TrainingRecord }));
    setAllStatuses((prev) => ({ ...prev, [`${selectedCast.id}:${moduleId}`]: (data as TrainingRecord).status }));
  };

  const quickSetStatus = (moduleId: string, status: TrainingRecord["status"]) => {
    setRecordField(moduleId, "status", status);
    saveRecord(moduleId, { status });
  };

  const addModule = async () => {
    if (!newModule.title.trim()) { toast.error("項目名を入力してください"); return; }
    setAddingModule(true);
    const maxOrder = Math.max(0, ...modules.map(m => m.display_order));
    const { error } = await supabase.from("training_modules" as any).insert([{
      category: newModule.category.trim() || "一般",
      title: newModule.title.trim(),
      description: newModule.description.trim() || null,
      display_order: maxOrder + 10,
    }]);
    setAddingModule(false);
    if (error) { toast.error("追加に失敗しました"); return; }
    toast.success("カリキュラム項目を追加しました");
    setNewModule({ category: "", title: "", description: "" });
    fetchBase();
  };

  const deleteModule = async (id: string) => {
    if (!confirm("この項目を削除しますか？受講記録も削除されます。")) return;
    const { error } = await supabase.from("training_modules" as any).update({ is_active: false }).eq("id", id);
    if (error) { toast.error("削除に失敗しました"); return; }
    toast.success("削除しました");
    fetchBase();
  };

  // セラピストごとの完了率（一覧ソート・表示用）
  const castProgress = useMemo(() => {
    const map: Record<string, number> = {};
    if (modules.length === 0) return map;
    for (const c of casts) {
      let completed = 0;
      for (const m of modules) {
        if (allStatuses[`${c.id}:${m.id}`] === "completed") completed++;
      }
      map[c.id] = Math.round((completed / modules.length) * 100);
    }
    return map;
  }, [casts, modules, allStatuses]);

  const filtered = useMemo(() => {
    const list = casts.filter((c) => c.name.includes(searchQuery));
    if (castSort === "progressAsc") {
      return [...list].sort((a, b) => (castProgress[a.id] ?? 0) - (castProgress[b.id] ?? 0));
    }
    if (castSort === "progressDesc") {
      return [...list].sort((a, b) => (castProgress[b.id] ?? 0) - (castProgress[a.id] ?? 0));
    }
    return list;
  }, [casts, searchQuery, castSort, castProgress]);

  // grouped modules by category
  const grouped = useMemo(() => {
    const g: Record<string, Module[]> = {};
    for (const m of modules) {
      (g[m.category] ??= []).push(m);
    }
    return g;
  }, [modules]);

  // 受講状況タブの項目グルーピング（カテゴリ別 or 受講状況別）
  const moduleGroups = useMemo(() => {
    if (moduleSort === "category") {
      return Object.entries(grouped).map(([label, mods]) => ({ label, mods }));
    }
    const order: TrainingRecord["status"][] = ["not_started", "in_progress", "completed"];
    return order
      .map((st) => ({
        label: STATUS_META[st].label,
        mods: modules.filter((m) => (records[m.id]?.status ?? "not_started") === st),
      }))
      .filter((g) => g.mods.length > 0);
  }, [moduleSort, grouped, modules, records]);

  // progress for selected cast
  const progress = useMemo(() => {
    const total = modules.length;
    let completed = 0, inProgress = 0;
    for (const m of modules) {
      const st = records[m.id]?.status ?? "not_started";
      if (st === "completed") completed++;
      else if (st === "in_progress") inProgress++;
    }
    const notStarted = total - completed - inProgress;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notStarted, pct };
  }, [modules, records]);

  const notTaught = modules.filter((m) => (records[m.id]?.status ?? "not_started") === "not_started");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center gap-2">
            <GraduationCap className="text-primary" size={24} />
            <div>
              <h1 className="text-2xl font-bold">教育</h1>
              <p className="text-muted-foreground text-sm">セラピストの講習状況・フィードバック・改善項目を管理</p>
            </div>
          </div>

          <Tabs defaultValue="status">
            <TabsList className="mb-4">
              <TabsTrigger value="status">受講状況</TabsTrigger>
              <TabsTrigger value="curriculum">カリキュラム管理</TabsTrigger>
            </TabsList>

            {/* ── 受講状況 ── */}
            <TabsContent value="status">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: cast list */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Search size={16} className="text-muted-foreground" />
                    <Input placeholder="名前で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <div className="flex gap-1.5 mb-3">
                    {([
                      { key: "name", label: "名前順" },
                      { key: "progressAsc", label: "進捗が低い順" },
                      { key: "progressDesc", label: "進捗が高い順" },
                    ] as const).map((s) => (
                      <button key={s.key} onClick={() => setCastSort(s.key)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${castSort === s.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {loading ? (
                    <div className="text-center text-muted-foreground py-4 text-sm">読み込み中...</div>
                  ) : (
                    <div className="space-y-1">
                      {filtered.map((c) => {
                        const pct = castProgress[c.id] ?? 0;
                        const selected = selectedCast?.id === c.id;
                        return (
                          <button key={c.id} onClick={() => selectCast(c)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${selected ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}>
                            {c.photo && (
                              <img src={driveImgUrl(c.photo, 100)} className="w-8 h-8 rounded object-cover object-top shrink-0" />
                            )}
                            <span className="truncate flex-1">{c.name}</span>
                            <span className={`text-xs tabular-nums shrink-0 ${selected ? "text-primary-foreground/80" : pct >= 100 ? "text-green-600" : pct > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {pct}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: training dashboard */}
                <div className="lg:col-span-2">
                  {!selectedCast ? (
                    <Card>
                      <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                        左からセラピストを選択してください
                      </CardContent>
                    </Card>
                  ) : recordsLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="space-y-5">
                      {/* Progress summary */}
                      <Card>
                        <CardContent className="pt-5">
                          <div className="flex items-center gap-3 mb-3">
                            {selectedCast.photo && (
                              <img src={driveImgUrl(selectedCast.photo, 200)} className="w-12 h-12 rounded object-cover object-top" />
                            )}
                            <div className="flex-1">
                              <p className="font-bold text-lg">{selectedCast.name}</p>
                              <p className="text-xs text-muted-foreground">
                                講習進捗 {progress.completed} / {progress.total} 項目完了
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold text-primary tabular-nums">{progress.pct}<span className="text-base">%</span></p>
                            </div>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
                          </div>
                          <div className="flex gap-4 mt-3 text-xs">
                            <span className="flex items-center gap-1 text-green-600"><CircleCheck size={13} />完了 {progress.completed}</span>
                            <span className="flex items-center gap-1 text-amber-500"><CircleDot size={13} />受講中 {progress.inProgress}</span>
                            <span className="flex items-center gap-1 text-muted-foreground"><CircleDashed size={13} />未実施 {progress.notStarted}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* まだ教えていない項目 */}
                      {notTaught.length > 0 && (
                        <Card className="border-amber-300 dark:border-amber-800">
                          <CardContent className="pt-4">
                            <p className="font-semibold text-sm flex items-center gap-1.5 mb-2 text-amber-600">
                              <CircleDashed size={15} />まだ教えていない項目（{notTaught.length}）
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {notTaught.map((m) => (
                                <button key={m.id}
                                  onClick={() => { setExpandedModule(m.id); document.getElementById(`mod-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                                  className="text-xs px-2 py-1 rounded-full border border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                  {m.title}
                                </button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* 表示順切り替え */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground mr-1">表示順：</span>
                        {([
                          { key: "category", label: "カテゴリ別" },
                          { key: "status", label: "受講状況別" },
                        ] as const).map((s) => (
                          <button key={s.key} onClick={() => setModuleSort(s.key)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${moduleSort === s.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"}`}>
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {/* Curriculum grouped by category or status */}
                      {moduleGroups.map(({ label, mods }) => (
                        <div key={label}>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <BookOpen size={13} />{label}
                          </p>
                          <div className="space-y-2">
                            {mods.map((m) => {
                              const rec = getRecord(m.id);
                              const meta = STATUS_META[rec.status];
                              const StatusIcon = meta.icon;
                              const isExpanded = expandedModule === m.id;
                              return (
                                <div key={m.id} id={`mod-${m.id}`} className="rounded-xl border bg-card overflow-hidden">
                                  <button
                                    onClick={() => setExpandedModule(isExpanded ? null : m.id)}
                                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                                  >
                                    <StatusIcon size={18} className={meta.color} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{m.title}</p>
                                      {rec.implemented_date && (
                                        <p className="text-xs text-muted-foreground">実施日：{rec.implemented_date}</p>
                                      )}
                                    </div>
                                    {rec.score ? (
                                      <span className="flex items-center gap-0.5 text-amber-500 text-xs">
                                        <Star size={12} fill="currentColor" />{rec.score}
                                      </span>
                                    ) : null}
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
                                    <ChevronDown size={15} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                  </button>

                                  {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 space-y-3 border-t bg-muted/10">
                                      {m.description && (
                                        <p className="text-xs text-muted-foreground pt-2">{m.description}</p>
                                      )}

                                      {/* Status quick buttons */}
                                      <div className="flex gap-1.5">
                                        {(["not_started", "in_progress", "completed"] as const).map((st) => {
                                          const sm = STATUS_META[st];
                                          const SIcon = sm.icon;
                                          return (
                                            <button key={st}
                                              onClick={() => quickSetStatus(m.id, st)}
                                              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${rec.status === st ? `${sm.badge} border-transparent font-semibold` : "border-border hover:bg-muted/50"}`}>
                                              <SIcon size={13} />{sm.label}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className="text-xs">実施日</Label>
                                          <Input type="date" className="mt-1 h-9 text-sm"
                                            value={rec.implemented_date ?? ""}
                                            onChange={(e) => setRecordField(m.id, "implemented_date", e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs">担当講師</Label>
                                          <Input className="mt-1 h-9 text-sm" placeholder="講師名"
                                            value={rec.instructor ?? ""}
                                            onChange={(e) => setRecordField(m.id, "instructor", e.target.value)} />
                                        </div>
                                      </div>

                                      <div>
                                        <Label className="text-xs">習熟度</Label>
                                        <div className="flex gap-1 mt-1">
                                          {[1, 2, 3, 4, 5].map((n) => (
                                            <button key={n} onClick={() => setRecordField(m.id, "score", rec.score === n ? null : n)}
                                              className="p-0.5">
                                              <Star size={20} className={n <= (rec.score ?? 0) ? "text-amber-400" : "text-muted-foreground/30"}
                                                fill={n <= (rec.score ?? 0) ? "currentColor" : "none"} />
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div>
                                        <Label className="text-xs">フィードバック</Label>
                                        <Textarea className="mt-1 text-sm resize-none" rows={2} placeholder="良かった点・できている点など"
                                          value={rec.feedback ?? ""}
                                          onChange={(e) => setRecordField(m.id, "feedback", e.target.value)} />
                                      </div>
                                      <div>
                                        <Label className="text-xs">改善項目</Label>
                                        <Textarea className="mt-1 text-sm resize-none" rows={2} placeholder="次回までの課題・改善点"
                                          value={rec.improvement ?? ""}
                                          onChange={(e) => setRecordField(m.id, "improvement", e.target.value)} />
                                      </div>

                                      <Button size="sm" onClick={() => saveRecord(m.id)} disabled={savingModule === m.id}>
                                        {savingModule === m.id ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
                                        保存
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── カリキュラム管理 ── */}
            <TabsContent value="curriculum">
              <div className="max-w-3xl space-y-5">
                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <p className="font-semibold text-sm">新規カリキュラム項目を追加</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">カテゴリ</Label>
                        <Input className="mt-1" placeholder="例：施術技術" value={newModule.category}
                          onChange={(e) => setNewModule(f => ({ ...f, category: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">項目名</Label>
                        <Input className="mt-1" placeholder="例：オイルトリートメント基礎" value={newModule.title}
                          onChange={(e) => setNewModule(f => ({ ...f, title: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">説明</Label>
                      <Textarea className="mt-1 resize-none" rows={2} placeholder="講習内容の説明" value={newModule.description}
                        onChange={(e) => setNewModule(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <Button onClick={addModule} disabled={addingModule}>
                      <Plus size={14} className="mr-1.5" />
                      {addingModule ? "追加中..." : "項目を追加"}
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {Object.entries(grouped).map(([category, mods]) => (
                    <div key={category}>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
                      <div className="space-y-2">
                        {mods.map((m) => (
                          <div key={m.id} className="rounded-xl border bg-card px-4 py-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{m.title}</p>
                              {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                            </div>
                            <button onClick={() => deleteModule(m.id)} className="text-muted-foreground hover:text-destructive p-1 shrink-0">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {modules.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">カリキュラム項目がありません</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
