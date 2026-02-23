import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pin, Pencil, Trash2, BookOpen, X } from "lucide-react";

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ["一般", "セラピスト管理", "支払い", "経費", "運営", "マニュアル", "ルール"];

export default function Knowledge() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [viewArticle, setViewArticle] = useState<KnowledgeArticle | null>(null);

  // Form state
  const [form, setForm] = useState({ title: "", content: "", category: "一般", tags: "" });

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from("knowledge_articles")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setArticles(data as unknown as KnowledgeArticle[]);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setSelectedArticle(null);
    setForm({ title: "", content: "", category: "一般", tags: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (article: KnowledgeArticle) => {
    setSelectedArticle(article);
    setForm({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags?.join(", ") || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "タイトルを入力してください", variant: "destructive" });
      return;
    }

    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    const payload = {
      title: form.title,
      content: form.content,
      category: form.category,
      tags,
      created_by: user?.id,
    };

    let error;
    if (selectedArticle) {
      ({ error } = await supabase
        .from("knowledge_articles")
        .update(payload)
        .eq("id", selectedArticle.id));
    } else {
      ({ error } = await supabase.from("knowledge_articles").insert(payload));
    }

    if (error) {
      toast({ title: "保存に失敗しました", description: error.message, variant: "destructive" });
    } else {
      toast({ title: selectedArticle ? "更新しました" : "作成しました" });
      setDialogOpen(false);
      fetchArticles();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この記事を削除しますか？")) return;
    const { error } = await supabase.from("knowledge_articles").delete().eq("id", id);
    if (!error) {
      toast({ title: "削除しました" });
      if (viewArticle?.id === id) setViewArticle(null);
      fetchArticles();
    }
  };

  const handleTogglePin = async (article: KnowledgeArticle) => {
    await supabase
      .from("knowledge_articles")
      .update({ is_pinned: !article.is_pinned })
      .eq("id", article.id);
    fetchArticles();
  };

  const filtered = articles.filter(a => {
    const matchSearch = !search || 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase()) ||
      a.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = filterCategory === "all" || a.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="md:ml-[180px] pt-[60px] p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen size={24} />
                社内ナレッジ
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                業務マニュアル・運営ルール・ノウハウを管理
              </p>
            </div>
            {isAdmin && (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                新規作成
              </Button>
            )}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="キーワード検索..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのカテゴリ</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Article Detail */}
          {viewArticle ? (
            <div className="mb-6">
              <Button variant="ghost" size="sm" onClick={() => setViewArticle(null)} className="mb-4">
                ← 一覧に戻る
              </Button>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">{viewArticle.category}</Badge>
                        {viewArticle.is_pinned && <Pin size={14} className="text-primary" />}
                      </div>
                      <CardTitle className="text-xl">{viewArticle.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        更新: {new Date(viewArticle.updated_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(viewArticle)}>
                          <Pencil size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(viewArticle.id)}>
                          <Trash2 size={16} className="text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {viewArticle.content}
                  </div>
                  {viewArticle.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t">
                      {viewArticle.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Article List */
            <div className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-12">読み込み中...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {search || filterCategory !== "all" ? "該当する記事がありません" : "まだ記事がありません"}
                </p>
              ) : (
                filtered.map(article => (
                  <Card
                    key={article.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setViewArticle(article)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {article.is_pinned && <Pin size={14} className="text-primary shrink-0" />}
                            <Badge variant="secondary" className="text-xs shrink-0">{article.category}</Badge>
                            <h3 className="font-semibold truncate">{article.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{article.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(article.updated_at).toLocaleDateString("ja-JP")}
                            </span>
                            {article.tags?.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTogglePin(article)}>
                              <Pin size={14} className={article.is_pinned ? "text-primary" : ""} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(article)}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(article.id)}>
                              <Trash2 size={14} className="text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedArticle ? "記事を編集" : "新規記事を作成"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>タイトル</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="記事のタイトル"
              />
            </div>
            <div>
              <Label>カテゴリ</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>内容</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="記事の内容を入力..."
                className="min-h-[300px]"
              />
            </div>
            <div>
              <Label>タグ（カンマ区切り）</Label>
              <Input
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="例: 新人向け, 重要, 手続き"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleSave}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
