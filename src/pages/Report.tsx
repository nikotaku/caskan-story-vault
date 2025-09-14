import { useState } from "react";
import { Calendar, Download, TrendingUp, Users, DollarSign, Clock } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const monthlyData = [
  { month: "1月", sales: 2800000, customers: 120, avgTime: 85 },
  { month: "2月", sales: 3200000, customers: 140, avgTime: 90 },
  { month: "3月", sales: 3650000, customers: 155, avgTime: 88 },
  { month: "4月", sales: 3100000, customers: 132, avgTime: 92 },
  { month: "5月", sales: 3400000, customers: 148, avgTime: 87 },
  { month: "6月", sales: 3800000, customers: 165, avgTime: 89 },
];

const staffPerformance = [
  { name: "田中 美咲", sessions: 45, sales: 1200000, rating: 4.8 },
  { name: "佐藤 花音", sessions: 38, sales: 980000, rating: 4.6 },
  { name: "鈴木 愛美", sessions: 42, sales: 1100000, rating: 4.7 },
];

const serviceStats = [
  { service: "全身リラクゼーション", bookings: 85, revenue: 2380000 },
  { service: "フェイシャル", bookings: 42, revenue: 1260000 },
  { service: "ボディケア", bookings: 38, revenue: 950000 },
  { service: "アロマテラピー", bookings: 35, revenue: 1050000 },
];

export default function Report() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth");
  const { toast } = useToast();

  const handleExport = (type: string) => {
    toast({
      title: "エクスポート開始",
      description: `${type}レポートのダウンロードを開始しました`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-6 md:ml-[240px]">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">レポート</h1>
                <p className="text-muted-foreground">売上・顧客・スタッフの分析データ</p>
              </div>
              
              <div className="flex gap-2">
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisMonth">今月</SelectItem>
                    <SelectItem value="lastMonth">先月</SelectItem>
                    <SelectItem value="last3Months">過去3ヶ月</SelectItem>
                    <SelectItem value="thisYear">今年</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => handleExport("総合")}>
                  <Download size={16} />
                  エクスポート
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">今月の売上</p>
                      <p className="text-2xl font-bold">¥3,800,000</p>
                      <p className="text-xs text-green-600 flex items-center mt-1">
                        <TrendingUp size={12} className="mr-1" />
                        +12% 前月比
                      </p>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-full">
                      <DollarSign className="text-primary" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">顧客数</p>
                      <p className="text-2xl font-bold">165</p>
                      <p className="text-xs text-green-600 flex items-center mt-1">
                        <TrendingUp size={12} className="mr-1" />
                        +8% 前月比
                      </p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Users className="text-blue-600" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">平均施術時間</p>
                      <p className="text-2xl font-bold">89分</p>
                      <p className="text-xs text-red-600 flex items-center mt-1">
                        <TrendingUp size={12} className="mr-1 rotate-180" />
                        -2% 前月比
                      </p>
                    </div>
                    <div className="bg-orange-100 p-3 rounded-full">
                      <Clock className="text-orange-600" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">予約率</p>
                      <p className="text-2xl font-bold">94%</p>
                      <p className="text-xs text-green-600 flex items-center mt-1">
                        <TrendingUp size={12} className="mr-1" />
                        +3% 前月比
                      </p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-full">
                      <Calendar className="text-green-600" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="sales" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="sales">売上分析</TabsTrigger>
                <TabsTrigger value="staff">スタッフ実績</TabsTrigger>
                <TabsTrigger value="services">サービス別</TabsTrigger>
                <TabsTrigger value="customers">顧客分析</TabsTrigger>
              </TabsList>

              <TabsContent value="sales" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>月別売上推移</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {monthlyData.map((data, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="font-medium w-12">{data.month}</div>
                            <div className="text-sm text-muted-foreground">
                              {data.customers}件の予約
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">¥{data.sales.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              平均{data.avgTime}分/回
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="staff" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>スタッフ別実績</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {staffPerformance.map((staff, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="font-medium">{staff.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {staff.sessions}回の施術
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">¥{staff.sales.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              評価 {staff.rating}/5.0
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>サービス別実績</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {serviceStats.map((service, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="font-medium">{service.service}</div>
                            <div className="text-sm text-muted-foreground">
                              {service.bookings}回予約
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">¥{service.revenue.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              平均¥{Math.round(service.revenue / service.bookings).toLocaleString()}/回
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="customers" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>顧客属性</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span>新規顧客</span>
                          <span className="font-medium">35%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>リピーター</span>
                          <span className="font-medium">65%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>20代</span>
                          <span className="font-medium">15%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>30代</span>
                          <span className="font-medium">45%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>40代以上</span>
                          <span className="font-medium">40%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>顧客満足度</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span>5つ星</span>
                          <span className="font-medium">68%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>4つ星</span>
                          <span className="font-medium">25%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>3つ星</span>
                          <span className="font-medium">5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>2つ星以下</span>
                          <span className="font-medium">2%</span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex justify-between font-bold">
                            <span>平均評価</span>
                            <span>4.6/5.0</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}