import { useState, useEffect } from "react";
import { DollarSign, Plus, Edit, Trash2, Save } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export default function PricingManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<PricingCourse[]>([]);
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [options, setOptions] = useState<PricingOption[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState<PricingCourse | null>(null);
  const [editingBackRate, setEditingBackRate] = useState<BackRate | null>(null);
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [isAddNominationOpen, setIsAddNominationOpen] = useState(false);
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
    }
  }, [user]);

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing')
        .select('*')
        .order('duration', { ascending: true });

      if (error) throw error;
      setCourses(data || []);
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

  const fetchBackRates = async () => {
    try {
      const { data, error } = await supabase
        .from('back_rates')
        .select('*')
        .order('duration', { ascending: true });

      if (error) throw error;
      setBackRates(data || []);
    } catch (error) {
      console.error('Error fetching back rates:', error);
    }
  };

  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_options')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const fetchOptionRates = async () => {
    try {
      const { data, error } = await supabase
        .from('option_rates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOptionRates(data || []);
    } catch (error) {
      console.error('Error fetching option rates:', error);
    }
  };

  const fetchNominationRates = async () => {
    try {
      const { data, error } = await supabase
        .from('nomination_rates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setNominationRates(data || []);
    } catch (error) {
      console.error('Error fetching nomination rates:', error);
    }
  };

  const handleUpdateCourse = async (course: PricingCourse) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ料金を更新できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing')
        .update({
          standard_price: course.standard_price,
          premium_price: course.premium_price,
          vip_price: course.vip_price,
        })
        .eq('id', course.id);

      if (error) throw error;

      toast({
        title: "更新完了",
        description: "料金を更新しました",
      });
      
      setEditingCourse(null);
      fetchPricing();
    } catch (error) {
      console.error('Error updating course:', error);
      toast({
        title: "エラー",
        description: "料金の更新に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleUpdateBackRate = async (backRate: BackRate) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみバック率を更新できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('back_rates')
        .update({
          therapist_back: backRate.therapist_back,
          shop_back: backRate.shop_back,
        })
        .eq('id', backRate.id);

      if (error) throw error;

      toast({
        title: "更新完了",
        description: "バック率を更新しました",
      });
      
      setEditingBackRate(null);
      fetchBackRates();
    } catch (error) {
      console.error('Error updating back rate:', error);
      toast({
        title: "エラー",
        description: "バック率の更新に失敗しました",
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

    if (!optionForm.name || optionForm.price <= 0) {
      toast({
        title: "入力エラー",
        description: "すべての項目を正しく入力してください",
        variant: "destructive",
      });
      return;
    }

    try {
      // Insert into pricing_options
      const { error: optionError } = await supabase
        .from('pricing_options')
        .insert({
          name: optionForm.name,
          price: optionForm.price,
          description: optionForm.description || null,
        });

      if (optionError) throw optionError;

      // Insert into option_rates
      const { error: rateError } = await supabase
        .from('option_rates')
        .insert({
          option_name: optionForm.name,
          customer_price: optionForm.price,
          therapist_back: optionForm.therapist_back,
          shop_back: optionForm.shop_back,
        });

      if (rateError) throw rateError;

      toast({
        title: "追加完了",
        description: "オプションとバック率を追加しました",
      });
      
      setIsAddOptionOpen(false);
      setOptionForm({ name: "", price: 0, therapist_back: 0, shop_back: 0, description: "" });
      fetchOptions();
      fetchOptionRates();
    } catch (error) {
      console.error('Error adding option:', error);
      toast({
        title: "エラー",
        description: "オプションの追加に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleAddNomination = async () => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ指名料を追加できます",
        variant: "destructive",
      });
      return;
    }

    if (!nominationForm.nomination_type || nominationForm.customer_price <= 0) {
      toast({
        title: "入力エラー",
        description: "すべての項目を正しく入力してください",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('nomination_rates')
        .insert({
          nomination_type: nominationForm.nomination_type,
          customer_price: nominationForm.customer_price,
          therapist_back: nominationForm.therapist_back,
          shop_back: nominationForm.shop_back,
        });

      if (error) throw error;

      toast({
        title: "追加完了",
        description: "指名料を追加しました",
      });
      
      setIsAddNominationOpen(false);
      setNominationForm({ nomination_type: "", customer_price: 0, therapist_back: 0, shop_back: 0 });
      fetchNominationRates();
    } catch (error) {
      console.error('Error adding nomination:', error);
      toast({
        title: "エラー",
        description: "指名料の追加に失敗しました",
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
      // Get option name first
      const option = options.find(opt => opt.id === id);
      if (!option) return;

      // Delete from pricing_options
      const { error: optionError } = await supabase
        .from('pricing_options')
        .delete()
        .eq('id', id);

      if (optionError) throw optionError;

      // Delete from option_rates
      const { error: rateError } = await supabase
        .from('option_rates')
        .delete()
        .eq('option_name', option.name);

      if (rateError) throw rateError;

      toast({
        title: "削除完了",
        description: "オプションとバック率を削除しました",
      });
      
      setDeleteConfirmId(null);
      fetchOptions();
      fetchOptionRates();
    } catch (error) {
      console.error('Error deleting option:', error);
      toast({
        title: "エラー",
        description: "オプションの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNomination = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ指名料を削除できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('nomination_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "削除完了",
        description: "指名料を削除しました",
      });
      
      fetchNominationRates();
    } catch (error) {
      console.error('Error deleting nomination:', error);
      toast({
        title: "エラー",
        description: "指名料の削除に失敗しました",
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
                <p className="text-muted-foreground">コース料金とオプションの管理</p>
              </div>
            </div>

            {/* Course Pricing and Back Rates */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-6 w-6" />
                  コース料金・バック率管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>読み込み中...</p>
                ) : (
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
                          const backRate = backRates.find(
                            r => r.duration === course.duration && r.course_type === course.course_type
                          );
                          const isEditingBack = editingBackRate?.id === backRate?.id;
                          
                          return (
                            <tr key={course.id} className="border-b">
                              <td className="py-3 px-2">{course.duration}分</td>
                              <td className="py-3 px-2">{course.course_type}</td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    value={editingCourse.standard_price}
                                    onChange={(e) =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        standard_price: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    className="w-20 text-right"
                                  />
                                ) : (
                                  `¥${course.standard_price.toLocaleString()}`
                                )}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    value={editingCourse.premium_price}
                                    onChange={(e) =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        premium_price: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    className="w-20 text-right"
                                  />
                                ) : (
                                  `¥${course.premium_price.toLocaleString()}`
                                )}
                              </td>
                              <td className="text-right py-3 px-2">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    value={editingCourse.vip_price}
                                    onChange={(e) =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        vip_price: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    className="w-20 text-right"
                                  />
                                ) : (
                                  `¥${course.vip_price.toLocaleString()}`
                                )}
                              </td>
                              <td className="text-right py-3 px-2">
                                {backRate ? (
                                  isEditingBack ? (
                                    <Input
                                      type="number"
                                      value={editingBackRate.therapist_back}
                                      onChange={(e) =>
                                        setEditingBackRate({
                                          ...editingBackRate,
                                          therapist_back: parseInt(e.target.value) || 0,
                                        })
                                      }
                                      className="w-20 text-right"
                                    />
                                  ) : (
                                    `¥${backRate.therapist_back.toLocaleString()}`
                                  )
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="text-right py-3 px-2">
                                {backRate ? (
                                  isEditingBack ? (
                                    <Input
                                      type="number"
                                      value={editingBackRate.shop_back}
                                      onChange={(e) =>
                                        setEditingBackRate({
                                          ...editingBackRate,
                                          shop_back: parseInt(e.target.value) || 0,
                                        })
                                      }
                                      className="w-20 text-right"
                                    />
                                  ) : (
                                    `¥${backRate.shop_back.toLocaleString()}`
                                  )
                                ) : (
                                  '-'
                                )}
                              </td>
                              {isAdmin && (
                                <td className="text-center py-3 px-2">
                                  <div className="flex gap-1 justify-center">
                                    {isEditing ? (
                                      <Button
                                        onClick={() => handleUpdateCourse(editingCourse)}
                                        size="sm"
                                        className="gap-1"
                                      >
                                        <Save className="h-3 w-3" />
                                      </Button>
                                    ) : (
                                      <Button
                                        onClick={() => setEditingCourse(course)}
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {backRate && (
                                      isEditingBack ? (
                                        <Button
                                          onClick={() => handleUpdateBackRate(editingBackRate)}
                                          size="sm"
                                          className="gap-1"
                                        >
                                          <Save className="h-3 w-3" />
                                        </Button>
                                      ) : (
                                        <Button
                                          onClick={() => setEditingBackRate(backRate)}
                                          variant="outline"
                                          size="sm"
                                          className="gap-1"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      )
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
                )}
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Plus size={20} />
                    オプション料金
                  </CardTitle>
                  {isAdmin && (
                    <Dialog open={isAddOptionOpen} onOpenChange={setIsAddOptionOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus size={16} />
                          追加
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>オプション追加</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="option-name">オプション名</Label>
                            <Input
                              id="option-name"
                              value={optionForm.name}
                              onChange={(e) => setOptionForm({...optionForm, name: e.target.value})}
                              placeholder="例：指名料"
                            />
                          </div>
                          <div>
                            <Label htmlFor="option-price">お客様料金（円）</Label>
                            <Input
                              id="option-price"
                              type="number"
                              value={optionForm.price}
                              onChange={(e) => setOptionForm({...optionForm, price: parseInt(e.target.value)})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="therapist-back">セラピストバック（円）</Label>
                            <Input
                              id="therapist-back"
                              type="number"
                              value={optionForm.therapist_back}
                              onChange={(e) => setOptionForm({...optionForm, therapist_back: parseInt(e.target.value)})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="shop-back">店舗バック（円）</Label>
                            <Input
                              id="shop-back"
                              type="number"
                              value={optionForm.shop_back}
                              onChange={(e) => setOptionForm({...optionForm, shop_back: parseInt(e.target.value)})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="option-desc">説明（任意）</Label>
                            <Textarea
                              id="option-desc"
                              value={optionForm.description}
                              onChange={(e) => setOptionForm({...optionForm, description: e.target.value})}
                              placeholder="オプションの詳細説明"
                              rows={3}
                            />
                          </div>
                          <Button onClick={handleAddOption} className="w-full">
                            追加
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {options.map((option) => {
                    const optionRate = optionRates.find(r => r.option_name === option.name);
                    return (
                      <div key={option.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50">
                        <div className="flex-1">
                          <div className="font-medium">{option.name}</div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>お客様料金: ¥{option.price.toLocaleString()}</p>
                            {optionRate && (
                              <>
                                <p>セラピストバック: ¥{optionRate.therapist_back.toLocaleString()}</p>
                                <p>店舗バック: ¥{optionRate.shop_back.toLocaleString()}</p>
                              </>
                            )}
                          </div>
                          {option.description && (
                            <div className="text-sm text-muted-foreground mt-1">{option.description}</div>
                          )}
                        </div>
                        {isAdmin && (
                          deleteConfirmId === option.id ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteOption(option.id)}
                              >
                                確認
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                キャンセル
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteConfirmId(option.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteConfirmId(option.id)}
                              className="hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )
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