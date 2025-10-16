import { useState, useEffect } from "react";
import { Save, Store, Phone, Mail, MapPin, Clock, Database, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Link2 } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ShopSettings {
  id: string;
  shop_name: string;
  shop_phone: string | null;
  shop_email: string | null;
  shop_address: string | null;
  business_hours: string | null;
  description: string | null;
  logo_url: string | null;
}

export default function Settings() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [notionApiKey, setNotionApiKey] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");

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
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "エラー",
        description: "設定情報の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotionSync = async () => {
    setIsSyncing(true);
    
    try {
      console.log('Starting Notion sync...');
      
      const { data, error } = await supabase.functions.invoke('sync-notion', {
        body: {},
      });

      if (error) {
        console.error('Sync function error:', error);
        throw error;
      }

      console.log('Sync result:', data);

      if (data.success) {
        setLastSync(new Date());
        toast({
          title: "同期完了",
          description: `${data.synced}件のキャストデータを同期しました${data.errors > 0 ? `（${data.errors}件のエラー）` : ''}`,
        });

        if (data.details?.errors?.length > 0) {
          console.warn('Sync errors:', data.details.errors);
        }
      } else {
        throw new Error(data.error || 'Unknown sync error');
      }
    } catch (error) {
      console.error('Error syncing with Notion:', error);
      toast({
        title: "同期エラー",
        description: error instanceof Error ? error.message : "Notionとの同期に失敗しました。設定を確認してください。",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみ設定を変更できます",
        variant: "destructive",
      });
      return;
    }

    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('shop_settings')
        .update({
          shop_name: settings.shop_name,
          shop_phone: settings.shop_phone,
          shop_email: settings.shop_email,
          shop_address: settings.shop_address,
          business_hours: settings.business_hours,
          description: settings.description,
          logo_url: settings.logo_url,
          updated_by: user!.id,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: "保存完了",
        description: "店舗設定が保存されました",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">店舗設定</h1>
                <p className="text-muted-foreground">店舗情報の管理</p>
              </div>
              
              {isAdmin && (
                <Button onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? "保存中..." : "保存"}
                </Button>
              )}
            </div>

            {/* Notion Integration */}
            {isAdmin && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database size={20} />
                    Notion連携
                  </CardTitle>
                  <CardDescription>
                    Notionデータベースからキャスト情報を同期できます
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">Notion連携の設定手順：</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>
                            <a 
                              href="https://www.notion.so/my-integrations" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Notionインテグレーション
                              <ExternalLink size={12} />
                            </a>
                            を作成してAPIキーを取得
                          </li>
                          <li>Notionでキャスト情報用のデータベースを作成</li>
                          <li>データベースをインテグレーションと共有</li>
                          <li>データベースのURLから32文字のIDを取得</li>
                          <li>下記の「API設定」ボタンから認証情報を登録</li>
                        </ol>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <CheckCircle size={14} className="text-primary" />
                        必要なプロパティ
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>• 名前/Name (タイトル)</div>
                        <div>• 年齢/Age (数値)</div>
                        <div>• ランク/Type (セレクト)</div>
                        <div>• 料金/Price (数値)</div>
                        <div>• スリーサイズ/Measurements (テキスト)</div>
                        <div>• プロフィール/Profile (テキスト)</div>
                        <div>• 電話番号/Phone (電話番号)</div>
                        <div>• 写真/Photo (ファイル/URL)</div>
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm">
                      <p className="font-semibold mb-2">API設定方法：</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>チャットで「NOTION_API_KEYを設定してください」と入力</li>
                        <li>表示されるフォームにAPIキーを入力</li>
                        <li>チャットで「NOTION_DATABASE_IDを設定してください」と入力</li>
                        <li>表示されるフォームにデータベースIDを入力</li>
                        <li>設定完了後、下記の「データを同期」ボタンをクリック</li>
                      </ol>
                    </AlertDescription>
                  </Alert>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => {
                        window.open('https://www.notion.so/my-integrations', '_blank');
                      }}
                      variant="outline"
                      className="gap-2"
                    >
                      <Link2 size={16} />
                      Notion設定を開く
                    </Button>
                    
                    <Button
                      onClick={handleNotionSync}
                      disabled={isSyncing}
                      className="gap-2"
                    >
                      <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                      {isSyncing ? '同期中...' : 'データを同期'}
                    </Button>
                  </div>

                  {lastSync && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle size={12} />
                      最終同期: {lastSync.toLocaleString('ja-JP')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {settings ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store size={20} />
                    基本情報
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="shop_name">店舗名</Label>
                    <Input
                      id="shop_name"
                      value={settings.shop_name}
                      onChange={(e) => setSettings({...settings, shop_name: e.target.value})}
                      disabled={!isAdmin}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="shop_phone" className="flex items-center gap-2">
                      <Phone size={14} />
                      電話番号
                    </Label>
                    <Input
                      id="shop_phone"
                      value={settings.shop_phone || ""}
                      onChange={(e) => setSettings({...settings, shop_phone: e.target.value})}
                      disabled={!isAdmin}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="shop_email" className="flex items-center gap-2">
                      <Mail size={14} />
                      メールアドレス
                    </Label>
                    <Input
                      id="shop_email"
                      type="email"
                      value={settings.shop_email || ""}
                      onChange={(e) => setSettings({...settings, shop_email: e.target.value})}
                      disabled={!isAdmin}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="shop_address" className="flex items-center gap-2">
                      <MapPin size={14} />
                      住所
                    </Label>
                    <Input
                      id="shop_address"
                      value={settings.shop_address || ""}
                      onChange={(e) => setSettings({...settings, shop_address: e.target.value})}
                      disabled={!isAdmin}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="business_hours" className="flex items-center gap-2">
                      <Clock size={14} />
                      営業時間
                    </Label>
                    <Input
                      id="business_hours"
                      value={settings.business_hours || ""}
                      onChange={(e) => setSettings({...settings, business_hours: e.target.value})}
                      placeholder="13:00 - 25:00"
                      disabled={!isAdmin}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">店舗説明</Label>
                    <Textarea
                      id="description"
                      rows={4}
                      value={settings.description || ""}
                      onChange={(e) => setSettings({...settings, description: e.target.value})}
                      disabled={!isAdmin}
                      placeholder="店舗の説明を入力してください"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                設定情報が見つかりません
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
