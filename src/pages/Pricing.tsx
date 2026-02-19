import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, X, Save } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface BackRate {
  id: string;
  course_type: string;
  duration: number;
  customer_price: number;
  therapist_back: number;
  shop_back: number;
}

interface OptionRate {
  id: string;
  option_name: string;
  customer_price: number;
  therapist_back: number;
  shop_back: number | null;
}

interface NominationRate {
  id: string;
  nomination_type: string;
  customer_price: number;
  therapist_back: number | null;
  shop_back: number | null;
}

export default function Pricing() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<BackRate>>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptionValues, setEditOptionValues] = useState<Partial<OptionRate>>({});
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [isAddNominationOpen, setIsAddNominationOpen] = useState(false);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);

  const [courseForm, setCourseForm] = useState({ course_type: "", duration: 60, customer_price: 0, therapist_back: 0, shop_back: 0 });
  const [optionForm, setOptionForm] = useState({ option_name: "", customer_price: 0, therapist_back: 0, shop_back: 0 });
  const [nominationForm, setNominationForm] = useState({ nomination_type: "", customer_price: 0, therapist_back: 0, shop_back: 0 });

  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [backRes, optionRes, nomRes] = await Promise.all([
        supabase.from('back_rates').select('*').order('course_type').order('duration', { ascending: true }),
        supabase.from('option_rates').select('*').order('created_at', { ascending: true }),
        supabase.from('nomination_rates').select('*').order('created_at', { ascending: true }),
      ]);
      if (backRes.error) throw backRes.error;
      if (optionRes.error) throw optionRes.error;
      if (nomRes.error) throw nomRes.error;
      setBackRates(backRes.data || []);
      setOptionRates(optionRes.data || []);
      setNominationRates(nomRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: "エラー", description: "データの取得に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBackRate = async (id: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('back_rates').update(editValues).eq('id', id);
      if (error) throw error;
      toast({ title: "更新完了", description: "料金を更新しました" });
      setEditingId(null);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "更新に失敗しました", variant: "destructive" });
    }
  };

  const handleDeleteBackRate = async (id: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('back_rates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "削除完了" });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "削除に失敗しました", variant: "destructive" });
    }
  };

  const handleAddCourse = async () => {
    if (!isAdmin || !courseForm.course_type || courseForm.customer_price <= 0) return;
    try {
      const { error } = await supabase.from('back_rates').insert(courseForm);
      if (error) throw error;
      toast({ title: "追加完了" });
      setIsAddCourseOpen(false);
      setCourseForm({ course_type: "", duration: 60, customer_price: 0, therapist_back: 0, shop_back: 0 });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "追加に失敗しました", variant: "destructive" });
    }
  };

  const handleUpdateOptionRate = async (id: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('option_rates').update(editOptionValues).eq('id', id);
      if (error) throw error;
      toast({ title: "更新完了" });
      setEditingOptionId(null);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "更新に失敗しました", variant: "destructive" });
    }
  };

  const handleAddOption = async () => {
    if (!isAdmin || !optionForm.option_name || optionForm.customer_price <= 0) return;
    try {
      const { error } = await supabase.from('option_rates').insert(optionForm);
      if (error) throw error;
      toast({ title: "追加完了" });
      setIsAddOptionOpen(false);
      setOptionForm({ option_name: "", customer_price: 0, therapist_back: 0, shop_back: 0 });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "追加に失敗しました", variant: "destructive" });
    }
  };

  const handleDeleteOption = async (id: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('option_rates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "削除完了" });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "削除に失敗しました", variant: "destructive" });
    }
  };

  const handleAddNomination = async () => {
    if (!isAdmin || !nominationForm.nomination_type || nominationForm.customer_price <= 0) return;
    try {
      const { error } = await supabase.from('nomination_rates').insert(nominationForm);
      if (error) throw error;
      toast({ title: "追加完了" });
      setIsAddNominationOpen(false);
      setNominationForm({ nomination_type: "", customer_price: 0, therapist_back: 0, shop_back: 0 });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "追加に失敗しました", variant: "destructive" });
    }
  };

  const handleDeleteNomination = async (id: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('nomination_rates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "削除完了" });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "削除に失敗しました", variant: "destructive" });
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-lg">読み込み中...</div></div>;
  }
  if (!user) return null;

  const courseTypes = [...new Set(backRates.map(r => r.course_type))];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 p-6 md:ml-[240px]">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">料金設定（マスター）</h1>
                <p className="text-muted-foreground">ここで設定した料金がフロント予約・料金ページ・管理画面すべてに反映されます</p>
              </div>
            </div>

            {/* コース料金 */}
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>コース料金・バック率</CardTitle>
                {isAdmin && (
                  <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus size={16} />コース追加</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>新しいコースを追加</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>コースタイプ</Label>
                          <Input value={courseForm.course_type} onChange={(e) => setCourseForm({ ...courseForm, course_type: e.target.value })} placeholder="アロマオイル" />
                        </div>
                        <div>
                          <Label>時間（分）</Label>
                          <Input type="number" value={courseForm.duration} onChange={(e) => setCourseForm({ ...courseForm, duration: parseInt(e.target.value) })} />
                        </div>
                        <div>
                          <Label>お客様料金</Label>
                          <Input type="number" value={courseForm.customer_price} onChange={(e) => setCourseForm({ ...courseForm, customer_price: parseInt(e.target.value) })} />
                        </div>
                        <div>
                          <Label>セラピストバック</Label>
                          <Input type="number" value={courseForm.therapist_back} onChange={(e) => setCourseForm({ ...courseForm, therapist_back: parseInt(e.target.value) })} />
                        </div>
                        <div>
                          <Label>店バック</Label>
                          <Input type="number" value={courseForm.shop_back} onChange={(e) => setCourseForm({ ...courseForm, shop_back: parseInt(e.target.value) })} />
                        </div>
                        <Button onClick={handleAddCourse} className="w-full">追加</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {courseTypes.map((type) => (
                  <div key={type} className="mb-6">
                    <h3 className="font-semibold text-lg mb-2">{type}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">時間</th>
                            <th className="text-right py-2 px-2">お客様料金</th>
                            <th className="text-right py-2 px-2">セラピストバック</th>
                            <th className="text-right py-2 px-2">店バック</th>
                            <th className="text-right py-2 px-2">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backRates.filter(r => r.course_type === type).map((rate) => (
                            <tr key={rate.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2">{rate.duration}分</td>
                              <td className="py-3 px-2 text-right">
                                {editingId === rate.id ? (
                                  <Input type="number" className="w-24 ml-auto" defaultValue={rate.customer_price}
                                    onChange={(e) => setEditValues({ ...editValues, customer_price: parseInt(e.target.value) })} />
                                ) : `¥${rate.customer_price.toLocaleString()}`}
                              </td>
                              <td className="py-3 px-2 text-right">
                                {editingId === rate.id ? (
                                  <Input type="number" className="w-24 ml-auto" defaultValue={rate.therapist_back}
                                    onChange={(e) => setEditValues({ ...editValues, therapist_back: parseInt(e.target.value) })} />
                                ) : `¥${rate.therapist_back.toLocaleString()}`}
                              </td>
                              <td className="py-3 px-2 text-right">
                                {editingId === rate.id ? (
                                  <Input type="number" className="w-24 ml-auto" defaultValue={rate.shop_back}
                                    onChange={(e) => setEditValues({ ...editValues, shop_back: parseInt(e.target.value) })} />
                                ) : `¥${rate.shop_back.toLocaleString()}`}
                              </td>
                              <td className="py-3 px-2 text-right">
                                {isAdmin && (
                                  editingId === rate.id ? (
                                    <div className="flex gap-1 justify-end">
                                      <Button size="sm" variant="ghost" onClick={() => handleUpdateBackRate(rate.id)}><Save size={14} /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X size={14} /></Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1 justify-end">
                                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(rate.id); setEditValues(rate); }}><Edit size={14} /></Button>
                                      <Button size="sm" variant="ghost" className="hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDeleteBackRate(rate.id)}><Trash2 size={14} /></Button>
                                    </div>
                                  )
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* オプション */}
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>オプション料金</CardTitle>
                {isAdmin && (
                  <Dialog open={isAddOptionOpen} onOpenChange={setIsAddOptionOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus size={16} />オプション追加</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>新しいオプションを追加</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div><Label>オプション名</Label><Input value={optionForm.option_name} onChange={(e) => setOptionForm({ ...optionForm, option_name: e.target.value })} /></div>
                        <div><Label>お客様料金</Label><Input type="number" value={optionForm.customer_price} onChange={(e) => setOptionForm({ ...optionForm, customer_price: parseInt(e.target.value) })} /></div>
                        <div><Label>セラピストバック</Label><Input type="number" value={optionForm.therapist_back} onChange={(e) => setOptionForm({ ...optionForm, therapist_back: parseInt(e.target.value) })} /></div>
                        <div><Label>店バック</Label><Input type="number" value={optionForm.shop_back} onChange={(e) => setOptionForm({ ...optionForm, shop_back: parseInt(e.target.value) })} /></div>
                        <Button onClick={handleAddOption} className="w-full">追加</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">オプション名</th>
                        <th className="text-right py-2 px-2">お客様料金</th>
                        <th className="text-right py-2 px-2">セラピストバック</th>
                        <th className="text-right py-2 px-2">店バック</th>
                        <th className="text-right py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optionRates.map((opt) => (
                        <tr key={opt.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{opt.option_name}</td>
                          <td className="py-3 px-2 text-right">
                            {editingOptionId === opt.id ? (
                              <Input type="number" className="w-24 ml-auto" defaultValue={opt.customer_price}
                                onChange={(e) => setEditOptionValues({ ...editOptionValues, customer_price: parseInt(e.target.value) })} />
                            ) : `¥${opt.customer_price.toLocaleString()}`}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {editingOptionId === opt.id ? (
                              <Input type="number" className="w-24 ml-auto" defaultValue={opt.therapist_back}
                                onChange={(e) => setEditOptionValues({ ...editOptionValues, therapist_back: parseInt(e.target.value) })} />
                            ) : `¥${opt.therapist_back.toLocaleString()}`}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {editingOptionId === opt.id ? (
                              <Input type="number" className="w-24 ml-auto" defaultValue={opt.shop_back || 0}
                                onChange={(e) => setEditOptionValues({ ...editOptionValues, shop_back: parseInt(e.target.value) })} />
                            ) : `¥${(opt.shop_back || 0).toLocaleString()}`}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {isAdmin && (
                              editingOptionId === opt.id ? (
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => handleUpdateOptionRate(opt.id)}><Save size={14} /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingOptionId(null)}><X size={14} /></Button>
                                </div>
                              ) : (
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingOptionId(opt.id); setEditOptionValues(opt); }}><Edit size={14} /></Button>
                                  <Button size="sm" variant="ghost" className="hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDeleteOption(opt.id)}><Trash2 size={14} /></Button>
                                </div>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 指名料 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>指名料</CardTitle>
                {isAdmin && (
                  <Dialog open={isAddNominationOpen} onOpenChange={setIsAddNominationOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus size={16} />指名料追加</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>新しい指名料を追加</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div><Label>指名タイプ</Label><Input value={nominationForm.nomination_type} onChange={(e) => setNominationForm({ ...nominationForm, nomination_type: e.target.value })} /></div>
                        <div><Label>お客様料金</Label><Input type="number" value={nominationForm.customer_price} onChange={(e) => setNominationForm({ ...nominationForm, customer_price: parseInt(e.target.value) })} /></div>
                        <div><Label>セラピストバック</Label><Input type="number" value={nominationForm.therapist_back} onChange={(e) => setNominationForm({ ...nominationForm, therapist_back: parseInt(e.target.value) })} /></div>
                        <div><Label>店バック</Label><Input type="number" value={nominationForm.shop_back} onChange={(e) => setNominationForm({ ...nominationForm, shop_back: parseInt(e.target.value) })} /></div>
                        <Button onClick={handleAddNomination} className="w-full">追加</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">指名タイプ</th>
                        <th className="text-right py-2 px-2">お客様料金</th>
                        <th className="text-right py-2 px-2">セラピストバック</th>
                        <th className="text-right py-2 px-2">店バック</th>
                        <th className="text-right py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nominationRates.map((nom) => (
                        <tr key={nom.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{nom.nomination_type}</td>
                          <td className="py-3 px-2 text-right">¥{nom.customer_price.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">¥{(nom.therapist_back || 0).toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">¥{(nom.shop_back || 0).toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">
                            {isAdmin && (
                              <Button size="sm" variant="ghost" className="hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDeleteNomination(nom.id)}>
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}