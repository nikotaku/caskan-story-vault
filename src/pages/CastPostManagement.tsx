import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CheckCircle, ChevronDown, ChevronUp, Clock, Link2, Loader2, Plus, RefreshCw, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Cast { id: string; name: string; }
interface Post {
  id: string;
  cast_id: string;
  title: string | null;
  body: string;
  image_urls: string[] | null;
  status: string;
  hp_status: string;
  o2_status: string;
  esutama_status: string;
  o2_error: string | null;
  esutama_error: string | null;
  created_at: string;
  casts: { name: string };
}

type Target = "o2" | "esutama";

const STATUS_LABEL: Record<string, string> = {
  pending: "送信待ち",
  posting: "送信中",
  posted: "投稿済み",
  failed: "失敗",
  skipped: "未設定",
};

const STATUS_ICON: Record<string, JSX.Element> = {
  pending: <Clock size={13} className="text-amber-500" />,
  posting: <Loader2 size={13} className="animate-spin text-blue-500" />,
  posted: <CheckCircle size={13} className="text-green-600" />,
  failed: <XCircle size={13} className="text-red-500" />,
  skipped: <span className="text-xs text-muted-foreground">−</span>,
};

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (rpcName: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(name, args);

const createTestPostBody = () => `【動作確認】\nO2・魂セラピスト連携のテスト投稿です。\n${format(new Date(), "yyyy年M月d日 HH:mm", { locale: ja })}`;

const canDeleteFailedPost = (post: Post) => {
  const hasPublishedTarget = [post.hp_status, post.o2_status, post.esutama_status].includes("posted");
  const isPosting = [post.o2_status, post.esutama_status].includes("posting");
  const hasError = post.status === "failed"
    || [post.o2_status, post.esutama_status].some((status) => ["failed", "skipped"].includes(status))
    || Boolean(post.o2_error || post.esutama_error);
  return hasError && !hasPublishedTarget && !isPosting;
};

export default function CastPostManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCastId = searchParams.get("cast") || "";
  const requestedTestMode = searchParams.get("mode") === "test";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [credentials, setCredentials] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(() => Boolean(requestedCastId));
  const [testMode, setTestMode] = useState(requestedTestMode);
  const [showConnections, setShowConnections] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(() => ({
    castId: requestedCastId,
    title: requestedTestMode ? "動作確認" : "",
    body: requestedTestMode ? createTestPostBody() : "",
    imageUrls: "",
  }));
  const { user, loading: authLoading } = useAuth();
  const { storeId, store, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, navigate, user]);

  const load = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    const [castsResult, postsResult, credentialsResult] = await Promise.all([
      supabase.from("casts").select("id,name").eq("store_id", storeId).order("display_order", { ascending: true }),
      supabase.from("cast_posts").select("*,casts(name)").eq("store_id", storeId).order("created_at", { ascending: false }).limit(100),
      supabase.from("cast_site_credentials").select("cast_id,site").eq("store_id", storeId).in("site", ["o2", "esutama"]),
    ]);
    if (castsResult.error || postsResult.error || credentialsResult.error) {
      toast.error("投稿管理データを取得できませんでした");
    }
    setCasts((castsResult.data || []) as Cast[]);
    setPosts((postsResult.data || []) as Post[]);
    const next: Record<string, Set<string>> = {};
    (credentialsResult.data || []).forEach((credential) => {
      (next[credential.cast_id] ??= new Set()).add(credential.site);
    });
    setCredentials(next);
    setLoading(false);
  }, [storeId, storeLoading, user]);

  useEffect(() => { void load(); }, [load]);

  const clearPostQuery = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("cast");
    nextParams.delete("mode");
    setSearchParams(nextParams, { replace: true });
  };

  const openNewPost = () => {
    setTestMode(false);
    setForm({ castId: "", title: "", body: "", imageUrls: "" });
    clearPostQuery();
    setShowDialog(true);
  };

  const changeDialogOpen = (open: boolean) => {
    setShowDialog(open);
    if (!open) clearPostQuery();
  };

  const publishTarget = async (postId: string, target: Target) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("ログインが期限切れです");
    const response = await fetch("/api/automations/admin-portal-post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ postId, target }),
    });
    const payload = await response.json();
    if (!response.ok || payload?.status === "failed") {
      const fallback = target === "o2" ? "O2投稿に失敗しました" : "魂セラピスト投稿に失敗しました";
      throw new Error(payload?.error || payload?.results?.o2?.error || payload?.result?.error || fallback);
    }
    return payload;
  };

  const handleSubmit = async () => {
    const body = form.body.trim();
    if (!form.castId || !body) {
      toast.error("セラピストと本文は必須です");
      return;
    }
    if (form.title.length > 120 || body.length > 5000) {
      toast.error("タイトル120文字、本文5000文字以内で入力してください");
      return;
    }
    const imageUrls = form.imageUrls.split("\n").map((value) => value.trim()).filter(Boolean);
    if (imageUrls.length > 3 || imageUrls.some((url) => !url.startsWith("https://"))) {
      toast.error("画像URLはHTTPSで3件まで入力できます");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await rpc("create_admin_multi_post", {
        p_store_id: storeId,
        p_cast_id: form.castId,
        p_title: form.title || null,
        p_body: body,
        p_image_urls: imageUrls.length ? imageUrls : null,
      });
      if (error || typeof data !== "string") throw new Error(error?.message || "投稿を作成できませんでした");
      setShowDialog(false);
      setTestMode(false);
      clearPostQuery();
      setForm({ castId: "", title: "", body: "", imageUrls: "" });
      toast.success("O2・魂セラピストへ送信中です");
      await load();
      const results = await Promise.allSettled([publishTarget(data, "o2"), publishTarget(data, "esutama")]);
      await load();
      if (results.some((result) => result.status === "rejected")) {
        toast.warning("外部媒体の一部に送れませんでした。失敗した媒体だけ再送できます");
      } else {
        toast.success("O2・魂セラピストへの投稿処理が完了しました");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (postId: string, target: Target) => {
    const key = `${postId}:${target}`;
    setRetrying(key);
    try {
      await publishTarget(postId, target);
      toast.success(`${target === "o2" ? "O2" : "魂セラピスト"}へ再送しました`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "再送に失敗しました");
    } finally {
      await load();
      setRetrying(null);
    }
  };

  const deleteFailedPost = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await rpc("delete_admin_failed_cast_post", { p_post_id: deleteTarget.id });
      if (error || data !== true) throw new Error(error?.message || "投稿を削除できませんでした");
      setDeleteTarget(null);
      toast.success("送信エラーの投稿を削除しました");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "投稿を削除できませんでした");
    } finally {
      setDeleting(false);
    }
  };

  const statusRow = (post: Post, target: Target, label: string) => {
    const status = target === "o2" ? post.o2_status : post.esutama_status;
    const error = target === "o2" ? post.o2_error : post.esutama_error;
    const key = `${post.id}:${target}`;
    return (
      <div className="flex items-start justify-between gap-3 text-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">{STATUS_ICON[status] || STATUS_ICON.pending}<span className="font-medium">{label}</span><span className="text-muted-foreground">{STATUS_LABEL[status] || status}</span></div>
          {error && <p className="mt-1 break-words text-red-600">{error}</p>}
        </div>
        {["pending", "failed", "skipped"].includes(status) && (
          <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => retry(post.id, target)} disabled={retrying === key}>
            {retrying === key ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} className="mr-1" />}再送
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((value) => !value)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">一括投稿管理</h1>
              <p className="text-sm text-muted-foreground">{store?.name || "店舗"}のO2・魂セラピストへ同時投稿します</p>
            </div>
            <Button onClick={openNewPost}><Plus size={16} className="mr-1" />新規投稿</Button>
          </div>

          <div className="rounded-lg border bg-card">
            <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => setShowConnections((value) => !value)}>
              <span className="flex items-center gap-2 text-sm font-semibold"><Link2 size={16} className="text-primary" />媒体連携ステータス</span>
              {showConnections ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showConnections && (
              <div className="grid gap-x-6 border-t px-4 py-3 sm:grid-cols-2">
                {casts.map((cast) => {
                  const sites = credentials[cast.id] || new Set<string>();
                  return (
                    <div key={cast.id} className="flex items-center justify-between border-b border-dashed py-1.5 text-xs">
                      <span className="truncate font-medium">{cast.name}</span>
                      <span className="flex shrink-0 gap-2">
                        <Badge variant={sites.has("o2") ? "default" : "outline"}>O2</Badge>
                        <Badge variant={sites.has("esutama") ? "default" : "outline"}>魂</Badge>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">投稿がありません</div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <article key={post.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="font-semibold">{post.casts?.name}</span><span className="text-xs text-muted-foreground">{format(new Date(post.created_at), "M/d HH:mm", { locale: ja })}</span></div>
                      {post.title && <p className="mt-1 text-sm font-medium">{post.title}</p>}
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{post.body}</p>
                    </div>
                    {canDeleteFailedPost(post) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(post)}
                      >
                        <Trash2 size={14} className="mr-1" />削除
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
                    {statusRow(post, "o2", "O2")}
                    {statusRow(post, "esutama", "魂セラピスト")}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={showDialog} onOpenChange={changeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{testMode ? "O2・魂セラピストへテスト投稿" : "2媒体へ一括投稿"}</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            <div><Label>セラピスト</Label><Select value={form.castId} onValueChange={(value) => setForm({ ...form, castId: value })}><SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger><SelectContent>{casts.map((cast) => <SelectItem key={cast.id} value={cast.id}>{cast.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>タイトル（任意）</Label><Input maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div><Label>本文</Label><Textarea rows={6} maxLength={5000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="投稿内容を入力" /></div>
            <div><Label>画像URL（任意・1行1URL・3件まで）</Label><Textarea rows={3} value={form.imageUrls} onChange={(event) => setForm({ ...form, imageUrls: event.target.value })} placeholder="https://..." /></div>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">O2と魂セラピストへ同時送信します。HP写メ日記やその他のSNSには掲載しません。</p>
            <div className="flex gap-2"><Button className="flex-1" onClick={handleSubmit} disabled={submitting}>{submitting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}{testMode ? "テスト投稿" : "一括投稿"}</Button><Button variant="outline" className="flex-1" onClick={() => changeDialogOpen(false)} disabled={submitting}>キャンセル</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>送信エラーの投稿を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.casts?.name}さんの投稿履歴と、関連する再送待ちジョブを削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void deleteFailedPost(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Trash2 size={14} className="mr-1" />}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
