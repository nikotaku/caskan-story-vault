import { useState } from "react";
import { Save, Bell, Shield, CreditCard, Globe, Clock, MapPin } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "設定保存",
      description: "設定が正常に保存されました",
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
                <h1 className="text-2xl font-bold">設定</h1>
                <p className="text-muted-foreground">店舗とシステムの設定管理</p>
              </div>
              
              <Button onClick={handleSave}>
                <Save size={16} />
                保存
              </Button>
            </div>

            <Tabs defaultValue="shop" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="shop">店舗情報</TabsTrigger>
                <TabsTrigger value="booking">予約設定</TabsTrigger>
                <TabsTrigger value="notifications">通知設定</TabsTrigger>
                <TabsTrigger value="payment">決済設定</TabsTrigger>
                <TabsTrigger value="security">セキュリティ</TabsTrigger>
              </TabsList>

              <TabsContent value="shop" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin size={20} />
                      基本情報
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="shopName">店舗名</Label>
                        <Input id="shopName" defaultValue="全力エステ 仙台" />
                      </div>
                      <div>
                        <Label htmlFor="shopCode">店舗コード</Label>
                        <Input id="shopCode" defaultValue="1401" disabled />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="address">住所</Label>
                      <Input id="address" defaultValue="宮城県仙台市青葉区中央1-1-1" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">電話番号</Label>
                        <Input id="phone" defaultValue="022-123-4567" />
                      </div>
                      <div>
                        <Label htmlFor="email">メールアドレス</Label>
                        <Input id="email" defaultValue="info@zenryoku-sendai.com" />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="description">店舗紹介</Label>
                      <Textarea 
                        id="description" 
                        rows={4}
                        defaultValue="仙台市中心部に位置する高品質なエステサロン。経験豊富なセラピストが最高のリラクゼーションをご提供いたします。"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock size={20} />
                      営業時間
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-7 gap-2">
                      {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
                        <div key={index} className="space-y-2">
                          <Label className="text-center block">{day}</Label>
                          <Input placeholder="10:00" className="text-xs" />
                          <div className="text-center text-xs text-muted-foreground">～</div>
                          <Input placeholder="22:00" className="text-xs" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="booking" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>予約受付設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>自動予約確定</Label>
                        <p className="text-sm text-muted-foreground">
                          新規予約を自動的に確定する
                        </p>
                      </div>
                      <Switch checked={autoConfirm} onCheckedChange={setAutoConfirm} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="advanceBooking">事前予約期間</Label>
                        <Select defaultValue="30">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7日前まで</SelectItem>
                            <SelectItem value="14">14日前まで</SelectItem>
                            <SelectItem value="30">30日前まで</SelectItem>
                            <SelectItem value="60">60日前まで</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cancelDeadline">キャンセル締切</Label>
                        <Select defaultValue="24">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1時間前</SelectItem>
                            <SelectItem value="3">3時間前</SelectItem>
                            <SelectItem value="24">24時間前</SelectItem>
                            <SelectItem value="48">48時間前</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="minBooking">最小予約時間</Label>
                      <Select defaultValue="60">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30分</SelectItem>
                          <SelectItem value="60">60分</SelectItem>
                          <SelectItem value="90">90分</SelectItem>
                          <SelectItem value="120">120分</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell size={20} />
                      通知設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>メール通知</Label>
                        <p className="text-sm text-muted-foreground">
                          予約・キャンセル時にメールで通知
                        </p>
                      </div>
                      <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>SMS通知</Label>
                        <p className="text-sm text-muted-foreground">
                          重要な通知をSMSで送信
                        </p>
                      </div>
                      <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
                    </div>
                    
                    <div>
                      <Label htmlFor="notificationEmail">通知先メールアドレス</Label>
                      <Input 
                        id="notificationEmail" 
                        type="email"
                        defaultValue="manager@zenryoku-sendai.com" 
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="notificationPhone">通知先電話番号</Label>
                      <Input 
                        id="notificationPhone" 
                        defaultValue="090-1234-5678" 
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payment" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard size={20} />
                      決済設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="cash" className="rounded" defaultChecked />
                        <Label htmlFor="cash">現金</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="card" className="rounded" defaultChecked />
                        <Label htmlFor="card">クレジットカード</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="qr" className="rounded" />
                        <Label htmlFor="qr">QRコード決済</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="bank" className="rounded" />
                        <Label htmlFor="bank">銀行振込</Label>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="taxRate">消費税率 (%)</Label>
                      <Input id="taxRate" type="number" defaultValue="10" min="0" max="100" />
                    </div>
                    
                    <div>
                      <Label htmlFor="serviceCharge">サービス料 (%)</Label>
                      <Input id="serviceCharge" type="number" defaultValue="0" min="0" max="100" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield size={20} />
                      セキュリティ設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label htmlFor="currentPassword">現在のパスワード</Label>
                      <Input id="currentPassword" type="password" />
                    </div>
                    
                    <div>
                      <Label htmlFor="newPassword">新しいパスワード</Label>
                      <Input id="newPassword" type="password" />
                    </div>
                    
                    <div>
                      <Label htmlFor="confirmPassword">パスワード確認</Label>
                      <Input id="confirmPassword" type="password" />
                    </div>
                    
                    <div className="pt-4 border-t">
                      <Label htmlFor="sessionTimeout">セッションタイムアウト (分)</Label>
                      <Select defaultValue="30">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15分</SelectItem>
                          <SelectItem value="30">30分</SelectItem>
                          <SelectItem value="60">60分</SelectItem>
                          <SelectItem value="120">120分</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <Button variant="destructive" className="w-full">
                        全データをリセット
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        ※この操作は取り消せません
                      </p>
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