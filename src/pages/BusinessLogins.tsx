import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/email";

interface Login {
  id: string;
  service_name: string;
  category: string | null;
  login_url: string | null;
  login_id: string | null;
  password: string | null;
  registered_email: string | null;
  two_factor_method: string | null;
  contact_person: string | null;
  notes: string | null;
  vendor_id: string | null;
  bank_account_id: string | null;
  created_at: string;
}

interface Vendor { id: string; name: string; }
interface BankAccount { id: string; account_name: string; }

const CATEGORIES = ["SNS", "求人媒体", "集客媒体", "決済サービス", "サーバー", "ドメイン", "Google関連", "AIツール", "その他"];

const emptyForm = {
  service_name: "",
  category: "",
  login_url: "",
  login_id: "",
  password: "",
  registered_email: "",
  two_factor_method: "",
  contact_person: "",
  notes: "",
  vendor_id: "",
  bank_account_id: "",
};

export default function BusinessLogins() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logins, setLogins] = useState<Login[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [showFormPassword, setShowFormPassword] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      fetchLogins();
      fetchVendors();
      fetchBankAccounts();
    }
  }, [user]);

  const fetchLogins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_logins" as any)
      .select("*")
      .order("service_name");
    if (!error && data) setLogins(data as any);
    setLoading(false);
  };

  const fetchVendors = async () => {
    const { data } = await supabase.from("business_vendors" as any).select("id, name").order("name");
    if (data) setVendors(data as any);
  };

  const fetchBankAccounts = async () => {
    const { data } = await supabase.from("business_bank_accounts" as any).select("id, account_name").order("account_name");
    if (data) setBankAccounts(data as any);
  };

  const togglePasswordVisible = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowFormPassword(false);
    setIsDialogOpen(true);
  };

  const openEdit = (l: Login) => {
    setEditingId(l.id);
    setForm({
      service_name: l.service_name,
      category: l.category || "",
      login_url: l.login_url || "",
      login_id: l.login_id || "",
      password: l.password || "",
      registered_email: l.registered_email || "",
      two_factor_method: l.two_factor_method || "",
      contact_person: l.contact_person || "",
      notes: l.notes || "",
      vendor_id: l.vendor_id || "",
      bank_account_id: l.bank_account_id || "",
    });
    setShowFormPassword(false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.service_name.trim()) {
      toast({ title: "エラー", description: "サービス名を入力してください", variant: "destructive" });
      return;
    }
    if (form.registered_email.trim() && !isValidEmail(form.registered_email)) {
      toast({ title: "エラー", description: "登録メールアドレスの形式が正しくありません（例: example@email.jp）", variant: "destructive" });
      return;
    }
    const payload = {
      service_name: form.service_name.trim(),
      category: form.category || null,
      login_url: form.login_url || null,
      login_id: form.login_id || null,
      password: form.password || null,
      registered_email: form.registered_email || null,
      two_factor_method: form.two_factor_method || null,
      contact_person: form.contact_person || null,
      notes: form.notes || null,
      vendor_id: form.vendor_id || null,
      bank_account_id: form.bank_account_id || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("business_logins" as any).update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("business_logins" as any).insert([payload]));
    }

    if (error) {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "更新完了" : "追加完了", description: `ログイン情報を${editingId ? "更新" : "追加"}しました` });
    setIsDialogOpen(false);
    fetchLogins();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("business_logins" as any).delete().eq("id", id);
    if (!error) {
      toast({ title: "削除完了", description: "ログイン情報を削除しました" });
      fetchLogins();
    }
  };

  const filtered = logins.filter((l) => {
    const matchSearch = !searchTerm ||
      l.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.login_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory === "all" || l.category === filterCategory;
    return matchSearch && matchCategory;
  });

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div>読み込み中...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">ログイン情報</h1>
              <p className="text-sm text-muted-foreground">各サービスのID・パスワード管理</p>
            </div>
            <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" />追加</Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="サービス名・ログインID・担当者で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全カテゴリ</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium">サービス名</th>
                      <th className="text-left px-4 py-3 font-medium">カテゴリ</th>
                      <th className="text-left px-4 py-3 font-medium">URL</th>
                      <th className="text-left px-4 py-3 font-medium">ログインID</th>
                      <th className="text-left px-4 py-3 font-medium">パスワード</th>
                      <th className="text-left px-4 py-3 font-medium">担当者</th>
                      <th className="text-right px-4 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">ログイン情報が見つかりません</td></tr>
                    ) : (
                      filtered.map((l) => (
                        <tr key={l.id} className="hover:bg-accent/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{l.service_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{l.category || "—"}</td>
                          <td className="px-4 py-3">
                            {l.login_url ? (
                              <a href={l.login_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                開く <ExternalLink size={11} />
                              </a>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{l.login_id || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs">
                                {visiblePasswords.has(l.id) ? (l.password || "—") : (l.password ? "●●●●●●" : "—")}
                              </span>
                              {l.password && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => togglePasswordVisible(l.id)}
                                >
                                  {visiblePasswords.has(l.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">{l.contact_person || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}>
                                <Pencil size={13} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(l.id)}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ログイン情報を編集" : "ログイン情報を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>サービス名 *</Label>
              <Input value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} placeholder="Google / LINE / Instagram" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>カテゴリ</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>担当者</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>ログインURL</Label>
              <Input type="url" value={form.login_url} onChange={(e) => setForm({ ...form, login_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ログインID</Label>
                <Input value={form.login_id} onChange={(e) => setForm({ ...form, login_id: e.target.value })} />
              </div>
              <div>
                <Label>パスワード</Label>
                <div className="relative">
                  <Input
                    type={showFormPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                  >
                    {showFormPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>登録メール</Label>
                <Input type="email" value={form.registered_email} onChange={(e) => setForm({ ...form, registered_email: e.target.value })} />
              </div>
              <div>
                <Label>二段階認証方法</Label>
                <Input value={form.two_factor_method} onChange={(e) => setForm({ ...form, two_factor_method: e.target.value })} placeholder="SMS / アプリ / なし" />
              </div>
            </div>
            <div>
              <Label>関連業者</Label>
              <Select value={form.vendor_id || "__none__"} onValueChange={(v) => setForm({ ...form, vendor_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>関連銀行口座</Label>
              <Select value={form.bank_account_id || "__none__"} onValueChange={(v) => setForm({ ...form, bank_account_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし</SelectItem>
                  {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>備考</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <Button onClick={handleSave} className="w-full">{editingId ? "更新" : "追加"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
