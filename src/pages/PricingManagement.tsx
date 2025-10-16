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
}

interface PricingOption {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

export default function PricingManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<PricingCourse[]>([]);
  const [options, setOptions] = useState<PricingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState<PricingCourse | null>(null);
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
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
      fetchPricing();
      fetchOptions();
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
      const { error } = await supabase
        .from('pricing_options')
        .insert([{
          name: optionForm.name,
          price: optionForm.price,
          description: optionForm.description || null,
        }]);

      if (error) throw error;

      toast({
        title: "追加完了",
        description: "オプションを追加しました",
      });
      
      setIsAddOptionOpen(false);
      setOptionForm({ name: "", price: 0, description: "" });
      fetchOptions();
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

      toast({
        title: "削除完了",
        description: "オプションを削除しました",
      });
      
      setDeleteConfirmId(null);
      fetchOptions();
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
                <p className="text-muted-foreground">コース料金とオプションの管理</p>
              </div>
            </div>

            {/* Course Pricing */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign size={20} />
                  コース料金
                </CardTitle>
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
                        <th className="text-center py-3 px-4">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr key={course.id} className="border-b hover:bg-muted/50">
                          <td className="py-4 px-4 font-medium">{course.duration}分</td>
                          {editingCourse?.id === course.id ? (
                            <>
                              <td className="py-4 px-4">
                                <Input
                                  type="number"
                                  value={editingCourse.standard_price}
                                  onChange={(e) => setEditingCourse({
                                    ...editingCourse,
                                    standard_price: parseInt(e.target.value)
                                  })}
                                  className="w-32 text-right"
                                />
                              </td>
                              <td className="py-4 px-4">
                                <Input
                                  type="number"
                                  value={editingCourse.premium_price}
                                  onChange={(e) => setEditingCourse({
                                    ...editingCourse,
                                    premium_price: parseInt(e.target.value)
                                  })}
                                  className="w-32 text-right"
                                />
                              </td>
                              <td className="py-4 px-4">
                                <Input
                                  type="number"
                                  value={editingCourse.vip_price}
                                  onChange={(e) => setEditingCourse({
                                    ...editingCourse,
                                    vip_price: parseInt(e.target.value)
                                  })}
                                  className="w-32 text-right"
                                />
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateCourse(editingCourse)}
                                  >
                                    <Save size={14} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingCourse(null)}
                                  >
                                    キャンセル
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-4 px-4 text-right">¥{course.standard_price.toLocaleString()}</td>
                              <td className="py-4 px-4 text-right">¥{course.premium_price.toLocaleString()}</td>
                              <td className="py-4 px-4 text-right">¥{course.vip_price.toLocaleString()}</td>
                              <td className="py-4 px-4">
                                {isAdmin && (
                                  <div className="flex justify-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingCourse(course)}
                                    >
                                      <Edit size={14} />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                            <Label htmlFor="option-price">料金（円）</Label>
                            <Input
                              id="option-price"
                              type="number"
                              value={optionForm.price}
                              onChange={(e) => setOptionForm({...optionForm, price: parseInt(e.target.value)})}
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
                  {options.map((option) => (
                    <div key={option.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="font-medium">{option.name}</div>
                        {option.description && (
                          <div className="text-sm text-muted-foreground">{option.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-bold">¥{option.price.toLocaleString()}</div>
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