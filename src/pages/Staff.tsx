import { useState } from "react";
import { Plus, Edit, Trash2, Search, Filter, Star, Camera, Clock, TrendingUp } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Cast {
  id: string;
  name: string;
  age: number;
  type: string;
  status: "waiting" | "busy" | "offline";
  rating: number;
  photo: string;
  profile: string;
  measurements: string;
  price: number;
  totalSales: number;
  monthSales: number;
  workDays: number;
  joinDate: string;
  phone: string;
  waitingTime?: string;
}

const castData: Cast[] = [
  {
    id: "1",
    name: "美咲",
    age: 23,
    type: "プレミアム",
    status: "waiting",
    rating: 4.8,
    photo: "https://images.unsplash.com/photo-1494790108755-2616c4db2d0d?w=400",
    profile: "明るく優しい性格で、お客様一人一人に寄り添ったサービスを心がけています。",
    measurements: "B85-W58-H86",
    price: 15000,
    totalSales: 2800000,
    monthSales: 450000,
    workDays: 22,
    joinDate: "2024-01-15",
    phone: "090-1234-5678",
    waitingTime: "14:00-20:00"
  },
  {
    id: "2", 
    name: "花音",
    age: 21,
    type: "スタンダード",
    status: "busy",
    rating: 4.6,
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
    profile: "癒し系の雰囲気でリラックスしたひとときをお過ごしいただけます。",
    measurements: "B82-W56-H84",
    price: 12000,
    totalSales: 1950000,
    monthSales: 320000,
    workDays: 18,
    joinDate: "2024-02-01",
    phone: "090-2345-6789"
  },
  {
    id: "3",
    name: "愛美",
    age: 25,
    type: "プレミアム",
    status: "offline",
    rating: 4.9,
    photo: "https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=400",
    profile: "大人の魅力溢れる接客で、特別な時間をお約束いたします。",
    measurements: "B88-W60-H89",
    price: 18000,
    totalSales: 3200000,
    monthSales: 580000,
    workDays: 25,
    joinDate: "2023-12-10",
    phone: "090-3456-7890"
  }
];

export default function Staff() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>(castData);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const filteredCasts = casts.filter(cast => {
    const matchesSearch = cast.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || cast.type === filterType;
    const matchesStatus = filterStatus === "all" || cast.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleAddCast = () => {
    toast({
      title: "キャスト追加",
      description: "新しいキャストが追加されました",
    });
    setIsAddDialogOpen(false);
  };

  const handleEditCast = (id: string) => {
    toast({
      title: "キャスト編集",
      description: "キャスト情報を編集できます",
    });
  };

  const handleDeleteCast = (id: string) => {
    setCasts(prev => prev.filter(cast => cast.id !== id));
    toast({
      title: "キャスト削除",
      description: "キャストが削除されました",
      variant: "destructive",
    });
  };

  const handleStatusChange = (id: string, newStatus: "waiting" | "busy" | "offline") => {
    setCasts(prev => prev.map(cast => 
      cast.id === id ? { ...cast, status: newStatus } : cast
    ));
    const statusText = newStatus === "waiting" ? "待機中" : 
                      newStatus === "busy" ? "接客中" : "退勤";
    toast({
      title: "ステータス変更",
      description: `ステータスを「${statusText}」に変更しました`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "bg-green-100 text-green-800";
      case "busy": return "bg-red-100 text-red-800";
      case "offline": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "waiting": return "待機中";
      case "busy": return "接客中";
      case "offline": return "退勤";
      default: return "不明";
    }
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
                <h1 className="text-2xl font-bold">キャスト管理</h1>
                <p className="text-muted-foreground">キャストの登録・管理・ステータス確認</p>
              </div>
              
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">キャスト名</Label>
                        <Input id="name" placeholder="美咲" />
                      </div>
                      <div>
                        <Label htmlFor="age">年齢</Label>
                        <Input id="age" type="number" placeholder="23" min="18" max="50" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type">ランク</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="ランクを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="スタンダード">スタンダード</SelectItem>
                            <SelectItem value="プレミアム">プレミアム</SelectItem>
                            <SelectItem value="VIP">VIP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="price">料金 (60分)</Label>
                        <Input id="price" type="number" placeholder="12000" />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="measurements">スリーサイズ</Label>
                      <Input id="measurements" placeholder="B85-W58-H86" />
                    </div>
                    
                    <div>
                      <Label htmlFor="profile">プロフィール</Label>
                      <Textarea id="profile" rows={3} placeholder="キャストの魅力や特徴を入力..." />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">電話番号</Label>
                      <Input id="phone" placeholder="090-1234-5678" />
                    </div>
                    
                    <div>
                      <Label htmlFor="photo">写真URL</Label>
                      <Input id="photo" placeholder="https://..." />
                    </div>
                    
                    <Button onClick={handleAddCast} className="w-full">
                      追加
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

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
                      <SelectItem value="all">全ランク</SelectItem>
                      <SelectItem value="スタンダード">スタンダード</SelectItem>
                      <SelectItem value="プレミアム">プレミアム</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全状態</SelectItem>
                      <SelectItem value="waiting">待機中</SelectItem>
                      <SelectItem value="busy">接客中</SelectItem>
                      <SelectItem value="offline">退勤</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Cast List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCasts.map((cast) => (
                <Card key={cast.id} className="overflow-hidden">
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img 
                      src={cast.photo} 
                      alt={cast.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className={getStatusColor(cast.status)}>
                        {getStatusText(cast.status)}
                      </Badge>
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary">{cast.type}</Badge>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {cast.name} ({cast.age})
                          <div className="flex items-center text-yellow-500">
                            <Star size={16} fill="currentColor" />
                            <span className="text-sm ml-1">{cast.rating}</span>
                          </div>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{cast.measurements}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">¥{cast.price.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">60分</div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {cast.profile}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <TrendingUp size={12} />
                          <span>今月: ¥{cast.monthSales.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>出勤: {cast.workDays}日</span>
                        </div>
                      </div>
                      
                      {cast.status === "waiting" && cast.waitingTime && (
                        <div className="text-xs text-green-600 font-medium">
                          待機時間: {cast.waitingTime}
                        </div>
                      )}
                    </div>
                    
                    {/* Status Change Buttons */}
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
                        onClick={() => handleEditCast(cast.id)}
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
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredCasts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                検索条件に一致するキャストが見つかりません
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}