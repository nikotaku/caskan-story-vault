import { useState, useEffect } from "react";
import { Save, Store, Phone, Mail, MapPin, Clock } from "lucide-react";
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
import { BannerManagement } from "@/components/BannerManagement";
import { PaymentReminderSettings } from "@/components/PaymentReminderSettings";
import { getWebhookUrl, saveWebhookUrl } from "@/lib/sheetWebhook";
import { isValidEmail } from "@/lib/email";
import { useAdminStore } from "@/hooks/useAdminStore";
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from "@/lib/availability";

function SheetWebhookSettings() {
  const { toast } = useToast();
  const [url, setUrl] = useState(getWebhookUrl());
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Save size={18} />スプレッドシート連携（書き込み）</CardTitle>
        <CardDescription>
          Google Apps Script の Webアプリ URL を設定すると、新規予約・新規顧客の保存時に自動でスプレッドシートへ追記されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="webhook_url">GAS WebアプリURL</Label>
          <Input
            id="webhook_url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/XXXX/exec"
          />
        </div>
        <Button
          onClick={() => {
            saveWebhookUrl(url);
            toast({ title: "保存しました", description: "書き込み先URLを更新しました" });
          }}
        >
          保存
        </Button>
      </CardContent>
    </Card>
  );
}

interface ShopSettings {
  id: string;
  shop_name: string;
  shop_phone: string | null;
  shop_email: string | null;
  shop_address: string | null;
  business_hours: string | null;
  business_day_start: string;
  reservation_interval_minutes: number;
  description: string | null;
  logo_url: string | null;
  line_reminder_enabled?: boolean;
  line_reminder_time?: string;
}

export default function Settings() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { store: adminStore, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && adminStore?.id) {
      fetchSettings();
    }
  }, [user, adminStore?.id]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('store_id', adminStore!.id)
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
    if (settings.shop_email?.trim() && !isValidEmail(settings.shop_email)) {
      toast({
        title: "入力エラー",
        description: "メールアドレスの形式が正しくありません（例: info@example.jp）",
        variant: "destructive",
      });
      return;
    }
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
          business_day_start: settings.business_day_start,
          reservation_interval_minutes:
            settings.reservation_interval_minutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES,
          description: settings.description,
          logo_url: settings.logo_url,
          line_reminder_enabled: settings.line_reminder_enabled ?? true,
          line_reminder_time: settings.line_reminder_time ?? "23:00",
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

  if (authLoading || storeLoading || loading) {
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
                      営業時間（表示用）
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
                    <Label htmlFor="business_day_start" className="flex items-center gap-2">
                      <Clock size={14} />
                      営業日の切替時刻
                    </Label>
                    <Input
                      id="business_day_start"
                      value={settings.business_day_start ?? "10:00"}
                      onChange={(e) => setSettings({...settings, business_day_start: e.target.value})}
                      placeholder="10:00"
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      この時刻以前の予約は前日扱いになります（例: 10:00 → 深夜01:00の予約は前日として集計）
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="reservation_interval" className="flex items-center gap-2">
                      <Clock size={14} />
                      予約インターバル（分）
                    </Label>
                    <Input
                      id="reservation_interval"
                      type="number"
                      min="0"
                      step="5"
                      value={
                        settings.reservation_interval_minutes
                          ?? DEFAULT_RESERVATION_INTERVAL_MINUTES
                      }
                      onChange={(e) => setSettings({...settings, reservation_interval_minutes: Number(e.target.value) || 0})}
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      予約と次の予約の間に空ける準備時間。最短ご案内時間・Web予約の空き枠計算に使われます
                    </p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="line_reminder_enabled" className="flex items-center gap-2 font-semibold">
                        <Clock size={14} />
                        LINE出勤リマインド
                      </Label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          id="line_reminder_enabled"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={settings.line_reminder_enabled ?? true}
                          onChange={(e) => setSettings({ ...settings, line_reminder_enabled: e.target.checked })}
                          disabled={!isAdmin}
                        />
                        有効
                      </label>
                    </div>
                    <div>
                      <Label htmlFor="line_reminder_time">送信時刻</Label>
                      <Input
                        id="line_reminder_time"
                        type="time"
                        value={settings.line_reminder_time ?? "23:00"}
                        onChange={(e) => setSettings({ ...settings, line_reminder_time: e.target.value })}
                        disabled={!isAdmin}
                        className="w-40"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      毎日この時刻に、翌日のセラピストの出勤ルーム・出勤時刻・予約件数をスタッフLINEグループへ自動送信します。
                    </p>
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

            {isAdmin && <SheetWebhookSettings />}

            {isAdmin && <PaymentReminderSettings />}

            {isAdmin && <BannerManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}
