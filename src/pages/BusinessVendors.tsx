import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, GripVertical } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/email";
import { useSortable } from "@/hooks/useSortable";
import { useDragReorder } from "@/hooks/useDragReorder";
import { SortableTh } from "@/components/SortableTh";

interface Vendor {
  id: string;
  name: string;
  industry: string | null;
  contact_name: string | null;
  phone: string | null;
  line_id: string | null;
  email: string | null;
  bank_info: string | null;
  payment_method: string | null;
  contract_status: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
}

const INDUSTRIES = ["不動産", "税理士", "行政書士", "清掃", "カメラマン", "デザイナー", "サーバー", "通信", "求人媒体", "広告代理店", "その他"];

const emptyForm = {
  name: "",
  industry: "",
  contact_name: "",
  phone: "",
  line_id: "",
  email: "",
  bank_info: "",
  payment_method: "",
  contract_status: "active",
  notes: "",
};

export default function BusinessVendors() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) fetchVendors();
  }, [user]);

  const fetchVendors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_vendors" as any)
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (!error && data) setVendors(data as any);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      industry: v.industry || "",
      contact_name: v.contact_name || "",
      phone: v.phone || "",
      line_id: v.line_id || "",
      email: v.email || "",
      bank_info: v.bank_info || "",
      payment_method: v.payment_method || "",
      contract_status: v.contract_status || "active",
      notes: v.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "エラー", description: "業者名を入力してください", variant: "destructive" });
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      toast({ title: "エラー", description: "メールアドレスの形式が正しくありません（例: example@email.jp）", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      industry: form.industry || null,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      line_id: form.line_id || null,
      email: form.email || null,
      bank_info: form.bank_info || null,
      payment_method: form.payment_method || null,
      contract_status: form.contract_status || "active",
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("business_vendors" as any).update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("business_vendors" as any).insert([payload]));
    }

    if (error) {
      toast({ title: "エラー", description: "保存に失敗しました", variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "更新完了" : "追加完了", description: `業者情報を${editingId ? "更新" : "追加"}しました` });
    setIsDialogOpen(false);
    fetchVendors();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("business_vendors" as any).delete().eq("id", id);
    if (!error) {
      toast({ title: "削除完了", description: "業者を削除しました" });
      fetchVendors();
    }
  };

  const filtered = vendors.filter((v) => {
    const matchSearch = !searchTerm ||
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchIndustry = filterIndustry === "all" || v.industry === filterIndustry;
    return matchSearch && matchIndustry;
  });

  const sort = useSortable<Vendor>(filtered, {
    name: (v) => v.name,
    industry: (v) => v.industry,
    contact_name: (v) => v.contact_name,
    phone: (v) => v.phone,
    email: (v) => v.email,
    contract_status: (v) => v.contract_status,
  });
  const displayed = sort.sorted;

  const persistOrder = async (ordered: Vendor[]) => {
    const orderMap = new Map(ordered.map((v, i) => [v.id, i]));
    setVendors((prev) => [...prev].sort((a, b) => (orderMap.get(a.id) ?? 1e9) - (orderMap.get(b.id) ?? 1e9)));
    sort.reset();
    await Promise.all(ordered.map((v, i) => supabase.from("business_vendors" as any).update({ sort_order: i + 1 }).eq("id", v.id)));
    fetchVendors();
  };

  const { rowProps } = useDragReorder<Vendor>(displayed, persistOrder);

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
              <h1 className="text-2xl font-bold">業者一覧</h1>
              <p className="text-sm text-muted-foreground">取引業者・連絡先の管理</p>
            </div>
            <Button size="sm" onClick={openAdd}><Plus size={16} className="mr-1" />業者を追加</Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="業者名・担当者・メールで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全業種</SelectItem>
                    {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
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
                      <th className="w-8 px-2 py-3"></th>
                      <SortableTh label="業者名" sortKey="name" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="業種" sortKey="industry" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="担当者" sortKey="contact_name" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="電話番号" sortKey="phone" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="メール" sortKey="email" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <SortableTh label="契約状況" sortKey="contract_status" activeKey={sort.sortKey} dir={sort.sortDir} onSort={sort.toggle} />
                      <th className="text-right px-4 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayed.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">業者が見つかりません</td></tr>
                    ) : (
                      displayed.map((v, index) => (
                        <tr key={v.id} {...rowProps(index)} className="hover:bg-accent/20 transition-colors data-[over=true]:border-t-2 data-[over=true]:border-primary data-[dragging=true]:opacity-40">
                          <td className="px-2 py-3 text-muted-foreground cursor-grab active:cursor-grabbing"><GripVertical size={14} /></td>
                          <td className="px-4 py-3 font-medium">{v.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{v.industry || "—"}</td>
                          <td className="px-4 py-3">{v.contact_name || "—"}</td>
                          <td className="px-4 py-3">{v.phone || "—"}</td>
                          <td className="px-4 py-3">{v.email || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={v.contract_status === "active" ? "default" : "secondary"}>
                              {v.contract_status === "active" ? "契約中" : "終了"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}>
                                <Pencil size={13} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(v.id)}>
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
            <DialogTitle>{editingId ? "業者を編集" : "業者を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>業者名 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="株式会社〇〇" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>業種</Label>
                <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>契約状況</Label>
                <Select value={form.contract_status} onValueChange={(v) => setForm({ ...form, contract_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">契約中</SelectItem>
                    <SelectItem value="inactive">終了</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>担当者名</Label>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div>
                <Label>電話番号</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>LINE ID</Label>
                <Input value={form.line_id} onChange={(e) => setForm({ ...form, line_id: e.target.value })} />
              </div>
              <div>
                <Label>メール</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>銀行情報</Label>
              <Input value={form.bank_info} onChange={(e) => setForm({ ...form, bank_info: e.target.value })} placeholder="〇〇銀行 〇〇支店 普通 1234567" />
            </div>
            <div>
              <Label>支払方法</Label>
              <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="振込 / 現金 / カード" />
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
