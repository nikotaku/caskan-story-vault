import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Search, Filter, Camera, Clock, TrendingUp, Sparkles, Link as LinkIcon, Copy, Upload } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { WebsitePhotoSync } from "@/components/WebsitePhotoSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  access_token: string | null;
  therapist_years: number | null;
  favorite_techniques: string | null;
  favorite_food: string | null;
  ideal_partner: string | null;
  follow_list: string | null;
  media_registration: string[] | null;
  marks: string[] | null;
  files: string[] | null;
  registration_sheet: string | null;
  format_type: string | null;
  recent_dispatch_details: string | null;
  memo: string | null;
  dispatch_status: string | null;
  repeat_scheduled: boolean | null;
}

export default function Staff() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCast, setEditingCast] = useState<Cast | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingContent, setGeneratingContent] = useState(false);
  
  // フォーム用の状態
  const [formData, setFormData] = useState({
    name: "",
    type: "インルーム",
    room: "インルーム",
    status: "未着手",
    profile: "",
    photo: "",
    photos: [] as string[],
    therapist_years: 0,
    favorite_techniques: "",
    favorite_food: "",
    ideal_partner: "",
    follow_list: "",
    media_registration: [] as string[],
    marks: [] as string[],
    files: [] as string[],
    registration_sheet: "",
    format_type: "",
    recent_dispatch_details: "",
    memo: "",
    dispatch_status: "none",
    repeat_scheduled: false,
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
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
          photo: formData.photos[0] || formData.photo || null,
          photos: formData.photos.length > 0 ? formData.photos : null,
          therapist_years: formData.therapist_years || null,
          favorite_techniques: formData.favorite_techniques || null,
          favorite_food: formData.favorite_food || null,
          ideal_partner: formData.ideal_partner || null,
          follow_list: formData.follow_list || null,
          media_registration: formData.media_registration.length > 0 ? formData.media_registration : null,
          marks: formData.marks.length > 0 ? formData.marks : null,
          files: formData.files.length > 0 ? formData.files : null,
          registration_sheet: formData.registration_sheet || null,
          format_type: formData.format_type || null,
          recent_dispatch_details: formData.recent_dispatch_details || null,
          memo: formData.memo || null,
          dispatch_status: formData.dispatch_status || 'none',
          repeat_scheduled: formData.repeat_scheduled || false,
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
        photos: [],
        therapist_years: 0,
        favorite_techniques: "",
        favorite_food: "",
        ideal_partner: "",
        follow_list: "",
        media_registration: [],
        marks: [],
        files: [],
        registration_sheet: "",
        format_type: "",
        recent_dispatch_details: "",
        memo: "",
        dispatch_status: "none",
        repeat_scheduled: false,
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

  const handleEditCast = async (cast: Cast) => {
    console.log('handleEditCast called', { cast, isAdmin });
    
    // 最新のデータを取得してから編集ダイアログを開く
    try {
      const { data, error } = await supabase
        .from('casts')
        .select('*')
        .eq('id', cast.id)
        .single();
      
      if (error) throw error;
      
      setEditingCast(data as Cast);
      setIsEditDialogOpen(true);
      console.log('Dialog opened with latest data:', data);
    } catch (error) {
      console.error('Error fetching latest cast data:', error);
      // エラーの場合は渡されたcastデータを使用
      setEditingCast(cast);
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdateCast = async () => {
    if (!isAdmin || !editingCast) {
      toast({
        title: "権限エラー",
        description: "管理者のみキャストを更新できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const photos = editingCast.photos || [];
      console.log('Updating cast with photos:', photos);
      const { error } = await supabase
        .from('casts')
        .update({
          name: editingCast.name,
          type: editingCast.type,
          room: editingCast.room,
          status: editingCast.status,
          profile: editingCast.profile,
          photo: photos.length > 0 ? photos[0] : null,
          photos: photos.length > 0 ? photos : null,
          x_account: editingCast.x_account || null,
          hp_notice: editingCast.hp_notice || null,
          therapist_years: editingCast.therapist_years || null,
          favorite_techniques: editingCast.favorite_techniques || null,
          favorite_food: editingCast.favorite_food || null,
          ideal_partner: editingCast.ideal_partner || null,
          follow_list: editingCast.follow_list || null,
          media_registration: editingCast.media_registration || null,
          marks: editingCast.marks || null,
          files: editingCast.files || null,
          registration_sheet: editingCast.registration_sheet || null,
          format_type: editingCast.format_type || null,
          recent_dispatch_details: editingCast.recent_dispatch_details || null,
          memo: editingCast.memo || null,
          dispatch_status: editingCast.dispatch_status || 'none',
          repeat_scheduled: editingCast.repeat_scheduled || false,
        })
        .eq('id', editingCast.id);

      if (error) throw error;

      toast({
        title: "キャスト更新",
        description: "キャスト情報が更新されました",
      });
      
      setIsEditDialogOpen(false);
      setEditingCast(null);
    } catch (error) {
      console.error('Error updating cast:', error);
      toast({
        title: "エラー",
        description: "キャストの更新に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleGenerateContent = async (type: 'profile' | 'announcement' | 'catchphrase') => {
    if (!editingCast) return;
    
    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-cast-content', {
        body: {
          type,
          castName: editingCast.name,
          castType: editingCast.type,
          existingProfile: type === 'profile' ? editingCast.profile : null
        }
      });

      if (error) throw error;

      if (data?.content) {
        if (type === 'profile') {
          setEditingCast({ ...editingCast, profile: data.content });
        } else if (type === 'announcement') {
          setEditingCast({ ...editingCast, hp_notice: data.content });
        }
        
        toast({
          title: "AI生成完了",
          description: `${type === 'profile' ? 'プロフィール' : type === 'announcement' ? 'お知らせ' : 'キャッチコピー'}を生成しました`,
        });
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: "エラー",
        description: "コンテンツの生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setGeneratingContent(false);
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

      // ローカルステートから削除されたキャストを除外
      setCasts(prevCasts => prevCasts.filter(cast => cast.id !== id));

      toast({
        title: "キャスト削除",
        description: "キャストが削除されました",
      });
      
      setDeleteConfirmId(null);
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

  const generateAccessToken = async (castId: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみトークンを生成できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from('casts')
        .update({ access_token: token })
        .eq('id', castId);

      if (error) throw error;

      toast({
        title: "トークン生成完了",
        description: "専用リンクが生成されました",
      });
    } catch (error) {
      console.error('Error generating token:', error);
      toast({
        title: "エラー",
        description: "トークンの生成に失敗しました",
        variant: "destructive",
      });
    }
  };

  const copyPortalLink = (token: string) => {
    const link = `${window.location.origin}/therapist/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "リンクをコピーしました",
      description: "専用ページのリンクがクリップボードにコピーされました",
    });
  };

  const handlePhotoUpload = async (file: File, isEdit: boolean = false) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ写真をアップロードできます",
        variant: "destructive",
      });
      return;
    }

    const currentPhotos = isEdit && editingCast ? (editingCast.photos || []) : formData.photos;
    
    if (currentPhotos.length >= 5) {
      toast({
        title: "アップロード制限",
        description: "写真は最大5枚までアップロードできます",
        variant: "destructive",
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('Uploading photo:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('cast-photos')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('cast-photos')
        .getPublicUrl(filePath);

      console.log('Photo uploaded successfully:', publicUrl);

      if (isEdit && editingCast) {
        const updatedPhotos = [...currentPhotos, publicUrl];
        setEditingCast({ 
          ...editingCast, 
          photos: updatedPhotos,
          photo: updatedPhotos[0]
        });
      } else {
        const updatedPhotos = [...currentPhotos, publicUrl];
        setFormData({ 
          ...formData, 
          photos: updatedPhotos,
          photo: updatedPhotos[0]
        });
      }

      // ファイル入力をリセット
      if (isEdit && editFileInputRef.current) {
        editFileInputRef.current.value = '';
      } else if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast({
        title: "アップロード完了",
        description: `写真がアップロードされました (${currentPhotos.length + 1}/5)`,
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "写真のアップロードに失敗しました",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number, isEdit: boolean = false) => {
    if (isEdit && editingCast) {
      const updatedPhotos = (editingCast.photos || []).filter((_, i) => i !== index);
      setEditingCast({ 
        ...editingCast, 
        photos: updatedPhotos,
        photo: updatedPhotos[0] || null
      });
    } else {
      const updatedPhotos = formData.photos.filter((_, i) => i !== index);
      setFormData({ 
        ...formData, 
        photos: updatedPhotos,
        photo: updatedPhotos[0] || ""
      });
    }
    
    toast({
      title: "写真削除",
      description: "写真を削除しました",
    });
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
            <Tabs defaultValue="management" className="w-full">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold">キャスト管理</h1>
                  <p className="text-muted-foreground">キャストの登録・管理</p>
                </div>
                
                <div className="flex gap-2 items-center">
                  
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
                    <Tabs defaultValue="basic" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="basic">基本情報</TabsTrigger>
                        <TabsTrigger value="details">詳細情報</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="basic" className="space-y-4 mt-4">
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
                          <Label htmlFor="photo">写真 ({formData.photos.length}/5)</Label>
                          <div className="space-y-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(file, false);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingPhoto || formData.photos.length >= 5}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingPhoto ? "アップロード中..." : formData.photos.length >= 5 ? "最大5枚までです" : "写真をアップロード"}
                            </Button>
                            {formData.photos.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                {formData.photos.map((photo, index) => (
                                  <div key={index} className="relative group">
                                    <img 
                                      src={photo} 
                                      alt={`プレビュー ${index + 1}`} 
                                      className="w-full h-[200px] object-cover rounded-md"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleRemovePhoto(index, false)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Badge 
                                      variant="secondary"
                                      className="absolute bottom-1 left-1"
                                    >
                                      {index + 1}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="details" className="space-y-4 mt-4">
                        <div>
                          <Label htmlFor="dispatch-status">派遣ステータス</Label>
                          <Select 
                            value={formData.dispatch_status}
                            onValueChange={(value) => setFormData({...formData, dispatch_status: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">未設定</SelectItem>
                              <SelectItem value="scheduled">派遣予定</SelectItem>
                              <SelectItem value="dispatched">派遣中</SelectItem>
                              <SelectItem value="completed">完了</SelectItem>
                              <SelectItem value="cancelled">キャンセル</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="repeat-scheduled"
                            checked={formData.repeat_scheduled}
                            onChange={(e) => setFormData({...formData, repeat_scheduled: e.target.checked})}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="repeat-scheduled">リピート予定</Label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="therapist-years">セラピスト歴（年）</Label>
                            <Input 
                              id="therapist-years" 
                              type="number"
                              placeholder="3"
                              value={formData.therapist_years || ""}
                              onChange={(e) => setFormData({...formData, therapist_years: parseInt(e.target.value) || 0})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="favorite-food">好きな食べ物</Label>
                            <Input 
                              id="favorite-food" 
                              placeholder="じゃがりこ"
                              value={formData.favorite_food}
                              onChange={(e) => setFormData({...formData, favorite_food: e.target.value})}
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="favorite-techniques">得意な施術</Label>
                          <Textarea 
                            id="favorite-techniques" 
                            rows={3}
                            placeholder="極液を使った密着施術..."
                            value={formData.favorite_techniques}
                            onChange={(e) => setFormData({...formData, favorite_techniques: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="ideal-partner">好きな男性のタイプ</Label>
                          <Textarea 
                            id="ideal-partner" 
                            rows={2}
                            placeholder="紳士な方"
                            value={formData.ideal_partner}
                            onChange={(e) => setFormData({...formData, ideal_partner: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="follow-list">フォロー&リスト</Label>
                          <Input 
                            id="follow-list" 
                            placeholder="追加中"
                            value={formData.follow_list}
                            onChange={(e) => setFormData({...formData, follow_list: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="media-registration">媒体登録（カンマ区切り）</Label>
                          <Input 
                            id="media-registration" 
                            placeholder="キャスカン, エスタマ"
                            value={formData.media_registration.join(", ")}
                            onChange={(e) => setFormData({
                              ...formData, 
                              media_registration: e.target.value.split(",").map(s => s.trim()).filter(s => s)
                            })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="marks">マーク一覧（カンマ区切り）</Label>
                          <Input 
                            id="marks" 
                            placeholder="【エスたま】新人, 【エスたま】お気に入り"
                            value={formData.marks.join(", ")}
                            onChange={(e) => setFormData({
                              ...formData, 
                              marks: e.target.value.split(",").map(s => s.trim()).filter(s => s)
                            })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="registration-sheet">登録シート</Label>
                          <Input 
                            id="registration-sheet" 
                            placeholder="登録シートURL"
                            value={formData.registration_sheet}
                            onChange={(e) => setFormData({...formData, registration_sheet: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="format-type">フォーマット</Label>
                          <Input 
                            id="format-type" 
                            placeholder="フォーマット種類"
                            value={formData.format_type}
                            onChange={(e) => setFormData({...formData, format_type: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="recent-dispatch">直近派遣詳細</Label>
                          <Textarea 
                            id="recent-dispatch" 
                            rows={3}
                            placeholder="直近の派遣情報..."
                            value={formData.recent_dispatch_details}
                            onChange={(e) => setFormData({...formData, recent_dispatch_details: e.target.value})}
                          />
                        </div>

                        <div>
                          <Label htmlFor="memo">メモ欄</Label>
                          <Textarea 
                            id="memo" 
                            rows={4}
                            placeholder="メモを入力..."
                            value={formData.memo}
                            onChange={(e) => setFormData({...formData, memo: e.target.value})}
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                    
                    <Button onClick={handleAddCast} className="w-full mt-4">
                      追加
                    </Button>
                  </DialogContent>
                </Dialog>
              )}
              </div>
            </div>

            {/* Edit Dialog */}
            {editingCast && (
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>キャスト編集</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">基本情報</TabsTrigger>
                      <TabsTrigger value="details">詳細情報</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="edit-name">セラピスト名</Label>
                        <Input 
                          id="edit-name" 
                          placeholder="名前を入力"
                          value={editingCast.name}
                          onChange={(e) => setEditingCast({...editingCast, name: e.target.value})}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-type">タイプ</Label>
                          <Select 
                            value={editingCast.type}
                            onValueChange={(value) => setEditingCast({...editingCast, type: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="新人">新人</SelectItem>
                              <SelectItem value="standard">スタンダード</SelectItem>
                              <SelectItem value="premium">プレミアム</SelectItem>
                              <SelectItem value="VIP">VIP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="edit-room">ルーム</Label>
                          <Select 
                            value={editingCast.room || ""}
                            onValueChange={(value) => setEditingCast({...editingCast, room: value})}
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
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-status">ステータス</Label>
                        <Select 
                          value={editingCast.status}
                          onValueChange={(value) => setEditingCast({...editingCast, status: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="waiting">待機中</SelectItem>
                            <SelectItem value="working">接客中</SelectItem>
                            <SelectItem value="offline">退勤</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="edit-profile">プロフィール</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateContent('profile')}
                            disabled={generatingContent}
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            AI生成
                          </Button>
                        </div>
                        <Textarea 
                          id="edit-profile" 
                          rows={5}
                          placeholder="キャストの魅力や特徴を入力..."
                          value={editingCast.profile || ""}
                          onChange={(e) => setEditingCast({...editingCast, profile: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-photo">写真 ({(editingCast.photos || []).length}/5)</Label>
                        <div className="space-y-2">
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoUpload(file, true);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => editFileInputRef.current?.click()}
                            disabled={uploadingPhoto || (editingCast.photos || []).length >= 5}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {uploadingPhoto ? "アップロード中..." : (editingCast.photos || []).length >= 5 ? "最大5枚までです" : "写真をアップロード"}
                          </Button>
                          {(editingCast.photos || []).length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {(editingCast.photos || []).map((photo, index) => (
                                <div key={index} className="relative group">
                                  <img 
                                    src={photo} 
                                    alt={`プレビュー ${index + 1}`} 
                                    className="w-full h-[200px] object-cover rounded-md"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleRemovePhoto(index, true)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="edit-x-account">Xアカウント</Label>
                        <Input 
                          id="edit-x-account" 
                          placeholder="@username"
                          value={editingCast.x_account || ""}
                          onChange={(e) => setEditingCast({...editingCast, x_account: e.target.value})}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="edit-hp-notice">HP告知</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateContent('announcement')}
                            disabled={generatingContent}
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            AI生成
                          </Button>
                        </div>
                        <Textarea 
                          id="edit-hp-notice" 
                          rows={3} 
                          placeholder="ホームページに表示するお知らせ..."
                          value={editingCast.hp_notice || ""}
                          onChange={(e) => setEditingCast({...editingCast, hp_notice: e.target.value})}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="details" className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="edit-dispatch-status">派遣ステータス</Label>
                        <Select 
                          value={editingCast.dispatch_status || "none"}
                          onValueChange={(value) => setEditingCast({...editingCast, dispatch_status: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">未設定</SelectItem>
                            <SelectItem value="scheduled">派遣予定</SelectItem>
                            <SelectItem value="dispatched">派遣中</SelectItem>
                            <SelectItem value="completed">完了</SelectItem>
                            <SelectItem value="cancelled">キャンセル</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit-repeat-scheduled"
                          checked={editingCast.repeat_scheduled || false}
                          onChange={(e) => setEditingCast({...editingCast, repeat_scheduled: e.target.checked})}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="edit-repeat-scheduled">リピート予定</Label>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-therapist-years">セラピスト歴（年）</Label>
                          <Input 
                            id="edit-therapist-years" 
                            type="number"
                            placeholder="3"
                            value={editingCast.therapist_years || ""}
                            onChange={(e) => setEditingCast({...editingCast, therapist_years: parseInt(e.target.value) || null})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-favorite-food">好きな食べ物</Label>
                          <Input 
                            id="edit-favorite-food" 
                            placeholder="じゃがりこ"
                            value={editingCast.favorite_food || ""}
                            onChange={(e) => setEditingCast({...editingCast, favorite_food: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="edit-favorite-techniques">得意な施術</Label>
                        <Textarea 
                          id="edit-favorite-techniques" 
                          rows={3}
                          placeholder="極液を使った密着施術..."
                          value={editingCast.favorite_techniques || ""}
                          onChange={(e) => setEditingCast({...editingCast, favorite_techniques: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-ideal-partner">好きな男性のタイプ</Label>
                        <Textarea 
                          id="edit-ideal-partner" 
                          rows={2}
                          placeholder="紳士な方"
                          value={editingCast.ideal_partner || ""}
                          onChange={(e) => setEditingCast({...editingCast, ideal_partner: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-follow-list">フォロー&リスト</Label>
                        <Input 
                          id="edit-follow-list" 
                          placeholder="追加中"
                          value={editingCast.follow_list || ""}
                          onChange={(e) => setEditingCast({...editingCast, follow_list: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-media-registration">媒体登録（カンマ区切り）</Label>
                        <Input 
                          id="edit-media-registration" 
                          placeholder="キャスカン, エスタマ"
                          value={(editingCast.media_registration || []).join(", ")}
                          onChange={(e) => setEditingCast({
                            ...editingCast, 
                            media_registration: e.target.value.split(",").map(s => s.trim()).filter(s => s)
                          })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-marks">マーク一覧（カンマ区切り）</Label>
                        <Input 
                          id="edit-marks" 
                          placeholder="【エスたま】新人, 【エスたま】お気に入り"
                          value={(editingCast.marks || []).join(", ")}
                          onChange={(e) => setEditingCast({
                            ...editingCast, 
                            marks: e.target.value.split(",").map(s => s.trim()).filter(s => s)
                          })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-registration-sheet">登録シート</Label>
                        <Input 
                          id="edit-registration-sheet" 
                          placeholder="登録シートURL"
                          value={editingCast.registration_sheet || ""}
                          onChange={(e) => setEditingCast({...editingCast, registration_sheet: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-format-type">フォーマット</Label>
                        <Input 
                          id="edit-format-type" 
                          placeholder="フォーマット種類"
                          value={editingCast.format_type || ""}
                          onChange={(e) => setEditingCast({...editingCast, format_type: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-recent-dispatch">直近派遣詳細</Label>
                        <Textarea 
                          id="edit-recent-dispatch" 
                          rows={3}
                          placeholder="直近の派遣情報..."
                          value={editingCast.recent_dispatch_details || ""}
                          onChange={(e) => setEditingCast({...editingCast, recent_dispatch_details: e.target.value})}
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-memo">メモ欄</Label>
                        <Textarea 
                          id="edit-memo" 
                          rows={4}
                          placeholder="メモを入力..."
                          value={editingCast.memo || ""}
                          onChange={(e) => setEditingCast({...editingCast, memo: e.target.value})}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <Button onClick={handleUpdateCast} className="w-full mt-4">
                    更新
                  </Button>
                </DialogContent>
              </Dialog>
            )}

            {/* Website Photo Sync */}
            {isAdmin && (
              <div className="mb-6">
                <WebsitePhotoSync />
              </div>
            )}

            <TabsContent value="management" className="space-y-6">
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
                <Card 
                  key={cast.id} 
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleEditCast(cast)}
                >
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                    {cast.photos && cast.photos.length > 0 ? (
                      <div className="relative w-full h-full">
                        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full h-full">
                          {cast.photos.map((photo, index) => (
                            <div key={index} className="flex-shrink-0 w-full h-full snap-center">
                              <img 
                                src={photo} 
                                alt={`${cast.name} - ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                        {cast.photos.length > 1 && (
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                            {cast.photos.map((_, index) => (
                              <div 
                                key={index} 
                                className="w-1.5 h-1.5 rounded-full bg-white/60 backdrop-blur-sm"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : cast.photo ? (
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(cast.id, "waiting");
                            }}
                            className="flex-1 text-xs"
                            disabled={cast.status === "waiting"}
                          >
                            待機
                          </Button>
                          <Button 
                            variant={cast.status === "busy" ? "default" : "outline"}
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(cast.id, "busy");
                            }}
                            className="flex-1 text-xs"
                            disabled={cast.status === "busy"}
                          >
                            接客
                          </Button>
                          <Button 
                            variant={cast.status === "offline" ? "default" : "outline"}
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(cast.id, "offline");
                            }}
                            className="flex-1 text-xs"
                            disabled={cast.status === "offline"}
                          >
                            退勤
                          </Button>
                        </div>
                        
                        {/* Therapist Portal Link */}
                        {cast.access_token ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              copyPortalLink(cast.access_token!);
                            }}
                            className="w-full mt-3"
                          >
                            <Copy size={14} className="mr-1" />
                            専用ページリンクをコピー
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              generateAccessToken(cast.id);
                            }}
                            className="w-full mt-3"
                          >
                            <LinkIcon size={14} className="mr-1" />
                            専用ページを作成
                          </Button>
                        )}
                        
                        <div className="flex gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCast(cast);
                            }}
                            className="flex-1"
                          >
                            <Edit size={14} />
                            編集
                          </Button>
                          
                          {deleteConfirmId === cast.id ? (
                            <div className="flex gap-1">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCast(cast.id);
                                }}
                                className="text-xs"
                              >
                                確認
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="text-xs"
                              >
                                キャンセル
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(cast.id);
                              }}
                              className="hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
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
            </TabsContent>

          </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
