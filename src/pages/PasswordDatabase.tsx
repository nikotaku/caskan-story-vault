import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/email";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, ExternalLink, Pencil, Trash2, X, Check, Copy, KeyRound } from "lucide-react";

interface PasswordEntry {
  id: string;
  name: string;
  category: string;
  url: string | null;
  login_id: string | null;
  login_password: string | null;
  email: string | null;
  notes: string | null;
}

const CATEGORIES = ["業務システム", "金融・決済", "メール", "SNS・媒体", "サーバー・ドメイン", "その他"];

const CATEGORY_COLOR: Record<string, string> = {
  "業務システム": "bg-blue-100 text-blue-700",
  "金融・決済": "bg-green-100 text-green-700",
  "メール": "bg-amber-100 text-amber-700",
  "SNS・媒体": "bg-purple-100 text-purple-700",
  "サーバー・ドメイン": "bg-rose-100 text-rose-700",
  "その他": "bg-muted text-muted-foreground",
};

const empty = (): Omit<PasswordEntry, "id"> => ({
  name: "",
  category: "業務システム",
  url: "",
  login_id: "",
  login_password: "",
  email: "",
  notes: "",
});

export default function PasswordDatabase() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(empty());
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchEntries();
  }, [user]);

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("password_entries")
      .select("*")
      .order("category")
      .order("name");
    setEntries((data || []) as PasswordEntry[]);
    setLoading(false);
  };

  const startEdit = (e: PasswordEntry) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      category: e.category,
      url: e.url || "",
      login_id: e.login_id || "",
      login_password: e.login_password || "",
      email: e.email || "",
      notes: e.notes || "",
    });
  };

  const startNew = () => {
    setEditingId("new");
    setForm(empty());
  };

  const cancelEdit = () => setEditingId(null);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("名称を入力してください"); return; }
    if (form.email.trim() && !isValidEmail(form.email)) {
      toast.error("メールアドレスの形式が正しくありません（例: example@email.jp）");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      url: form.url || null,
      login_id: form.login_id || null,
      login_password: form.login_password || null,
      email: form.email || null,
      notes: form.notes || null,
    };
    if (editingId === "new") {
      const { error } = await supabase.from("password_entries").insert([payload]);
      if (error) { toast.error(error.message); } else { toast.success("追加しました"); }
    } else {
      const { error } = await supabase.from("password_entries").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); } else { toast.success("保存しました"); }
    }
    setSaving(false);
    setEditingId(null);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("password_entries").delete().eq("id", id);
    if (error) { toast.error("削除失敗"); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("削除しました");
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}をコピーしました`);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const categoryOptions = Array.from(new Set([...CATEGORIES, ...entries.map((e) => e.category)])).filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">ナレッジ</p>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <KeyRound size={22} />PW管理
              </h1>
            </div>
            <Button onClick={startNew} size="sm">
              <Plus size={14} className="mr-1" />新規追加
            </Button>
          </div>

          {editingId !== null && (
            <Card className="mb-6 border-primary/40">
              <CardContent className="pt-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">名称</Label>
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例: 予約システム管理画面" />
                  </div>
                  <div>
                    <Label className="text-xs">カテゴリー</Label>
                    <Input
                      list="pw-category-options"
                      value={form.category}
                      onChange={(e) => set("category", e.target.value)}
                      placeholder="自由に入力（例: 業務システム）"
                    />
                    <datalist id="pw-category-options">
                      {categoryOptions.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label className="text-xs">URL</Label>
                    <Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <Label className="text-xs">登録メールアドレス</Label>
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">ID</Label>
                    <Input value={form.login_id} onChange={(e) => set("login_id", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">パスワード</Label>
                    <div className="relative">
                      <Input
                        type={showPw["form"] ? "text" : "password"}
                        value={form.login_password}
                        onChange={(e) => set("login_password", e.target.value)}
                        className="pr-9"
                      />
                      <button type="button" onClick={() => setShowPw((p) => ({ ...p, form: !p["form"] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPw["form"] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">メモ</Label>
                    <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="補足・備考" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    <Check size={13} className="mr-1" />{saving ? "保存中..." : "保存"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    <X size={13} className="mr-1" />キャンセル
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center text-muted-foreground py-12">読み込み中...</div>
          ) : entries.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">データがありません</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <Card key={e.id} className={editingId === e.id ? "opacity-50 pointer-events-none" : ""}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLOR[e.category] || CATEGORY_COLOR["その他"]}`}>
                        {e.category}
                      </span>
                      <span className="font-semibold text-sm min-w-[100px]">{e.name}</span>

                      {e.login_id && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          ID: {e.login_id}
                          <button onClick={() => copy(e.login_id!, "ID")} className="hover:text-foreground" title="IDをコピー">
                            <Copy size={11} />
                          </button>
                        </span>
                      )}

                      {e.login_password && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          PW: {showPw[e.id] ? e.login_password : "••••••••"}
                          <button onClick={() => setShowPw((p) => ({ ...p, [e.id]: !p[e.id] }))} className="hover:text-foreground" title="表示切替">
                            {showPw[e.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                          <button onClick={() => copy(e.login_password!, "パスワード")} className="hover:text-foreground" title="パスワードをコピー">
                            <Copy size={11} />
                          </button>
                        </span>
                      )}

                      <div className="flex items-center gap-2 ml-auto shrink-0">
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors" title="URLを開く">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button onClick={() => startEdit(e)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(e.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {e.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{e.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
