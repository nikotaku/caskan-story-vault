import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Trash2, Upload, GripVertical, Plus } from "lucide-react";

interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
}

export function BannerManagement() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newBanner, setNewBanner] = useState({ title: "", image_url: "", link_url: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("display_order", { ascending: true });
    if (!error && data) setBanners(data as Banner[]);
    setLoading(false);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("banners").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      toast({ title: "アップロード失敗", variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setNewBanner({ ...newBanner, image_url: url });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAdd = async () => {
    if (!newBanner.image_url) {
      toast({ title: "画像をアップロードしてください", variant: "destructive" });
      return;
    }
    const maxOrder = banners.reduce((m, b) => Math.max(m, b.display_order), 0);
    const { error } = await supabase.from("banners").insert({
      title: newBanner.title || null,
      image_url: newBanner.image_url,
      link_url: newBanner.link_url || null,
      display_order: maxOrder + 1,
      is_active: true,
    });
    if (error) {
      toast({ title: "追加失敗", description: error.message, variant: "destructive" });
      return;
    }
    setNewBanner({ title: "", image_url: "", link_url: "" });
    toast({ title: "バナーを追加しました" });
    fetchBanners();
  };

  const handleUpdate = async (id: string, patch: Partial<Banner>) => {
    const { error } = await supabase.from("banners").update(patch).eq("id", id);
    if (error) {
      toast({ title: "更新失敗", variant: "destructive" });
      return;
    }
    fetchBanners();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (!error) {
      toast({ title: "削除しました" });
      fetchBanners();
    }
  };

  const handleDrop = async (targetId: string) => {
    if (!dragId.current || dragId.current === targetId) return;
    const fromIdx = banners.findIndex((b) => b.id === dragId.current);
    const toIdx = banners.findIndex((b) => b.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...banners];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setBanners(reordered);
    dragId.current = null;
    // Persist
    await Promise.all(
      reordered.map((b, i) =>
        supabase.from("banners").update({ display_order: i + 1 }).eq("id", b.id)
      )
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" /> トップページバナー
        </CardTitle>
        <CardDescription>
          スケジュールページ（トップ）に表示されるバナーを管理します。ドラッグして並び替えできます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New banner form */}
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <h4 className="font-medium text-sm">新規バナー追加</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">タイトル（任意）</Label>
              <Input
                value={newBanner.title}
                onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                placeholder="春のキャンペーン"
              />
            </div>
            <div>
              <Label className="text-xs">リンクURL（任意）</Label>
              <Input
                value={newBanner.link_url}
                onChange={(e) => setNewBanner({ ...newBanner, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">画像</Label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "アップロード中..." : "画像を選択"}
              </Button>
              {newBanner.image_url && (
                <img
                  src={newBanner.image_url}
                  alt="preview"
                  className="h-12 w-24 object-cover rounded border"
                />
              )}
            </div>
          </div>
          <Button onClick={handleAdd} size="sm" disabled={!newBanner.image_url}>
            <Plus className="h-4 w-4 mr-1" /> 追加
          </Button>
        </div>

        {/* Banner list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            バナーが登録されていません
          </p>
        ) : (
          <div className="space-y-2">
            {banners.map((b) => (
              <div
                key={b.id}
                draggable
                onDragStart={() => (dragId.current = b.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(b.id)}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move flex-shrink-0" />
                <img
                  src={b.image_url}
                  alt={b.title || "banner"}
                  className="h-14 w-28 object-cover rounded border flex-shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <Input
                    value={b.title || ""}
                    placeholder="タイトル"
                    className="h-8 text-sm"
                    onChange={(e) =>
                      setBanners((prev) =>
                        prev.map((x) => (x.id === b.id ? { ...x, title: e.target.value } : x))
                      )
                    }
                    onBlur={(e) => handleUpdate(b.id, { title: e.target.value || null })}
                  />
                  <Input
                    value={b.link_url || ""}
                    placeholder="リンクURL"
                    className="h-8 text-xs"
                    onChange={(e) =>
                      setBanners((prev) =>
                        prev.map((x) => (x.id === b.id ? { ...x, link_url: e.target.value } : x))
                      )
                    }
                    onBlur={(e) => handleUpdate(b.id, { link_url: e.target.value || null })}
                  />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch
                    checked={b.is_active}
                    onCheckedChange={(v) => handleUpdate(b.id, { is_active: v })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
