import { useState } from "react";
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Staff {
  id: string;
  name: string;
  role: string;
  status: "active" | "inactive";
  phone: string;
  email: string;
  joinDate: string;
}

const staffData: Staff[] = [
  {
    id: "1",
    name: "田中 美咲",
    role: "セラピスト",
    status: "active",
    phone: "090-1234-5678",
    email: "tanaka@example.com",
    joinDate: "2024-01-15"
  },
  {
    id: "2", 
    name: "佐藤 花音",
    role: "セラピスト",
    status: "active",
    phone: "090-2345-6789",
    email: "sato@example.com",
    joinDate: "2024-02-01"
  },
  {
    id: "3",
    name: "鈴木 愛美",
    role: "受付",
    status: "inactive",
    phone: "090-3456-7890", 
    email: "suzuki@example.com",
    joinDate: "2023-12-10"
  }
];

export default function Staff() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>(staffData);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || member.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleAddStaff = () => {
    toast({
      title: "スタッフ追加",
      description: "新しいスタッフが追加されました",
    });
    setIsAddDialogOpen(false);
  };

  const handleEditStaff = (id: string) => {
    toast({
      title: "スタッフ編集",
      description: "スタッフ情報を編集できます",
    });
  };

  const handleDeleteStaff = (id: string) => {
    setStaff(prev => prev.filter(member => member.id !== id));
    toast({
      title: "スタッフ削除",
      description: "スタッフが削除されました",
      variant: "destructive",
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
                <h1 className="text-2xl font-bold">スタッフ管理</h1>
                <p className="text-muted-foreground">スタッフの登録・管理を行います</p>
              </div>
              
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus size={16} />
                    新規追加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新しいスタッフを追加</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">氏名</Label>
                      <Input id="name" placeholder="田中 美咲" />
                    </div>
                    <div>
                      <Label htmlFor="role">職種</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="職種を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="therapist">セラピスト</SelectItem>
                          <SelectItem value="receptionist">受付</SelectItem>
                          <SelectItem value="manager">店長</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="phone">電話番号</Label>
                      <Input id="phone" placeholder="090-1234-5678" />
                    </div>
                    <div>
                      <Label htmlFor="email">メールアドレス</Label>
                      <Input id="email" type="email" placeholder="example@email.com" />
                    </div>
                    <Button onClick={handleAddStaff} className="w-full">
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
                      placeholder="名前やメールアドレスで検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全ての職種</SelectItem>
                      <SelectItem value="セラピスト">セラピスト</SelectItem>
                      <SelectItem value="受付">受付</SelectItem>
                      <SelectItem value="店長">店長</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Staff List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStaff.map((member) => (
                <Card key={member.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{member.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                      </div>
                      <Badge variant={member.status === "active" ? "default" : "secondary"}>
                        {member.status === "active" ? "稼働中" : "休止中"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">電話:</span> {member.phone}
                      </div>
                      <div>
                        <span className="text-muted-foreground">メール:</span> {member.email}
                      </div>
                      <div>
                        <span className="text-muted-foreground">入社日:</span> {member.joinDate}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditStaff(member.id)}
                        className="flex-1"
                      >
                        <Edit size={14} />
                        編集
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteStaff(member.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredStaff.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                検索条件に一致するスタッフが見つかりません
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}