import { useState } from "react";
import { Save, Eye, Upload, Palette, Type, Image } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function Design() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "保存完了",
      description: "ホームページの変更が保存されました",
    });
  };

  const handlePreview = () => {
    window.open("/preview", "_blank");
    toast({
      title: "プレビュー",
      description: "新しいタブでプレビューを開きました",
    });
  };

  const handlePublish = () => {
    setIsPublished(!isPublished);
    toast({
      title: isPublished ? "公開停止" : "公開開始",
      description: isPublished ? "ホームページを非公開にしました" : "ホームページを公開しました",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-6 md:ml-[240px]">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">ホームページ管理</h1>
                <p className="text-muted-foreground">店舗のホームページをカスタマイズ</p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handlePreview}>
                  <Eye size={16} />
                  プレビュー
                </Button>
                <Button onClick={handleSave}>
                  <Save size={16} />
                  保存
                </Button>
              </div>
            </div>

            {/* Publication Status */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">公開状態</h3>
                    <p className="text-sm text-muted-foreground">
                      {isPublished ? "ホームページは現在公開中です" : "ホームページは現在非公開です"}
                    </p>
                  </div>
                  <Switch checked={isPublished} onCheckedChange={handlePublish} />
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">基本情報</TabsTrigger>
                <TabsTrigger value="design">デザイン</TabsTrigger>
                <TabsTrigger value="content">コンテンツ</TabsTrigger>
                <TabsTrigger value="seo">SEO設定</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>店舗基本情報</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="shopName">店舗名</Label>
                      <Input id="shopName" defaultValue="全力エステ 仙台" />
                    </div>
                    <div>
                      <Label htmlFor="address">住所</Label>
                      <Input id="address" defaultValue="宮城県仙台市青葉区..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">電話番号</Label>
                        <Input id="phone" defaultValue="022-123-4567" />
                      </div>
                      <div>
                        <Label htmlFor="email">メールアドレス</Label>
                        <Input id="email" defaultValue="info@example.com" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="hours">営業時間</Label>
                      <Input id="hours" defaultValue="10:00 - 24:00" />
                    </div>
                    <div>
                      <Label htmlFor="description">店舗説明</Label>
                      <Textarea 
                        id="description" 
                        rows={4}
                        defaultValue="最高品質のリラクゼーションサービスをご提供いたします。"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="design" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette size={20} />
                      カラー設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>メインカラー</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input type="color" defaultValue="#000000" className="w-12 h-10 rounded border" />
                          <Input defaultValue="#000000" className="flex-1" />
                        </div>
                      </div>
                      <div>
                        <Label>アクセントカラー</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input type="color" defaultValue="#ff0000" className="w-12 h-10 rounded border" />
                          <Input defaultValue="#ff0000" className="flex-1" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Type size={20} />
                      フォント設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>見出しフォント</Label>
                      <select className="w-full mt-1 p-2 border rounded-md">
                        <option>Noto Sans JP</option>
                        <option>Hiragino Sans</option>
                        <option>Yu Gothic</option>
                      </select>
                    </div>
                    <div>
                      <Label>本文フォント</Label>
                      <select className="w-full mt-1 p-2 border rounded-md">
                        <option>Noto Sans JP</option>
                        <option>Hiragino Sans</option>
                        <option>Yu Gothic</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="content" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image size={20} />
                      画像管理
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>メイン画像</Label>
                      <div className="mt-2 border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Upload className="mx-auto mb-2 text-muted-foreground" size={24} />
                        <p className="text-sm text-muted-foreground">
                          クリックまたはドラッグしてファイルをアップロード
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label>ギャラリー画像</Label>
                      <div className="mt-2 border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Upload className="mx-auto mb-2 text-muted-foreground" size={24} />
                        <p className="text-sm text-muted-foreground">
                          複数の画像をアップロード可能
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>コンテンツブロック</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="hero">ヒーローセクション</Label>
                      <Textarea 
                        id="hero" 
                        rows={3}
                        placeholder="メインキャッチコピーを入力..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="services">サービス紹介</Label>
                      <Textarea 
                        id="services" 
                        rows={4}
                        placeholder="提供サービスの詳細を入力..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="access">アクセス情報</Label>
                      <Textarea 
                        id="access" 
                        rows={3}
                        placeholder="交通アクセスの詳細を入力..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="seo" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>SEO設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="title">ページタイトル</Label>
                      <Input 
                        id="title" 
                        defaultValue="全力エステ 仙台 | 最高品質のリラクゼーション"
                        maxLength={60}
                      />
                      <p className="text-xs text-muted-foreground mt-1">60文字以内推奨</p>
                    </div>
                    <div>
                      <Label htmlFor="description">メタ説明</Label>
                      <Textarea 
                        id="description" 
                        rows={3}
                        defaultValue="仙台市青葉区にある高品質なエステサロン。熟練セラピストによる至極のリラクゼーションをご体験ください。"
                        maxLength={160}
                      />
                      <p className="text-xs text-muted-foreground mt-1">160文字以内推奨</p>
                    </div>
                    <div>
                      <Label htmlFor="keywords">キーワード</Label>
                      <Input 
                        id="keywords" 
                        defaultValue="エステ, マッサージ, リラクゼーション, 仙台"
                        placeholder="カンマ区切りで入力"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}