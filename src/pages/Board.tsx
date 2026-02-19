import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pin, Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface BoardPost {
  id: string;
  author_name: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

const Board = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BoardPost | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["board-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_posts")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BoardPost[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (post: { title: string; content: string; author_name: string }) => {
      const { error } = await supabase.from("board_posts").insert(post);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-posts"] });
      toast.success("投稿しました");
      resetForm();
    },
    onError: () => toast.error("投稿に失敗しました"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string; is_pinned?: boolean }) => {
      const { error } = await supabase.from("board_posts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-posts"] });
      toast.success("更新しました");
      resetForm();
    },
    onError: () => toast.error("更新に失敗しました"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("board_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-posts"] });
      toast.success("削除しました");
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setAuthorName("");
    setEditingPost(null);
    setDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, title, content });
    } else {
      createMutation.mutate({ title, content, author_name: authorName || "管理者" });
    }
  };

  const openEdit = (post: BoardPost) => {
    setEditingPost(post);
    setTitle(post.title);
    setContent(post.content);
    setAuthorName(post.author_name);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="md:ml-[180px] pt-[60px] p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold">掲示板</h1>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus size={14} className="mr-1" />投稿</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPost ? "投稿を編集" : "新規投稿"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {!editingPost && (
                    <Input placeholder="投稿者名" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
                  )}
                  <Input placeholder="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <Textarea placeholder="内容" rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
                  <Button onClick={handleSubmit} className="w-full" disabled={!title.trim() || !content.trim()}>
                    {editingPost ? "更新" : "投稿"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">投稿がありません</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} className={post.is_pinned ? "border-primary/40" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {post.is_pinned && <Pin size={12} className="text-primary shrink-0" />}
                        <h3 className="font-semibold text-sm truncate">{post.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {post.author_name} · {format(new Date(post.created_at), "M/d HH:mm", { locale: ja })}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateMutation.mutate({ id: post.id, is_pinned: !post.is_pinned })}
                        >
                          <Pin size={12} className={post.is_pinned ? "text-primary" : ""} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(post)}>
                          <Edit2 size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate(post.id); }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Board;
