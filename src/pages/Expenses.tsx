import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, Trash2, Search } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Expense {
  id: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  cast_id: string | null;
  description: string | null;
  payment_method: string | null;
  created_at: string;
  casts?: { name: string } | null;
}

interface Cast {
  id: string;
  name: string;
}

const EXPENSE_TYPES = ["雑費", "宿泊費", "交通費", "消耗品", "備品", "広告費", "その他"];

export default function Expenses() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Form state
  const [form, setForm] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    expense_type: "雑費",
    amount: 0,
    cast_id: "",
    description: "",
    payment_method: "現金",
  });

  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      fetchExpenses();
      fetchCasts();
    }
  }, [user]);

  const fetchExpenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*, casts:cast_id(name)")
      .order("expense_date", { ascending: false });

    if (!error && data) setExpenses(data as any);
    setLoading(false);
  };

  const fetchCasts = async () => {
    const { data } = await supabase.from("casts").select("id, name").order("name");
    if (data) setCasts(data);
  };

  const handleAdd = async () => {
    if (!isAdmin || !user) return;
    if (form.amount <= 0) {
      toast({ title: "エラー", description: "金額を入力してください", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("expenses").insert([{
      expense_date: form.expense_date,
      expense_type: form.expense_type,
      amount: form.amount,
      cast_id: form.cast_id || null,
      description: form.description || null,
      payment_method: form.payment_method,
      created_by: user.id,
    }]);

    if (error) {
      toast({ title: "エラー", description: "経費の追加に失敗しました", variant: "destructive" });
      return;
    }

    toast({ title: "経費追加", description: "経費が追加されました" });
    setIsAddOpen(false);
    setForm({ expense_date: format(new Date(), "yyyy-MM-dd"), expense_type: "雑費", amount: 0, cast_id: "", description: "", payment_method: "現金" });
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) {
      toast({ title: "削除完了", description: "経費が削除されました" });
      fetchExpenses();
    }
  };

  const filtered = expenses.filter((e) => {
    const matchSearch = e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.casts as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || !searchTerm;
    const matchType = filterType === "all" || e.expense_type === filterType;
    return matchSearch && matchType;
  });

  const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div>読み込み中...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4 max-w-5xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">経費管理</h1>
              <p className="text-sm text-muted-foreground">店舗経費の登録・管理</p>
            </div>
            {isAdmin && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus size={16} className="mr-1" />経費を追加</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>経費を追加</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>日付</Label>
                        <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                      </div>
                      <div>
                        <Label>種別</Label>
                        <Select value={form.expense_type} onValueChange={(v) => setForm({ ...form, expense_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>金額</Label>
                        <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="0" />
                      </div>
                      <div>
                        <Label>支払方法</Label>
                        <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="現金">現金</SelectItem>
                            <SelectItem value="カード">カード</SelectItem>
                            <SelectItem value="振込">振込</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>キャスト（任意）</Label>
                      <Select value={form.cast_id} onValueChange={(v) => setForm({ ...form, cast_id: v })}>
                        <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">なし</SelectItem>
                          {casts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>説明</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="経費の詳細..." />
                    </div>
                    <Button onClick={handleAdd} className="w-full">追加</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input placeholder="説明・キャスト名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全種別</SelectItem>
                    {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{filtered.length}件の経費</span>
              <span className="text-lg font-bold">合計: ¥{totalAmount.toLocaleString()}</span>
            </CardContent>
          </Card>

          {/* List */}
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">経費が見つかりません</div>
                ) : (
                  filtered.map((expense) => (
                    <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="text-sm text-muted-foreground w-[80px] flex-shrink-0">
                          {format(new Date(expense.expense_date), "M/d")}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">{expense.expense_type}</span>
                            {(expense.casts as any)?.name && (
                              <span className="text-xs text-primary">{(expense.casts as any).name}</span>
                            )}
                          </div>
                          {expense.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">{expense.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-semibold">¥{expense.amount.toLocaleString()}</span>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(expense.id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <footer className="mt-auto py-4 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-muted-foreground">© 2025 caskan.jp All rights reserved</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
