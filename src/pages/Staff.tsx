import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Search, Filter, Star, Camera, Clock, TrendingUp } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { NotionSync } from "@/components/NotionSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Cast {
  id: string;
  name: string;
  type: string;
  status: string;
  photo: string | null;
  photos: string[] | null;
  profile: string | null;
  room: string | null;
  execution_date_start: string | null;
  execution_date_end: string | null;
  hp_notice: string | null;
  upload_check: string | null;
  x_account: string | null;
  join_date: string;
}

export default function Staff() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // フォーム用の状態
  const [formData, setFormData] = useState({
    name: "",
    type: "インルーム",
    room: "インルーム",
    status: "未着手",
    profile: "",
    photo: "",
  });
  
  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // キャストデータを取得
  useEffect(() => {
    fetchCasts();
    
    // リアルタイム更新を購読
    const channel = supabase
      .channel('casts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'casts'
        },
        () => {
          fetchCasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from('casts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCasts((data || []) as Cast[]);
    } catch (error) {
      console.error('Error fetching casts:', error);
      toast({
        title: "エラー",
        description: "キャスト情報の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCasts = casts.filter(cast => {
    const matchesSearch = cast.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || cast.type === filterType;
    const matchesStatus = filterStatus === "all" || cast.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleAddCast = async () => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみキャストを追加できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('casts')
        .insert([{
          name: formData.name,
          type: formData.type,
          room: formData.room,
          status: formData.status,
          profile: formData.profile,
          photo: formData.photo || null,
        }]);

      if (error) throw error;

      toast({
        title: "キャスト追加",
        description: "新しいキャストが追加されました",
      });
      
      setIsAddDialogOpen(false);
      setFormData({
        name: "",
        type: "インルーム",
        room: "インルーム",
        status: "未着手",
        profile: "",
        photo: "",
      });
    } catch (error) {
      console.error('Error adding cast:', error);
      toast({
        title: "エラー",
        description: "キャストの追加に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCast = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみキャストを削除できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('casts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "キャスト削除",
        description: "キャストが削除されました",
      });
    } catch (error) {
      console.error('Error deleting cast:', error);
      toast({
        title: "エラー",
        description: "キャストの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみステータスを変更できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('casts')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      const statusText = newStatus;
      toast({
        title: "ステータス変更",
        description: `ステータスを「${statusText}」に変更しました`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "エラー",
        description: "ステータスの変更に失敗しました",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "派遣中": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "リピート予定": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "残タスク": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "未着手": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
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
                <h1 className="text-2xl font-bold">キャスト管理</h1>
                <p className="text-muted-foreground">キャストの登録・管理・ステータス確認</p>
              </div>
              
              {isAdmin && (
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus size={16} />
                      新規追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>新しいキャストを追加</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">セラピスト名</Label>
                        <Input 
                          id="name" 
                          placeholder="名前を入力"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="room">ルーム</Label>
                          <Select 
                            value={formData.room}
                            onValueChange={(value) => setFormData({...formData, room: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="ルームを選択" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="インルーム">インルーム</SelectItem>
                              <SelectItem value="ラスルーム">ラスルーム</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="status">ステータス</Label>
                          <Select 
                            value={formData.status}
                            onValueChange={(value) => setFormData({...formData, status: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="ステータスを選択" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="派遣中">派遣中</SelectItem>
                              <SelectItem value="リピート予定">リピート予定</SelectItem>
                              <SelectItem value="残タスク">残タスク</SelectItem>
                              <SelectItem value="未着手">未着手</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="profile">プロフィール</Label>
                        <Textarea 
                          id="profile" 
                          rows={3} 
                          placeholder="キャストの魅力や特徴を入力..."
                          value={formData.profile}
                          onChange={(e) => setFormData({...formData, profile: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="photo">写真URL</Label>
                        <Input 
                          id="photo" 
                          placeholder="https://..."
                          value={formData.photo}
                          onChange={(e) => setFormData({...formData, photo: e.target.value})}
                        />
                      </div>
                      
                      <Button onClick={handleAddCast} className="w-full">
                        追加
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Notion Sync */}
            {isAdmin && (
              <div className="mb-6">
                <NotionSync />
              </div>
            )}

            {/* Search and Filter */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="キャスト名で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全タイプ</SelectItem>
                      <SelectItem value="インルーム">インルーム</SelectItem>
                      <SelectItem value="ラスルーム">ラスルーム</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全ステータス</SelectItem>
                      <SelectItem value="派遣中">派遣中</SelectItem>
                      <SelectItem value="リピート予定">リピート予定</SelectItem>
                      <SelectItem value="残タスク">残タスク</SelectItem>
                      <SelectItem value="未着手">未着手</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Cast List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCasts.map((cast) => (
                <Card key={cast.id} className="overflow-hidden">
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                    {cast.photo ? (
                      <img 
                        src={cast.photo} 
                        alt={cast.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera size={48} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className={getStatusColor(cast.status)}>
                        {cast.status}
                      </Badge>
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary">{cast.room || cast.type}</Badge>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {cast.name}
                        </CardTitle>
                        {cast.room && <p className="text-sm text-muted-foreground">{cast.room}</p>}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {cast.profile}
                      </p>
                      
                      {(cast.execution_date_start || cast.execution_date_end) && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {cast.execution_date_start && (
                            <div className="flex items-center gap-1">
                              <Clock size={12} />
                              <span>開始: {new Date(cast.execution_date_start).toLocaleDateString('ja-JP')}</span>
                            </div>
                          )}
                          {cast.execution_date_end && (
                            <div className="flex items-center gap-1">
                              <Clock size={12} />
                              <span>終了: {new Date(cast.execution_date_end).toLocaleDateString('ja-JP')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Status Change Buttons */}
                    {isAdmin && (
                      <>
                        <div className="flex gap-1 mt-4">
                          <Button 
                            variant={cast.status === "waiting" ? "default" : "outline"}
                            size="sm" 
                            onClick={() => handleStatusChange(cast.id, "waiting")}
                            className="flex-1 text-xs"
                            disabled={cast.status === "waiting"}
                          >
                            待機
                          </Button>
                          <Button 
                            variant={cast.status === "busy" ? "default" : "outline"}
                            size="sm" 
                            onClick={() => handleStatusChange(cast.id, "busy")}
                            className="flex-1 text-xs"
                            disabled={cast.status === "busy"}
                          >
                            接客
                          </Button>
                          <Button 
                            variant={cast.status === "offline" ? "default" : "outline"}
                            size="sm" 
                            onClick={() => handleStatusChange(cast.id, "offline")}
                            className="flex-1 text-xs"
                            disabled={cast.status === "offline"}
                          >
                            退勤
                          </Button>
                        </div>
                        
                        <div className="flex gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => toast({
                              title: "編集機能",
                              description: "編集機能は近日実装予定です",
                            })}
                            className="flex-1"
                          >
                            <Edit size={14} />
                            編集
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteCast(cast.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredCasts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {casts.length === 0 
                  ? "キャストが登録されていません" 
                  : "検索条件に一致するキャストが見つかりません"}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
