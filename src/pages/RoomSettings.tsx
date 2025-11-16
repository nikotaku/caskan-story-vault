import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Room {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  amenities: string[] | null;
  is_active: boolean;
}

const RoomSettings = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    capacity: 1,
    amenities: "",
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "エラー",
        description: "ルーム情報の取得に失敗しました",
        variant: "destructive",
      });
      return;
    }

    setRooms(data || []);
  };

  const handleOpenDialog = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setFormData({
        name: room.name,
        description: room.description || "",
        capacity: room.capacity,
        amenities: room.amenities?.join(", ") || "",
        is_active: room.is_active,
      });
    } else {
      setEditingRoom(null);
      setFormData({
        name: "",
        description: "",
        capacity: 1,
        amenities: "",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "エラー",
        description: "ルーム名を入力してください",
        variant: "destructive",
      });
      return;
    }

    const amenitiesArray = formData.amenities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a);

    const roomData = {
      name: formData.name,
      description: formData.description || null,
      capacity: formData.capacity,
      amenities: amenitiesArray.length > 0 ? amenitiesArray : null,
      is_active: formData.is_active,
    };

    if (editingRoom) {
      const { error } = await supabase
        .from("rooms")
        .update(roomData)
        .eq("id", editingRoom.id);

      if (error) {
        toast({
          title: "エラー",
          description: "ルームの更新に失敗しました",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "成功",
        description: "ルームを更新しました",
      });
    } else {
      const { error } = await supabase.from("rooms").insert(roomData);

      if (error) {
        toast({
          title: "エラー",
          description: "ルームの追加に失敗しました",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "成功",
        description: "ルームを追加しました",
      });
    }

    setIsDialogOpen(false);
    fetchRooms();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);

    if (error) {
      toast({
        title: "エラー",
        description: "ルームの削除に失敗しました",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "成功",
      description: "ルームを削除しました",
    });

    fetchRooms();
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">ルーム設定</h1>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    ルーム追加
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingRoom ? "ルーム編集" : "ルーム追加"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">ルーム名 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="例: インroom"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">説明</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="ルームの説明を入力"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="capacity">収容人数</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min="1"
                        value={formData.capacity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            capacity: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="amenities">
                        設備・備品（カンマ区切り）
                      </Label>
                      <Input
                        id="amenities"
                        value={formData.amenities}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            amenities: e.target.value,
                          })
                        }
                        placeholder="例: シャワー, タオル, ドライヤー"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_active: checked })
                        }
                      />
                      <Label htmlFor="is_active">有効</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSave}
                        className="flex-1"
                      >
                        保存
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        className="flex-1"
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <Card key={room.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{room.name}</span>
                      <div className="flex items-center gap-2">
                        {room.is_active ? (
                          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-600 rounded">
                            有効
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-600 rounded">
                            無効
                          </span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {room.description && (
                      <p className="text-sm text-muted-foreground">
                        {room.description}
                      </p>
                    )}
                    <div className="text-sm">
                      <span className="font-semibold">収容人数:</span>{" "}
                      {room.capacity}人
                    </div>
                    {room.amenities && room.amenities.length > 0 && (
                      <div className="text-sm">
                        <span className="font-semibold">設備:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {room.amenities.map((amenity, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 bg-muted rounded text-xs"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(room)}
                        className="flex-1"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        編集
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="w-4 h-4 mr-1" />
                            削除
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              本当に削除しますか？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              この操作は取り消せません。ルーム「{room.name}
                              」を削除してもよろしいですか？
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(room.id)}
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <footer className="mt-auto py-4 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-muted-foreground">
              © 2025 caskan.jp All rights reserved
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default RoomSettings;