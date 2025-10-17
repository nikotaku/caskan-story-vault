import { useState, useEffect } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  profile: string | null;
}

export default function TextGeneration() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [selectedCastId, setSelectedCastId] = useState<string>("");
  const [generationType, setGenerationType] = useState<'profile' | 'announcement' | 'catchphrase'>('profile');
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCasts();
  }, []);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from('casts')
        .select('id, name, type, profile')
        .order('name', { ascending: true });

      if (error) throw error;
      setCasts(data || []);
    } catch (error) {
      console.error('Error fetching casts:', error);
      toast({
        title: "エラー",
        description: "キャスト情報の取得に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!selectedCastId) {
      toast({
        title: "エラー",
        description: "キャストを選択してください",
        variant: "destructive",
      });
      return;
    }

    const selectedCast = casts.find(c => c.id === selectedCastId);
    if (!selectedCast) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-cast-content', {
        body: {
          type: generationType,
          castName: selectedCast.name,
          castType: selectedCast.type,
          existingProfile: generationType === 'profile' ? selectedCast.profile : null
        }
      });

      if (error) throw error;

      if (data?.content) {
        setGeneratedContent(data.content);
        toast({
          title: "生成完了",
          description: "文章を生成しました",
        });
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: "エラー",
        description: "文章の生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      setIsCopied(true);
      toast({
        title: "コピー完了",
        description: "クリップボードにコピーしました",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: "エラー",
        description: "コピーに失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!selectedCastId || !generatedContent) return;

    try {
      const updateData: any = {};
      if (generationType === 'profile') {
        updateData.profile = generatedContent;
      } else if (generationType === 'announcement') {
        updateData.hp_notice = generatedContent;
      }

      const { error } = await supabase
        .from('casts')
        .update(updateData)
        .eq('id', selectedCastId);

      if (error) throw error;

      toast({
        title: "保存完了",
        description: "キャスト情報を更新しました",
      });
    } catch (error) {
      console.error('Error saving content:', error);
      toast({
        title: "エラー",
        description: "保存に失敗しました",
        variant: "destructive",
      });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'profile': return 'プロフィール';
      case 'announcement': return 'お知らせ文章';
      case 'catchphrase': return 'キャッチコピー';
      default: return '';
    }
  };

  if (authLoading) {
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
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">AI文章生成</h1>
              <p className="text-muted-foreground">キャストのプロフィールやお知らせを自動生成</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  文章生成設定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cast-select">キャスト選択</Label>
                    <Select value={selectedCastId} onValueChange={setSelectedCastId}>
                      <SelectTrigger id="cast-select">
                        <SelectValue placeholder="キャストを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {casts.map((cast) => (
                          <SelectItem key={cast.id} value={cast.id}>
                            {cast.name} ({cast.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="type-select">生成タイプ</Label>
                    <Select 
                      value={generationType} 
                      onValueChange={(value: any) => setGenerationType(value)}
                    >
                      <SelectTrigger id="type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profile">プロフィール</SelectItem>
                        <SelectItem value="announcement">お知らせ文章</SelectItem>
                        <SelectItem value="catchphrase">キャッチコピー</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={!selectedCastId || isGenerating}
                  className="w-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGenerating ? "生成中..." : `${getTypeLabel(generationType)}を生成`}
                </Button>

                {generatedContent && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="generated-content">生成された文章</Label>
                      <Textarea
                        id="generated-content"
                        value={generatedContent}
                        onChange={(e) => setGeneratedContent(e.target.value)}
                        rows={8}
                        className="mt-2"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={handleCopy} 
                        variant="outline"
                        className="flex-1"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            コピー完了
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            コピー
                          </>
                        )}
                      </Button>
                      
                      {generationType !== 'catchphrase' && (
                        <Button 
                          onClick={handleSave}
                          className="flex-1"
                        >
                          保存
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>使い方</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. キャストを選択してください</p>
                <p>2. 生成したい文章のタイプを選択してください</p>
                <p>3. 「生成」ボタンをクリックすると、AIが魅力的な文章を自動作成します</p>
                <p>4. 生成された文章は編集可能です。必要に応じて修正してください</p>
                <p>5. 「保存」ボタンでキャスト情報に直接保存できます</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
