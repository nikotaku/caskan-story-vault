import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Check, Save, Loader2, BookUser, Pencil } from "lucide-react";

interface Bio {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function Bios() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bios, setBios] = useState<Bio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchBios();
  }, [user]);

  const fetchBios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bios" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(`読み込みに失敗しました: ${error.message}`);
    else setBios((data || []) as unknown as Bio[]);
    setLoading(false);
  };

  const startNew = () => {
    setEditingId("new");
    setDraftTitle("");
    setDraftContent("");
  };

  const startEdit = (b: Bio) => {
    setEditingId(b.id);
    setDraftTitle(b.title);
    setDraftContent(b.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftTitle("");
    setDraftContent("");
  };

  const save = async () => {
    const title = draftTitle.trim();
    if (!title) { toast.error("タイトルは必須です"); return; }
    setSaving(true);
    if (editingId === "new") {
      const { data, error } = await supabase
        .from("bios" as any)
        .insert({ title, content: draftContent })
        .select("*")
        .single();
      setSaving(false);
      if (error) { toast.error("保存に失敗しました"); return; }
      setBios((prev) => [data as unknown as Bio, ...prev]);
    } else {
      const { error } = await supabase
        .from("bios" as any)
        .update({ title, content: draftContent, updated_at: new Date().toISOString() })
        .eq("id", editingId);
      setSaving(false);
      if (error) { toast.error("保存に失敗しました"); return; }
      setBios((prev) => prev.map((b) => (b.id === editingId ? { ...b, title, content: draftContent } : b)));
    }
    toast.success("保存しました");
    cancelEdit();
  };

  const remove = async (b: Bio) => {
    if (!confirm(`「${b.title}」を削除しますか？`)) return;
    setBios((prev) => prev.filter((x) => x.id !== b.id));
    const { error } = await supabase.from("bios" as any).delete().eq("id", b.id);
    if (error) { toast.error("削除に失敗しました"); fetchBios(); }
  };

  const copy = async (b: Bio) => {
    try {
      await navigator.clipboard.writeText(b.content);
      setCopiedId(b.id);
      setTimeout(() => setCopiedId((c) => (c === b.id ? null : c)), 1500);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookUser size={22} className="text-primary" />bio保存書
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">アカウントごとのプロフィール文を保存・コピー</p>
            </div>
            {editingId === null && (
              <Button onClick={startNew}><Plus size={16} className="mr-1" />新規</Button>
            )}
          </div>

          {/* 編集フォーム */}
          {editingId !== null && (
            <div className="border rounded-lg bg-card p-3 mb-5 space-y-2">
              <Input
                placeholder="タイトル（例：店長アカウント）"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
              <Textarea
                rows={7}
                placeholder="bio・プロフィール文を入力..."
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cancelEdit}>キャンセル</Button>
                <Button onClick={save} disabled={saving || !draftTitle.trim()}>
                  {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                  保存
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">読み込み中...</div>
          ) : bios.length === 0 && editingId === null ? (
            <div className="text-center py-12 text-muted-foreground">まだ保存されていません</div>
          ) : (
            <div className="space-y-3">
              {bios.map((b) => (
                <div key={b.id} className="border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-sm">{b.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copy(b)}>
                        {copiedId === b.id ? <Check size={13} /> : <Copy size={13} />}
                        <span className="ml-1 text-xs">コピー</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(b)} aria-label="編集">
                        <Pencil size={13} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove(b)} aria-label="削除">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{b.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
