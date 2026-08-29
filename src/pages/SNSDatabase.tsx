import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/email";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, ExternalLink, Globe, Pencil, Trash2, X, Check } from "lucide-react";

interface SNSAccount {
  id: string;
  name: string;
  category: string;
  management_url: string;
  login_id: string;
  login_password: string;
  email: string;
  profile_link: string;
  published_to_hp: boolean;
}

const CATEGORIES = ["SNS", "広告媒体", "求人媒体", "決済", "その他"];

const CATEGORY_COLOR: Record<string, string> = {
  SNS: "bg-blue-100 text-blue-700",
  広告媒体: "bg-purple-100 text-purple-700",
  求人媒体: "bg-orange-100 text-orange-700",
  決済: "bg-green-100 text-green-700",
  その他: "bg-muted text-muted-foreground",
};

const empty = (): Omit<SNSAccount, "id"> => ({
  name: "",
  category: "SNS",
  management_url: "",
  login_id: "",
  login_password: "",
  email: "",
  profile_link: "",
  published_to_hp: false,
});

export default function SNSDatabase() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accounts, setAccounts] = useState<SNSAccount[]>([]);
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
    if (user) fetchAccounts();
  }, [user]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sns_accounts")
      .select("*")
      .order("category")
      .order("name");
    setAccounts(data || []);
    setLoading(false);
  };

  const startEdit = (acc: SNSAccount) => {
    setEditingId(acc.id);
    setForm({ ...acc });
  };

  const startNew = () => {
    setEditingId("new");
    setForm(empty());
  };

  const cancelEdit = () => { setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("名称を入力してください"); return; }
    if (form.email.trim() && !isValidEmail(form.email)) {
      toast.error("メールアドレスの形式が正しくありません（例: example@email.jp）");
      return;
    }
    setSaving(true);
    if (editingId === "new") {
      const { error } = await supabase.from("sns_accounts").insert([form]);
      if (error) { toast.error(error.message); } else { toast.success("追加しました"); }
    } else {
      const { error } = await supabase.from("sns_accounts").update(form).eq("id", editingId);
      if (error) { toast.error(error.message); } else { toast.success("保存しました"); }
    }
    setSaving(false);
    setEditingId(null);
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sns_accounts").delete().eq("id", id);
    if (error) { toast.error("削除失敗"); return; }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success("削除しました");
  };

  const togglePublish = async (acc: SNSAccount) => {
    const next = !acc.published_to_hp;
    const { error } = await supabase
      .from("sns_accounts")
      .update({ published_to_hp: next })
      .eq("id", acc.id);
    if (error) { toast.error("更新失敗"); return; }
    setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, published_to_hp: next } : a));
    toast.success(next ? "HPに公開しました" : "HPから非公開にしました");
  };

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">ナレッジ</p>
              <h1 className="text-2xl font-bold">各種SNSデータ</h1>
            </div>
            <Button onClick={startNew} size="sm">
              <Plus size={14} className="mr-1" />新規追加
            </Button>
          </div>

          {/* New / Edit form */}
          {editingId !== null && (
            <Card className="mb-6 border-primary/40">
              <CardContent className="pt-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">名称</Label>
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例: X (Twitter)" />
                  </div>
                  <div>
                    <Label className="text-xs">カテゴリー</Label>
                    <Select value={form.category} onValueChange={(v) => set("category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">管理画面URL</Label>
                    <Input value={form.management_url} onChange={(e) => set("management_url", e.target.value)} placeholder="https://..." />
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
                    <Label className="text-xs">プロフィールリンク（HP公開用URL）</Label>
                    <Input value={form.profile_link} onChange={(e) => set("profile_link", e.target.value)} placeholder="https://..." />
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
          ) : accounts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">データがありません</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <Card key={acc.id} className={editingId === acc.id ? "opacity-50 pointer-events-none" : ""}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* Category badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLOR[acc.category] || CATEGORY_COLOR["その他"]}`}>
                        {acc.category}
                      </span>

                      {/* Name */}
                      <span className="font-semibold text-sm min-w-[100px]">{acc.name}</span>

                      {/* Email */}
                      {acc.email && (
                        <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[180px]">{acc.email}</span>
                      )}

                      {/* ID */}
                      {acc.login_id && (
                        <span className="text-xs text-muted-foreground hidden lg:block">ID: {acc.login_id}</span>
                      )}

                      <div className="flex items-center gap-2 ml-auto shrink-0">
                        {/* Management URL */}
                        {acc.management_url && (
                          <a href={acc.management_url} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors" title="管理画面を開く">
                            <ExternalLink size={14} />
                          </a>
                        )}

                        {/* Profile link */}
                        {acc.profile_link && (
                          <a href={acc.profile_link} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors" title="プロフィールを開く">
                            <Globe size={14} />
                          </a>
                        )}

                        {/* HP公開トグル */}
                        <button
                          onClick={() => togglePublish(acc)}
                          title={acc.published_to_hp ? "HPから非公開にする" : "HPに公開する"}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                            acc.published_to_hp
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                          }`}
                        >
                          <Globe size={11} />
                          HP公開
                        </button>

                        {/* Edit */}
                        <button onClick={() => startEdit(acc)}
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil size={14} />
                        </button>

                        {/* Delete */}
                        <button onClick={() => handleDelete(acc.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
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
