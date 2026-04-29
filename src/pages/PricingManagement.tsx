import { useState, useEffect } from "react";
import { DollarSign, Plus, Edit, Trash2, Save, Receipt, Star, Wallet, CreditCard } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface PricingCourse {
  id: string;
  duration: number;
  standard_price: number;
  premium_price: number;
  vip_price: number;
  course_type: string;
}

interface BackRate {
  id: string;
  duration: number;
  customer_price: number;
  therapist_back: number;
  shop_back: number;
  course_type: string;
}

interface PricingOption {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

interface OptionRate {
  id: string;
  option_name: string;
  customer_price: number;
  therapist_back: number;
  shop_back: number;
}

interface NominationRate {
  id: string;
  nomination_type: string;
  customer_price: number;
  therapist_back: number;
  shop_back: number;
}

interface ExpenseRate {
  id: string;
  expense_type: string;
  therapist_deduction: number;
  shop_income: number;
  min_days: number | null;
}

export default function PricingManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<PricingCourse[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [options, setOptions] = useState<PricingOption[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [expenseRates, setExpenseRates] = useState<ExpenseRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState<PricingCourse | null>(null);
  const [editingBackRate, setEditingBackRate] = useState<BackRate | null>(null);
  const [editingExpenseRate, setEditingExpenseRate] = useState<ExpenseRate | null>(null);
  const [editingOption, setEditingOption] = useState<{ id: string; price: number; therapist_back: number; shop_back: number } | null>(null);
  const [editingNomination, setEditingNomination] = useState<NominationRate | null>(null);
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [isAddNominationOpen, setIsAddNominationOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [optionForm, setOptionForm] = useState({
    name: "",
    price: 0,
    therapist_back: 0,
    shop_back: 0,
    description: "",
  });

  const [nominationForm, setNominationForm] = useState({
    nomination_type: "",
    customer_price: 0,
    therapist_back: 0,
    shop_back: 0,
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_type: "",
    therapist_deduction: 0,
    shop_income: 0,
    min_days: 1,
  });

  const [paymentSettings, setPaymentSettings] = useState<Array<{ id: string; payment_method: string; payment_link: string | null; fee_percentage: number }>>([]);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { payment_link: string; fee_percentage: string }>>({});
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPricing();
      fetchBackRates();
      fetchOptions();
      fetchOptionRates();
      fetchNominationRates();
      fetchExpenseRates();
      fetchPaymentSettings();
    }
  }, [user]);

  const fetchPaymentSettings = async () => {
    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .order('payment_method');
    if (error) {
      console.error(error);
      return;
    }
    setPaymentSettings(data || []);
    const drafts: Record<string, { payment_link: string; fee_percentage: string }> = {};
    (data || []).forEach((p: any) => {
      drafts[p.id] = {
        payment_link: p.payment_link || "",
        fee_percentage: String(p.fee_percentage ?? 0),
      };
    });
    setPaymentDrafts(drafts);
  };

  const handleSavePaymentSetting = async (id: string) => {
    const draft = paymentDrafts[id];
    if (!draft) return;
    const fee = parseFloat(draft.fee_percentage);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      toast({ title: "手数料は0〜100の数値で入力してください", variant: "destructive" });
      return;
    }
    setSavingPaymentId(id);
    const { error } = await supabase
      .from('payment_settings')
      .update({ payment_link: draft.payment_link, fee_percentage: fee })
      .eq('id', id);
    setSavingPaymentId(null);
    if (error) {
      toast({ title: "保存失敗", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "保存しました" });
    await fetchPaymentSettings();
  };

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase.from('pricing').select('*').order('duration', { ascending: true });
      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast({ title: "エラー", description: "料金情報の取得に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchBackRates = async () => {
    try {
      const { data, error } = await supabase.from('back_rates').select('*').order('duration', { ascending: true });
      if (error) throw error;
      setBackRates(data || []);
    } catch (error) {
      console.error('Error fetching back rates:', error);
    }
  };

  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase.from('pricing_options').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const fetchOptionRates = async () => {
    try {
      const { data, error } = await supabase.from('option_rates').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setOptionRates(data || []);
    } catch (error) {
      console.error('Error fetching option rates:', error);
    }
  };

  const fetchNominationRates = async () => {
    try {
      const { data, error } = await supabase.from('nomination_rates').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setNominationRates(data || []);
    } catch (error) {
      console.error('Error fetching nomination rates:', error);
    }
  };

  const fetchExpenseRates = async () => {
    try {
      const { data, error } = await supabase.from('expense_rates').select('*').order('expense_type', { ascending: true });
      if (error) throw error;
      setExpenseRates(data || []);
    } catch (error) {
      console.error('Error fetching expense rates:', error);
    }
  };

  const handleAddExpenseRate = async () => {
    if (!isAdmin) { toast({ title: "権限エラー", description: "管理者のみ追加できます", variant: "destructive" }); return; }
    if (!expenseForm.expense_type) { toast({ title: "入力エラー", description: "経費タイプを入力してください", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from('expense_rates').insert({
        expense_type: expenseForm.expense_type,
        therapist_deduction: expenseForm.therapist_deduction,
        shop_income: expenseForm.shop_income,
        min_days: expenseForm.min_days,
      });
      if (error) throw error;
      toast({ title: "追加完了", description: "経費率を追加しました" });
      setIsAddExpenseOpen(false);
      setExpenseForm({ expense_type: "", therapist_deduction: 0, shop_income: 0, min_days: 1 });
      fetchExpenseRates();
    } catch (error) {
      console.error('Error adding expense rate:', error);
      toast({ title: "エラー", description: "経費率の追加に失敗しました", variant: "destructive" });
    }
  };

  const handleUpdateExpenseRate = async (rate: ExpenseRate) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('expense_rates').update({
        therapist_deduction: rate.therapist_deduction,
        shop_income: rate.shop_income,
        min_days: rate.min_days,
      }).eq('id', rate.id);
      if (error) throw error;
      toast({ title: "更新完了", description: "経費率を更新しました" });
      setEditingExpenseRate(null);
      fetchExpenseRates();
    } catch (error) {
      toast({ title: "エラー", description: "経費率の更新に失敗しました", variant: "destructive" });
    }
  };

  const handleDeleteExpenseRate = async (id: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('expense_rates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "削除完了", description: "経費率を削除しました" });
      fetchExpenseRates();
    } catch (error) {
      toast({ title: "エラー", description: "経費率の削除に失敗しました", variant: "destructive" });
    }
  };

  const handleUpdateCourse = async (course: PricingCourse) => {
    if (!isAdmin) { toast({ title: "権限エラー", description: "管理者のみ料金を更新できます", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from('pricing').update({
        standard_price: course.standard_price,
        premium_price: course.premium_price,
        vip_price: course.vip_price,
      }).eq('id', course.id);
      if (error) throw error;
      toast({ title: "更新完了", description: "料金を更新しました" });
      setEditingCourse(null);
      fetchPricing();
    } catch (error) {
      console.error('Error updating course:', error);
      toast({ title: "エラー", description: "料金の更新に失敗しました", variant: "destructive" });
    }
  };

  const handleUpdateBackRate = async (backRate: BackRate) => {
    if (!isAdmin) { toast({ title: "権限エラー", description: "管理者のみバック率を更新できます", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from('back_rates').update({
        therapist_back: backRate.therapist_back,
        shop_back: backRate.shop_back,
      }).eq('id', backRate.id);
      if (error) throw error;
      toast({ title: "更新完了", description: "バック率を更新しました" });
      setEditingBackRate(null);
      fetchBackRates();
    } catch (error) {
      console.error('Error updating back rate:', error);
      toast({ title: "エラー", description: "バック率の更新に失敗しました", variant: "destructive" });
    }
  };

  const handleAddOption = async () => {
    if (!isAdmin) { toast({ title: "権限エラー", description: "管理者のみオプションを追加できます", variant: "destructive" }); return; }
    if (!optionForm.name || optionForm.price <= 0) { toast({ title: "入力エラー", description: "すべての項目を正しく入力してください", variant: "destructive" }); return; }
    try {
      const { error: optionError } = await supabase.from('pricing_options').insert({ name: optionForm.name, price: optionForm.price, description: optionForm.description || null });
      if (optionError) throw optionError;
      const { error: rateError } = await supabase.from('option_rates').insert({ option_name: optionForm.name, customer_price: optionForm.price, therapist_back: optionForm.therapist_back, shop_back: optionForm.shop_back });
      if (rateError) throw rateError;
      toast({ title: "追加完了", description: "オプションとバック率を追加しました" });
      setIsAddOptionOpen(false);
      setOptionForm({ name: "", price: 0, therapist_back: 0, shop_back: 0, description: "" });
      fetchOptions();
      fetchOptionRates();
    } catch (error) {
      console.error('Error adding option:', error);
      toast({ title: "エラー", description: "オプションの追加に失敗しました", variant: "destructive" });
    }
  };

  const handleAddNomination = async () => {
    if (!isAdmin) { toast({ title: "権限エラー", description: "管理者のみ指名料を追加できます", variant: "destructive" }); return; }
    if (!nominationForm.nomination_type || nominationForm.customer_price <= 0) { toast({ title: "入力エラー", description: "すべての項目を正しく入力してください", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from('nomination_rates').insert({
        nomination_type: nominationForm.nomination_type,
        customer_price: nominationForm.customer_price,
        therapist_back: nominationForm.therapist_back,
        shop_back: nominationForm.shop_back,
      });
      if (error) throw error;
      toast({ title: "追加完了", description: "指名料を追加しました" });
      setIsAddNominationOpen(false);
      setNominationForm({ nomination_type: "", customer_price: 0, therapist_back: 0, shop_back: 0 });
      fetchNominationRates();
    } catch (error) {
      console.error('Error adding nomination:', error);
      toast({ title: "エラー", description: "指名料の追加に失敗しました", variant: "destructive" });
    }
  };

  const handleUpdateOption = async (option: PricingOption, editData: { price: number; therapist_back: number; shop_back: number }) => {
    if (!isAdmin) return;
    try {
      const { error: optErr } = await supabase.from('pricing_options').update({ price: editData.price }).eq('id', option.id);
      if (optErr) throw optErr;
      const { error: rateErr } = await supabase.from('option_rates').update({ customer_price: editData.price, therapist_back: editData.therapist_back, shop_back: editData.shop_back }).eq('option_name', option.name);
      if (rateErr) throw rateErr;
      toast({ title: "更新完了", description: "オプションを更新しました" });
      setEditingOption(null);
      fetchOptions();
      fetchOptionRates();
    } catch (error) {
      toast({ title: "エラー", description: "オプションの更新に失敗しました", variant: "destructive" });
    }
  };

  const handleUpdateNomination = async (nom: NominationRate) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('nomination_rates').update({
        customer_price: nom.customer_price,
        therapist_back: nom.therapist_back,
        shop_back: nom.shop_back,
      }).eq('id', nom.id);
      if (error) throw error;
      toast({ title: "更新完了", description: "指名料を更新しました" });
      setEditingNomination(null);
      fetchNominationRates();
    } catch (error) {
      toast({ title: "エラー", description: "指名料の更新に失敗しました", variant: "destructive" });
    }
  };

  const handleDeleteOption = async (id: string) => {
    if (!isAdmin) { toast({ title: "権限エラー", description: "管理者のみオプションを削除できます", variant: "destructive" }); return; }
    try {
      const option = options.find(opt => opt.id === id);
      if (!option) return;
      const { error: optionError } = await supabase.from('pricing_options').delete().eq('id', id);
      if (optionError) throw optionError;
      const { error: rateError } = await supabase.from('option_rates').delete().eq('option_name', option.name);
      if (rateError) throw rateError;
      toast({ title: "削除完了", description: "オプションとバック率を削除しました" });
      setDeleteConfirmId(null);
      fetchOptions();
      fetchOptionRates();
    } catch (error) {
      console.error('Error deleting option:', error);
      toast({ title: "エラー", description: "オプションの削除に失敗しました", variant: "destructive" });
    }
  };

  const handleDeleteNomination = async (id: string) => {
    if (!isAdmin) { toast({ title: "権限エラー", description: "管理者のみ指名料を削除できます", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.from('nomination_rates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "削除完了", description: "指名料を削除しました" });
      fetchNominationRates();
    } catch (error) {
      console.error('Error deleting nomination:', error);
      toast({ title: "エラー", description: "指名料の削除に失敗しました", variant: "destructive" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="pt-[60px] px-4 py-6 md:ml-[180px] bg-background min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">料金設定（マスター）</h1>
            <p className="text-sm text-muted-foreground">ここで設定した料金がフロント予約・料金ページ・管理画面すべてに反映されます</p>
          </div>

          <Tabs defaultValue="courses" className="w-full">
            <TabsList className="w-full grid grid-cols-5 mb-4">
              <TabsTrigger value="courses" className="text-xs sm:text-sm gap-1">
                <DollarSign className="h-3 w-3 hidden sm:inline" />
                コース
              </TabsTrigger>
              <TabsTrigger value="options" className="text-xs sm:text-sm gap-1">
                <Plus className="h-3 w-3 hidden sm:inline" />
                オプション
              </TabsTrigger>
              <TabsTrigger value="nominations" className="text-xs sm:text-sm gap-1">
                <Star className="h-3 w-3 hidden sm:inline" />
                指名料
              </TabsTrigger>
              <TabsTrigger value="expenses" className="text-xs sm:text-sm gap-1">
                <Receipt className="h-3 w-3 hidden sm:inline" />
                経費率
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs sm:text-sm gap-1">
                <CreditCard className="h-3 w-3 hidden sm:inline" />
                決済
              </TabsTrigger>
            </TabsList>

            {/* コース料金・バック率 */}
            <TabsContent value="courses">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="h-5 w-5" />
                    コース料金・バック率管理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">時間</th>
                          <th className="text-left py-3 px-2">タイプ</th>
                          <th className="text-right py-3 px-2">スタンダード</th>
                          <th className="text-right py-3 px-2">プレミアム</th>
                          <th className="text-right py-3 px-2">VIP</th>
                          <th className="text-right py-3 px-2">セラピストバック</th>
                          <th className="text-right py-3 px-2">店舗バック</th>
                          {isAdmin && <th className="text-center py-3 px-2">操作</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((course) => {
                          const isEditing = editingCourse?.id === course.id;
                          const backRate = backRates.find(r => r.duration === course.duration && r.course_type === course.course_type);
                          const isEditingBack = editingBackRate?.id === backRate?.id;
                          return (
                            <tr key={course.id} className="border-b">
                              <td className="py-3 px-2">{course.duration}分</td>
                              <td className="py-3 px-2">{course.course_type}</td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? (
                                  <Input type="number" value={editingCourse.standard_price} onChange={(e) => setEditingCourse({...editingCourse, standard_price: parseInt(e.target.value) || 0})} className="w-20 text-right" />
                                ) : `¥${course.standard_price.toLocaleString()}`}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? (
                                  <Input type="number" value={editingCourse.premium_price} onChange={(e) => setEditingCourse({...editingCourse, premium_price: parseInt(e.target.value) || 0})} className="w-20 text-right" />
                                ) : `¥${course.premium_price.toLocaleString()}`}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? (
                                  <Input type="number" value={editingCourse.vip_price} onChange={(e) => setEditingCourse({...editingCourse, vip_price: parseInt(e.target.value) || 0})} className="w-20 text-right" />
                                ) : `¥${course.vip_price.toLocaleString()}`}
                              </td>
                              <td className="text-right py-3 px-2">
                                {backRate ? (isEditingBack ? (
                                  <Input type="number" value={editingBackRate.therapist_back} onChange={(e) => setEditingBackRate({...editingBackRate, therapist_back: parseInt(e.target.value) || 0})} className="w-20 text-right" />
                                ) : `¥${backRate.therapist_back.toLocaleString()}`) : '-'}
                              </td>
                              <td className="text-right py-3 px-2">
                                {backRate ? (isEditingBack ? (
                                  <Input type="number" value={editingBackRate.shop_back} onChange={(e) => setEditingBackRate({...editingBackRate, shop_back: parseInt(e.target.value) || 0})} className="w-20 text-right" />
                                ) : `¥${backRate.shop_back.toLocaleString()}`) : '-'}
                              </td>
                              {isAdmin && (
                                <td className="text-center py-3 px-2">
                                  <div className="flex gap-1 justify-center">
                                    {isEditing ? (
                                      <Button onClick={() => handleUpdateCourse(editingCourse)} size="sm"><Save className="h-3 w-3" /></Button>
                                    ) : (
                                      <Button onClick={() => setEditingCourse(course)} variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                                    )}
                                    {backRate && (isEditingBack ? (
                                      <Button onClick={() => handleUpdateBackRate(editingBackRate)} size="sm"><Save className="h-3 w-3" /></Button>
                                    ) : (
                                      <Button onClick={() => setEditingBackRate(backRate)} variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                                    ))}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* オプション料金 */}
            <TabsContent value="options">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Plus size={20} />
                      オプション料金
                    </CardTitle>
                    {isAdmin && (
                      <Dialog open={isAddOptionOpen} onOpenChange={setIsAddOptionOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus size={16} /> 追加</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>オプション追加</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>オプション名</Label>
                              <Input value={optionForm.name} onChange={(e) => setOptionForm({...optionForm, name: e.target.value})} placeholder="例：指名料" />
                            </div>
                            <div>
                              <Label>お客様料金（円）</Label>
                              <Input type="number" value={optionForm.price} onChange={(e) => setOptionForm({...optionForm, price: parseInt(e.target.value)})} />
                            </div>
                            <div>
                              <Label>セラピストバック（円）</Label>
                              <Input type="number" value={optionForm.therapist_back} onChange={(e) => setOptionForm({...optionForm, therapist_back: parseInt(e.target.value)})} />
                            </div>
                            <div>
                              <Label>店舗バック（円）</Label>
                              <Input type="number" value={optionForm.shop_back} onChange={(e) => setOptionForm({...optionForm, shop_back: parseInt(e.target.value)})} />
                            </div>
                            <div>
                              <Label>説明（任意）</Label>
                              <Textarea value={optionForm.description} onChange={(e) => setOptionForm({...optionForm, description: e.target.value})} placeholder="オプションの詳細説明" rows={3} />
                            </div>
                            <Button onClick={handleAddOption} className="w-full">追加</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">オプション名</th>
                          <th className="text-right py-3 px-2">お客様料金</th>
                          <th className="text-right py-3 px-2">セラピストバック</th>
                          <th className="text-right py-3 px-2">店バック</th>
                          {isAdmin && <th className="text-center py-3 px-2">操作</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {options.map((option) => {
                          const optionRate = optionRates.find(r => r.option_name === option.name);
                          const isEditing = editingOption?.id === option.id;
                          return (
                            <tr key={option.id} className="border-b">
                              <td className="py-3 px-2 font-medium">{option.name}</td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? <Input type="number" value={editingOption.price} onChange={(e) => setEditingOption({...editingOption, price: parseInt(e.target.value) || 0})} className="w-20 text-right" /> : `¥${option.price.toLocaleString()}`}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? <Input type="number" value={editingOption.therapist_back} onChange={(e) => setEditingOption({...editingOption, therapist_back: parseInt(e.target.value) || 0})} className="w-20 text-right" /> : `¥${optionRate?.therapist_back?.toLocaleString() || 0}`}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? <Input type="number" value={editingOption.shop_back} onChange={(e) => setEditingOption({...editingOption, shop_back: parseInt(e.target.value) || 0})} className="w-20 text-right" /> : `¥${optionRate?.shop_back?.toLocaleString() || 0}`}
                              </td>
                              {isAdmin && (
                                <td className="text-center py-3 px-2">
                                  <div className="flex gap-1 justify-center">
                                    {isEditing ? (
                                      <Button onClick={() => handleUpdateOption(option, editingOption)} size="sm"><Save className="h-3 w-3" /></Button>
                                    ) : (
                                      <Button onClick={() => setEditingOption({ id: option.id, price: option.price, therapist_back: optionRate?.therapist_back || 0, shop_back: optionRate?.shop_back || 0 })} variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                                    )}
                                    {deleteConfirmId === option.id ? (
                                      <>
                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteOption(option.id)}>確認</Button>
                                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>×</Button>
                                      </>
                                    ) : (
                                      <Button size="sm" variant="destructive" onClick={() => setDeleteConfirmId(option.id)}><Trash2 size={14} /></Button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 指名料 */}
            <TabsContent value="nominations">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-lg">指名料</CardTitle>
                    {isAdmin && (
                      <Dialog open={isAddNominationOpen} onOpenChange={setIsAddNominationOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> 指名料追加</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>新しい指名料金を追加</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>指名タイプ</Label>
                              <Input value={nominationForm.nomination_type} onChange={(e) => setNominationForm({...nominationForm, nomination_type: e.target.value})} placeholder="例: 本指名, フリー指名" />
                            </div>
                            <div>
                              <Label>お客様料金 (円)</Label>
                              <Input type="number" value={nominationForm.customer_price} onChange={(e) => setNominationForm({...nominationForm, customer_price: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                              <Label>セラピストバック (円)</Label>
                              <Input type="number" value={nominationForm.therapist_back} onChange={(e) => setNominationForm({...nominationForm, therapist_back: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                              <Label>店舗バック (円)</Label>
                              <Input type="number" value={nominationForm.shop_back} onChange={(e) => setNominationForm({...nominationForm, shop_back: parseInt(e.target.value) || 0})} />
                            </div>
                            <Button onClick={handleAddNomination} className="w-full">追加</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {nominationRates.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">登録されている指名料金はありません</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2">指名タイプ</th>
                            <th className="text-right py-3 px-2">お客様料金</th>
                            <th className="text-right py-3 px-2">セラピストバック</th>
                            <th className="text-right py-3 px-2">店バック</th>
                            {isAdmin && <th className="text-center py-3 px-2">操作</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {nominationRates.map((nomination) => {
                            const isEditing = editingNomination?.id === nomination.id;
                            return (
                            <tr key={nomination.id} className="border-b">
                              <td className="py-3 px-2 font-medium">{nomination.nomination_type}</td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? <Input type="number" value={editingNomination.customer_price} onChange={(e) => setEditingNomination({...editingNomination, customer_price: parseInt(e.target.value) || 0})} className="w-20 text-right" /> : `¥${nomination.customer_price.toLocaleString()}`}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? <Input type="number" value={editingNomination.therapist_back} onChange={(e) => setEditingNomination({...editingNomination, therapist_back: parseInt(e.target.value) || 0})} className="w-20 text-right" /> : `¥${nomination.therapist_back?.toLocaleString() || 0}`}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? <Input type="number" value={editingNomination.shop_back} onChange={(e) => setEditingNomination({...editingNomination, shop_back: parseInt(e.target.value) || 0})} className="w-20 text-right" /> : `¥${nomination.shop_back?.toLocaleString() || 0}`}
                              </td>
                              {isAdmin && (
                                <td className="text-center py-3 px-2">
                                  <div className="flex gap-1 justify-center">
                                    {isEditing ? (
                                      <Button onClick={() => handleUpdateNomination(editingNomination)} size="sm"><Save className="h-3 w-3" /></Button>
                                    ) : (
                                      <Button onClick={() => setEditingNomination(nomination)} variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                                    )}
                                    <Button onClick={() => handleDeleteNomination(nomination.id)} variant="destructive" size="sm"><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 経費率管理 */}
            <TabsContent value="expenses">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Receipt className="h-5 w-5" />
                      経費率管理（雑費・宿泊費・交通費）
                    </CardTitle>
                    {isAdmin && (
                      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> 追加</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>経費率を追加</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>経費タイプ</Label>
                              <Input value={expenseForm.expense_type} onChange={(e) => setExpenseForm({...expenseForm, expense_type: e.target.value})} placeholder="例: 雑費、宿泊費、交通費3日〜" />
                            </div>
                            <div>
                              <Label>セラピスト控除/支給（円）</Label>
                              <Input type="number" value={expenseForm.therapist_deduction} onChange={(e) => setExpenseForm({...expenseForm, therapist_deduction: parseInt(e.target.value) || 0})} />
                              <p className="text-xs text-muted-foreground mt-1">正の値=支給、負の値=控除</p>
                            </div>
                            <div>
                              <Label>店舗収入（円）</Label>
                              <Input type="number" value={expenseForm.shop_income} onChange={(e) => setExpenseForm({...expenseForm, shop_income: parseInt(e.target.value) || 0})} />
                            </div>
                            <div>
                              <Label>最低日数</Label>
                              <Input type="number" value={expenseForm.min_days} onChange={(e) => setExpenseForm({...expenseForm, min_days: parseInt(e.target.value) || 1})} />
                            </div>
                            <Button onClick={handleAddExpenseRate} className="w-full">追加</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {expenseRates.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">登録されている経費率はありません</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2">経費タイプ</th>
                            <th className="text-right py-3 px-2">セラピスト控除/支給</th>
                            <th className="text-right py-3 px-2">店舗収入</th>
                            <th className="text-right py-3 px-2">最低日数</th>
                            {isAdmin && <th className="text-center py-3 px-2">操作</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {expenseRates.map((rate) => {
                            const isEditing = editingExpenseRate?.id === rate.id;
                            return (
                              <tr key={rate.id} className="border-b">
                                <td className="py-3 px-2 font-medium">{rate.expense_type}</td>
                                <td className="text-right py-3 px-2">
                                  {isEditing ? (
                                    <Input type="number" value={editingExpenseRate.therapist_deduction} onChange={(e) => setEditingExpenseRate({...editingExpenseRate, therapist_deduction: parseInt(e.target.value) || 0})} className="w-24 text-right" />
                                  ) : `¥${rate.therapist_deduction.toLocaleString()}`}
                                </td>
                                <td className="text-right py-3 px-2">
                                  {isEditing ? (
                                    <Input type="number" value={editingExpenseRate.shop_income} onChange={(e) => setEditingExpenseRate({...editingExpenseRate, shop_income: parseInt(e.target.value) || 0})} className="w-24 text-right" />
                                  ) : `¥${rate.shop_income.toLocaleString()}`}
                                </td>
                                <td className="text-right py-3 px-2">
                                  {isEditing ? (
                                    <Input type="number" value={editingExpenseRate.min_days ?? 1} onChange={(e) => setEditingExpenseRate({...editingExpenseRate, min_days: parseInt(e.target.value) || 1})} className="w-16 text-right" />
                                  ) : rate.min_days ? `${rate.min_days}日〜` : '-'}
                                </td>
                                {isAdmin && (
                                  <td className="text-center py-3 px-2">
                                    <div className="flex gap-1 justify-center">
                                      {isEditing ? (
                                        <Button onClick={() => handleUpdateExpenseRate(editingExpenseRate)} size="sm"><Save className="h-3 w-3" /></Button>
                                      ) : (
                                        <Button onClick={() => setEditingExpenseRate(rate)} variant="outline" size="sm"><Edit className="h-3 w-3" /></Button>
                                      )}
                                      <Button onClick={() => handleDeleteExpenseRate(rate.id)} variant="destructive" size="sm"><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 決済設定 */}
            <TabsContent value="payments">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    決済設定
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    各決済方法の決済リンクと手数料率を設定してください。
                  </p>
                  {paymentSettings.map((p) => {
                    const draft = paymentDrafts[p.id] ?? { payment_link: "", fee_percentage: "0" };
                    return (
                      <div key={p.id} className="border rounded-lg p-4 space-y-3">
                        <div className="font-semibold text-base flex items-center gap-2">
                          {p.payment_method === "PayPay" ? (
                            <Wallet className="h-4 w-4" />
                          ) : (
                            <CreditCard className="h-4 w-4" />
                          )}
                          {p.payment_method}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <Label className="text-xs">決済リンク</Label>
                            <Input
                              type="url"
                              placeholder="https://..."
                              value={draft.payment_link}
                              onChange={(e) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: { ...draft, payment_link: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">手数料 (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={draft.fee_percentage}
                              onChange={(e) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: { ...draft, fee_percentage: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              className="w-full"
                              disabled={savingPaymentId === p.id || !isAdmin}
                              onClick={() => handleSavePaymentSetting(p.id)}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              {savingPaymentId === p.id ? "保存中..." : "保存"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {paymentSettings.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      決済設定が見つかりません
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
