import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, GripVertical } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSortable } from "@/hooks/useSortable";
import { useDragReorder } from "@/hooks/useDragReorder";
import { SortableTh } from "@/components/SortableTh";

interface FixedCost {
  id: string;
  item_name: string;
  label: string | null;
  label_color: string | null;
  contract_holder: string | null;
  amount: number;
  payment_day: number | null;
  payment_method: string | null;
  transfer_destination: string | null;
  transfer_account_id: string | null;
  debit_account_id: string | null;
  renewal_date: string | null;
  cancellation_method: string | null;
  notes: string | null;
  vendor_id: string | null;
  vendor?: { id: string; name: string } | null;
  debit_account?: { id: string; account_name: string } | null;
  transfer_account?: { id: string; account_name: string } | null;
  sort_order: number | null;
  created_at: string;
}

interface Vendor { id: string; name: string; }
interface BankAccount {
  id: string;
  account_name: string;
  bank_name?: string | null;
  branch_name?: string | null;
  account_type?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
}

function bankAccountLabel(b: BankAccount): string {
  const detail = [b.bank_name, b.branch_name].filter(Boolean).join(" ");
  return detail ? `${b.account_name}（${detail}）` : b.account_name;
}

const LABEL_COLORS: { value: string; label: string; className: string }[] = [
  { value: "gray", label: "グレー", className: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "red", label: "レッド", className: "bg-rose-100 text-rose-700 border-rose-300" },
  { value: "orange", label: "オレンジ", className: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "green", label: "グリーン", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "blue", label: "ブルー", className: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "purple", label: "パープル", className: "bg-purple-100 text-purple-700 border-purple-300" },
];

function labelColorClass(color: string | null): string {
  return LABEL_COLORS.find((c) => c.value === color)?.className ?? LABEL_COLORS[0].className;
}

const emptyForm = {
  item_name: "",
  label: "",
  label_color: "gray",
  contract_holder: "",
  amount: 0,
  payment_day: "",
  payment_method: "",
  transfer_destination: "",
  transfer_account_id: "",
  debit_account_id: "",
  renewal_date: "",
  cancellation_method: "",
  notes: "",
  vendor_id: "",
};

const fixedCostToForm = (c: FixedCost) => ({
  item_name: c.item_name,
  label: c.label || "",
  label_color: c.label_color || "gray",
  contract_holder: c.contract_holder || "",
  amount: c.amount as any,
  payment_day: c.payment_day?.toString() || "",
  payment_method: c.payment_method || "",
  transfer_destination: c.transfer_destination || "",
  transfer_account_id: c.transfer_account_id || "",
  debit_account_id: c.debit_account_id || "",
  renewal_date: c.renewal_date || "",
  cancellation_method: c.cancellation_method || "",
  notes: c.notes || "",
  vendor_id: c.vendor_id || "",
});

export default function BusinessFixedCosts() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLabel, setFilterLabel] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const linkedFixedCostId = searchParams.get("fixedCost");
  const requestedNewItem = searchParams.get("newItem");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      fetchFixedCosts();
      fetchVendors();
      fetchBankAccounts();
    }
  }, [user]);

  const fetchFixedCosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_fixed_costs" as any)
      .select("*, vendor:business_vendors(id,name), debit_account:business_bank_accounts!debit_account_id(id,account_name), transfer_account:business_bank_accounts!transfer_account_id(id,account_name)")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (!error && data) setFixedCosts(data as any);
    setLoading(false);
  };

  const fetchVendors = async () => {
    const { data } = await supabase.from("business_vendors" as any).select("id, name").order("name");
    if (data) setVendors(data as any);
  };

  const fetchBankAccounts = async () => {
    const { data } = await supabase.from("business_bank_accounts" as any).select("id, account_name, bank_name, branch_name, account_number, account_holder").order("account_name");
    if (data) setBankAccounts(data as any);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEdit = (c: FixedCost) => {
    setEditingId(c.id);
    setForm(fixedCostToForm(c));
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (linkedFixedCostId) {
      const fixedCost = fixedCosts.find((item) => item.id === linkedFixedCostId);
      if (!fixedCost) return;
      setEditingId(fixedCost.id);
      setForm(fixedCostToForm(fixedCost));
      setIsDialogOpen(true);
      return;
    }
    if (requestedNewItem) {
      setEditingId(null);
      setForm({ ...emptyForm, item_name: requestedNewItem });
      setIsDialogOpen(true);
    }
  }, [fixedCosts, linkedFixedCostId, requestedNewItem]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (open || (!linkedFixedCostId && !requestedNewItem)) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("fixedCost");
    nextParams.delete("newItem");
    setSearchParams(nextParams, { replace: true });
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) {
      toast({ title: "エラー", description: "項目名を入力してください", variant: "destructive" });
      return;
    }
    const payload = {
      item_name: form.item_name.trim(),
      label: form.label || null,
      label_color: form.label_color || null,
      contract_holder: form.contract_holder || null,
      amount: Number(form.amount) || 0,
      payment_day: form.payment_day ? Number(form.payment_day) : null,
      payment_method: form.payment_method || null,
      transfer_destination: form.transfer_destination || null,
      transfer_account_id: form.transfer_account_id || null,
      debit_account_id: form.debit_account_id || null,
      renewal_date: form.renewal_date || null,
      cancellation_method: form.cancellation_method || null,
      notes: form.notes || null,
      vendor_id: form.vendor_id || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("business_fixed_costs" as any).update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("business_fixed_costs" as any).insert([payload]));
    }

    if (error) {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "更新完了" : "追加完了", description: `固定費を${editingId ? "更新" : "追加"}しました` });
    setIsDialogOpen(false);
    fetchFixedCosts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("business_fixed_costs" as any).delete().eq("id", id);
    if (!error) {
      toast({ title: "削除完了", description: "固定費を削除しました" });
      fetchFixedCosts();
    }
  };

  const labelOptions = Array.from(new Set(fixedCosts.map((c) => c.label).filter(Boolean))) as string[];

  const filtered = fixedCosts.filter((c) => {
    const matchLabel = filterLabel === "all" || c.label === filterLabel;
    if (!matchLabel) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.item_name.toLowerCase().includes(q) ||
      c.label?.toLowerCase().includes(q) ||
      c.contract_holder?.toLowerCase().includes(q) ||
      (c.vendor as any)?.name?.toLowerCase().includes(q) ||
      c.payment_method?.toLowerCase().includes(q)
    );
  });

  const monthlyTotal = filtered.reduce((sum, c) => sum + c.amount, 0);
  const yearlyTotal = monthlyTotal * 12;

  const sort = useSortable<FixedCost>(filtered, {
    label: (c) => c.label,
    item_name: (c) => c.item_name,
    amount: (c) => c.amount,
    payment_day: (c) => c.payment_day,
    payment_method: (c) => c.payment_method,
    contract_holder: (c) => c.contract_holder,
    vendor: (c) => (c.vendor as any)?.name,
    renewal_date: (c) => c.renewal_date,
  });
  const displayed = sort.sorted;

  const persistOrder = async (ordered: FixedCost[]) => {
    const orderMap = new Map(ordered.map((c, i) => [c.id, i]));
    setFixedCosts((prev) => [...prev].sort((a, b) => (orderMap.get(a.id) ?? 1e9) - (orderMap.get(b.id) ?? 1e9)));
    sort.reset();
    await Promise.all(ordered.map((c, i) => supabase.from("business_fixed_costs" as any).update({ sort_order: i + 1 }).eq("id", c.id)));
    fetchFixedCosts();
  };

  const { rowProps } = useDragReorder<FixedCost>(displayed, persistOrder);

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
              <h1 className="text-2xl font-bold">固定費管理</h1>
              <p className="text-sm text-muted-foreground">毎月の固定費一覧（支払日順）</p>
            </div>
            <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" />固定費を追加</Button>
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="項目名・ラベル・名義人・業者・支払方法で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {labelOptions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFilterLabel("all")}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterLabel === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
                  >
                    すべて
                  </button>
                  {labelOptions.map((lbl) => {
                    const color = fixedCosts.find((c) => c.label === lbl)?.label_color ?? "gray";
                    const active = filterLabel === lbl;
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setFilterLabel(lbl)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? labelColorClass(color) + " ring-2 ring-offset-1 ring-primary/40" : labelColorClass(color) + " opacity-70 hover:opacity-100"}`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="w-8 px-2 py-3"></th>
                      <SortableTh label="ラベル" sortKey="label" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="項目名" sortKey="item_name" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="金額" sortKey="amount" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} align="right" />
                      <SortableTh label="支払日" sortKey="payment_day" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="支払方法" sortKey="payment_method" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="契約名義人" sortKey="contract_holder" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="業者" sortKey="vendor" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="更新日" sortKey="renewal_date" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <th className="text-right px-4 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayed.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">固定費が見つかりません</td></tr>
                    ) : (
                      displayed.map((c, index) => (
                        <tr key={c.id} {...rowProps(index)} className="hover:bg-accent/20 transition-colors data-[over=true]:border-t-2 data-[over=true]:border-primary data-[dragging=true]:opacity-40">
                          <td className="px-2 py-3 text-muted-foreground cursor-grab active:cursor-grabbing"><GripVertical size={14} /></td>
                          <td className="px-4 py-3">
                            {c.label ? (
                              <Badge variant="outline" className={labelColorClass(c.label_color)}>{c.label}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">{c.item_name}</td>
                          <td className="px-4 py-3 text-right font-semibold">¥{c.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">{c.payment_day ? `毎月${c.payment_day}日` : "—"}</td>
                          <td className="px-4 py-3">{c.payment_method || "—"}</td>
                          <td className="px-4 py-3">{c.contract_holder || "—"}</td>
                          <td className="px-4 py-3">{(c.vendor as any)?.name || "—"}</td>
                          <td className="px-4 py-3">{c.renewal_date ? new Date(c.renewal_date).toLocaleDateString("ja-JP") : "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                                <Pencil size={13} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td className="px-4 py-3" colSpan={3}>合計 ({filtered.length}件)</td>
                        <td className="px-4 py-3 text-right text-primary">¥{monthlyTotal.toLocaleString()}<span className="text-xs font-normal text-muted-foreground ml-1">/月</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs" colSpan={6}>年換算: ¥{yearlyTotal.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "固定費を編集" : "固定費を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>項目名 *</Label>
              <Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="家賃 / サーバー費 / 通信費" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ラベル</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="物件 / 通信 / 税務" list="fixedcost-label-list" />
                <datalist id="fixedcost-label-list">
                  {labelOptions.map((l) => <option key={l} value={l} />)}
                </datalist>
              </div>
              <div>
                <Label>ラベル色</Label>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, label_color: c.value })}
                      title={c.label}
                      className={`w-7 h-7 rounded-full border-2 ${c.className} ${form.label_color === c.value ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>契約名義人</Label>
              <Input value={form.contract_holder} onChange={(e) => setForm({ ...form, contract_holder: e.target.value })} placeholder="契約者の氏名 / 法人名" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>金額（月額）</Label>
                <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value as any })} placeholder="0" />
              </div>
              <div>
                <Label>支払日（日）</Label>
                <Input type="number" min={1} max={31} value={form.payment_day} onChange={(e) => setForm({ ...form, payment_day: e.target.value })} placeholder="25" />
              </div>
            </div>
            <div>
              <Label>支払方法</Label>
              <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="口座振替 / カード / 振込" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>振込先口座</Label>
                <button
                  type="button"
                  onClick={() => navigate("/business-continuity/bank-accounts")}
                  className="text-xs text-primary hover:underline"
                >
                  口座を登録/編集
                </button>
              </div>
              <Select value={form.transfer_account_id || "__none__"} onValueChange={(v) => setForm({ ...form, transfer_account_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし</SelectItem>
                  {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{bankAccountLabel(b)}</SelectItem>)}
                </SelectContent>
              </Select>
              {(() => {
                const acc = bankAccounts.find((b) => b.id === form.transfer_account_id);
                if (!acc) return null;
                const line = [acc.bank_name, acc.branch_name, acc.account_number, acc.account_holder].filter(Boolean).join(" / ");
                return line ? <p className="text-xs text-muted-foreground mt-1">{line}</p> : null;
              })()}
            </div>
            <div>
              <Label>引落口座</Label>
              <Select value={form.debit_account_id || "__none__"} onValueChange={(v) => setForm({ ...form, debit_account_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">なし</SelectItem>
                  {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>更新日</Label>
                <Input type="date" value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} />
              </div>
              <div>
                <Label>解約方法</Label>
                <Input value={form.cancellation_method} onChange={(e) => setForm({ ...form, cancellation_method: e.target.value })} placeholder="電話 / WEB" />
              </div>
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
