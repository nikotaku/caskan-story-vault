import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, GripVertical } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSortable } from "@/hooks/useSortable";
import { useDragReorder } from "@/hooks/useDragReorder";
import { SortableTh } from "@/components/SortableTh";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string | null;
  branch_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  purpose: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
}

const emptyForm = {
  account_name: "",
  bank_name: "",
  branch_name: "",
  account_number: "",
  account_holder: "",
  purpose: "",
  notes: "",
};

const bankAccountToForm = (account: BankAccount) => ({
  account_name: account.account_name,
  bank_name: account.bank_name || "",
  branch_name: account.branch_name || "",
  account_number: account.account_number || "",
  account_holder: account.account_holder || "",
  purpose: account.purpose || "",
  notes: account.notes || "",
});

export default function BusinessBankAccounts() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const linkedAccountId = searchParams.get("account");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) fetchAccounts();
  }, [user]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_bank_accounts" as any)
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (!error && data) setAccounts(data as any);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEdit = (a: BankAccount) => {
    setEditingId(a.id);
    setForm(bankAccountToForm(a));
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (!linkedAccountId) return;
    const account = accounts.find((item) => item.id === linkedAccountId);
    if (!account) return;
    setEditingId(account.id);
    setForm(bankAccountToForm(account));
    setIsDialogOpen(true);
  }, [accounts, linkedAccountId]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (open || !linkedAccountId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("account");
    setSearchParams(nextParams, { replace: true });
  };

  const handleSave = async () => {
    if (!form.account_name.trim()) {
      toast({ title: "エラー", description: "口座名を入力してください", variant: "destructive" });
      return;
    }
    const payload = {
      account_name: form.account_name.trim(),
      bank_name: form.bank_name || null,
      branch_name: form.branch_name || null,
      account_number: form.account_number || null,
      account_holder: form.account_holder || null,
      purpose: form.purpose || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("business_bank_accounts" as any).update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("business_bank_accounts" as any).insert([payload]));
    }

    if (error) {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "更新完了" : "追加完了", description: `銀行口座を${editingId ? "更新" : "追加"}しました` });
    setIsDialogOpen(false);
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("business_bank_accounts" as any).delete().eq("id", id);
    if (!error) {
      toast({ title: "削除完了", description: "銀行口座を削除しました" });
      fetchAccounts();
    }
  };

  const filtered = accounts.filter((a) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      a.account_name.toLowerCase().includes(q) ||
      a.bank_name?.toLowerCase().includes(q) ||
      a.account_holder?.toLowerCase().includes(q) ||
      a.purpose?.toLowerCase().includes(q)
    );
  });

  const sort = useSortable<BankAccount>(filtered, {
    account_name: (a) => a.account_name,
    bank_name: (a) => a.bank_name,
    branch_name: (a) => a.branch_name,
    account_number: (a) => a.account_number,
    account_holder: (a) => a.account_holder,
    purpose: (a) => a.purpose,
  });
  const displayed = sort.sorted;

  const persistOrder = async (ordered: BankAccount[]) => {
    const orderMap = new Map(ordered.map((a, i) => [a.id, i]));
    setAccounts((prev) => [...prev].sort((a, b) => (orderMap.get(a.id) ?? 1e9) - (orderMap.get(b.id) ?? 1e9)));
    sort.reset();
    await Promise.all(ordered.map((a, i) => supabase.from("business_bank_accounts" as any).update({ sort_order: i + 1 }).eq("id", a.id)));
    fetchAccounts();
  };

  const { rowProps } = useDragReorder<BankAccount>(displayed, persistOrder);

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
              <h1 className="text-2xl font-bold">銀行口座管理</h1>
              <p className="text-sm text-muted-foreground">事業用銀行口座の一覧</p>
            </div>
            <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" />口座を追加</Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="口座名・銀行名・名義・用途で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="w-8 px-2 py-3"></th>
                      <SortableTh label="口座名" sortKey="account_name" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="銀行名" sortKey="bank_name" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="支店名" sortKey="branch_name" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="口座番号" sortKey="account_number" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="名義" sortKey="account_holder" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="用途" sortKey="purpose" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <th className="text-right px-4 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayed.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">銀行口座が見つかりません</td></tr>
                    ) : (
                      displayed.map((a, index) => (
                        <tr key={a.id} {...rowProps(index)} className="hover:bg-accent/20 transition-colors data-[over=true]:border-t-2 data-[over=true]:border-primary data-[dragging=true]:opacity-40">
                          <td className="px-2 py-3 text-muted-foreground cursor-grab active:cursor-grabbing"><GripVertical size={14} /></td>
                          <td className="px-4 py-3 font-medium">{a.account_name}</td>
                          <td className="px-4 py-3">{a.bank_name || "—"}</td>
                          <td className="px-4 py-3">{a.branch_name || "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{a.account_number || "—"}</td>
                          <td className="px-4 py-3">{a.account_holder || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{a.purpose || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                                <Pencil size={13} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)}>
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "銀行口座を編集" : "銀行口座を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>口座名 *</Label>
              <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="メイン口座 / 給与振込用" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>銀行名</Label>
                <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="〇〇銀行" />
              </div>
              <div>
                <Label>支店名</Label>
                <Input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} placeholder="〇〇支店" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>口座番号</Label>
                <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="1234567" />
              </div>
              <div>
                <Label>口座名義</Label>
                <Input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>用途</Label>
              <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="売上入金用 / 給与支払用" />
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
