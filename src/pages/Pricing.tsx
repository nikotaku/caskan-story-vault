import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface PricingItem {
  id: string;
  duration: number;
  standard_price: number;
  premium_price: number;
  vip_price: number;
}

interface PricingOption {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

export default function Pricing() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [options, setOptions] = useState<PricingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  
  const [optionForm, setOptionForm] = useState({
    name: "",
    price: 0,
    description: "",
  });

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
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [pricingResult, optionsResult] = await Promise.all([
        supabase.from('pricing').select('*').order('duration', { ascending: true }),
        supabase.from('pricing_options').select('*').order('created_at', { ascending: true })
      ]);

      if (pricingResult.error) throw pricingResult.error;
      if (optionsResult.error) throw optionsResult.error;

      setPricing(pricingResult.data || []);
      setOptions(optionsResult.data || []);
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast({
        title: "エラー",
        description: "料金情報の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (id: string, field: string, value: number) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ料金を変更できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      setPricing(pricing.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      ));

      toast({
        title: "料金更新",
        description: "料金が更新されました",
      });
    } catch (error) {
      console.error('Error updating price:', error);
      toast({
        title: "エラー",
        description: "料金の更新に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleAddOption = async () => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみオプションを追加できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pricing_options')
        .insert([{
          name: optionForm.name,
          price: optionForm.price,
          description: optionForm.description || null,
        }])
        .select()
        .single();

      if (error) throw error;

      setOptions([...options, data]);
      setIsAddOptionOpen(false);
      setOptionForm({ name: "", price: 0, description: "" });

      toast({
        title: "オプション追加",
        description: "オプションが追加されました",
      });
    } catch (error) {
      console.error('Error adding option:', error);
      toast({
        title: "エラー",
        description: "オプションの追加に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOption = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみオプションを削除できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing_options')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOptions(options.filter(o => o.id !== id));

      toast({
        title: "オプション削除",
        description: "オプションが削除されました",
      });
    } catch (error) {
      console.error('Error deleting option:', error);
      toast({
        title: "エラー",
        description: "オプションの削除に失敗しました",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-6 md:ml-[240px]">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">料金設定</h1>
                <p className="text-muted-foreground">コース料金とオプション料金の管理</p>
              </div>
            </div>

            {/* Base Pricing Table */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>基本料金</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">コース時間</th>
                        <th className="text-right py-3 px-4">スタンダード</th>
                        <th className="text-right py-3 px-4">プレミアム</th>
                        <th className="text-right py-3 px-4">VIP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricing.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="py-4 px-4 font-medium">{item.duration}分</td>
                          <td className="py-4 px-4 text-right">
                            {editingId === item.id ? (
                              <Input
                                type="number"
                                defaultValue={item.standard_price}
                                onBlur={(e) => handleUpdatePrice(item.id, 'standard_price', parseInt(e.target.value))}
                                className="w-32 ml-auto"
                              />
                            ) : (
                              <span>¥{item.standard_price.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {editingId === item.id ? (
                              <Input
                                type="number"
                                defaultValue={item.premium_price}
                                onBlur={(e) => handleUpdatePrice(item.id, 'premium_price', parseInt(e.target.value))}
                                className="w-32 ml-auto"
                              />
                            ) : (
                              <span>¥{item.premium_price.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right flex items-center justify-end gap-2">
                            {editingId === item.id ? (
                              <>
                                <Input
                                  type="number"
                                  defaultValue={item.vip_price}
                                  onBlur={(e) => handleUpdatePrice(item.id, 'vip_price', parseInt(e.target.value))}
                                  className="w-32"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X size={16} />
                                </Button>
                              </>
                            ) : (
                              <>
                                <span>¥{item.vip_price.toLocaleString()}</span>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingId(item.id)}
                                  >
                                    <Edit size={16} />
                                  </Button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>オプション料金</CardTitle>
                {isAdmin && (
                  <Dialog open={isAddOptionOpen} onOpenChange={setIsAddOptionOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus size={16} />
                        オプション追加
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>新しいオプションを追加</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="option-name">オプション名</Label>
                          <Input
                            id="option-name"
                            value={optionForm.name}
                            onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                            placeholder="指名料など"
                          />
                        </div>
                        <div>
                          <Label htmlFor="option-price">料金</Label>
                          <Input
                            id="option-price"
                            type="number"
                            value={optionForm.price}
                            onChange={(e) => setOptionForm({ ...optionForm, price: parseInt(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="option-description">説明（任意）</Label>
                          <Textarea
                            id="option-description"
                            value={optionForm.description}
                            onChange={(e) => setOptionForm({ ...optionForm, description: e.target.value })}
                            rows={2}
                          />
                        </div>
                        <Button onClick={handleAddOption} className="w-full">
                          追加
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {options.map((option) => (
                    <div key={option.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50">
                      <div>
                        <div className="font-medium">{option.name}</div>
                        {option.description && (
                          <div className="text-sm text-muted-foreground">{option.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-primary font-bold">¥{option.price.toLocaleString()}</span>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteOption(option.id)}
                            className="hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
