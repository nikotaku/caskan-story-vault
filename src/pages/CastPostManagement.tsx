import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Check, CheckCircle, ChevronDown, ChevronUp, Clock, ImagePlus, Link2, Loader2, Plus, RefreshCw, Send, ShieldAlert, Trash2, X, XCircle } from "lucide-react";
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
import { canDeleteFailedCastPost } from "@/lib/cast-post-deletion";
import { isEstamaReviewRequired } from "@/lib/estama-post-status";
import { POST_IMAGE_SIZE, prepareSquarePostImage } from "@/lib/post-image";

interface Cast { id: string; name: string; }

// テスト投稿が完了した媒体（O2・魂セラピスト）のチェックマーク状態
type TestCompletionMap = Record<string, Partial<Record<Target, string>>>;
interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}
interface Post {
  id: string;
  cast_id: string;
  title: string | null;
  body: string;
  image_urls: string[] | null;
  status: string;
  hp_status: string;
  hp_error: string | null;
  o2_status: string;
  esutama_status: string;
  o2_error: string | null;
  esutama_error: string | null;
  created_at: string;
  casts: { name: string };
}

type Target = "o2" | "esutama";

const MAX_IMAGES = 1;

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
  return canDeleteFailedCastPost({
    ...post,
    estamaReviewRequired: isEstamaReviewRequired(post.esutama_error),
  });
};

export default function CastPostManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCastId = searchParams.get("cast") || "";
  const requestedTestMode = searchParams.get("mode") === "test";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [credentials, setCredentials] = useState<Record<string, Set<string>>>({});
  const [testCompletions, setTestCompletions] = useState<TestCompletionMap>({});
  const [togglingCompletion, setTogglingCompletion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(() => Boolean(requestedCastId));
  const [testMode, setTestMode] = useState(requestedTestMode);
  const [showConnections, setShowConnections] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(() => ({
    castId: requestedCastId,
    title: requestedTestMode ? "動作確認" : "",
    body: requestedTestMode ? createTestPostBody() : "",
  }));
  const [images, setImages] = useState<PendingImage[]>([]);
  const imagesRef = useRef<PendingImage[]>([]);
  const { user, loading: authLoading } = useAuth();
  const { storeId, store, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  const clearSelectedImages = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, navigate, user]);

  const load = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    const [castsResult, postsResult, credentialsResult, completionsResult] = await Promise.all([
      supabase.from("casts").select("id,name").eq("store_id", storeId).eq("is_active", true).order("display_order", { ascending: true }),
      supabase.from("cast_posts").select("*,casts(name)").eq("store_id", storeId).order("created_at", { ascending: false }).limit(100),
      supabase.rpc("get_site_connection_status_admin", { p_store_id: storeId }),
      supabase.from("cast_test_post_completions").select("cast_id,site,completed_at").eq("store_id", storeId),
    ]);
    if (castsResult.error || postsResult.error || credentialsResult.error || completionsResult.error) {
      toast.error("投稿管理データを取得できませんでした");
    }
    setCasts((castsResult.data || []) as Cast[]);
    setPosts((postsResult.data || []) as Post[]);
    const next: Record<string, Set<string>> = {};
    (credentialsResult.data || []).forEach((credential) => {
      (next[credential.cast_id] ??= new Set()).add(credential.site);
    });
    setCredentials(next);
    const nextCompletions: TestCompletionMap = {};
    ((completionsResult.data || []) as { cast_id: string; site: string; completed_at: string }[]).forEach((completion) => {
      if (completion.site === "o2" || completion.site === "esutama") {
        (nextCompletions[completion.cast_id] ??= {})[completion.site] = completion.completed_at;
      }
    });
    setTestCompletions(nextCompletions);
    setLoading(false);
  }, [storeId, storeLoading, user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  useEffect(() => {
    if (loading || !requestedCastId || casts.some((cast) => cast.id === requestedCastId)) return;
    setShowDialog(false);
    clearSelectedImages();
    setForm((current) => ({ ...current, castId: "" }));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("cast");
    nextParams.delete("mode");
    setSearchParams(nextParams, { replace: true });
    toast.error("アーカイブ済みのセラピストには投稿できません");
  }, [casts, clearSelectedImages, loading, requestedCastId, searchParams, setSearchParams]);

  const clearPostQuery = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("cast");
    nextParams.delete("mode");
    setSearchParams(nextParams, { replace: true });
  };

  const openNewPost = () => {
    setTestMode(false);
    clearSelectedImages();
    setForm({ castId: "", title: "", body: "" });
    clearPostQuery();
    setShowDialog(true);
  };

  const changeDialogOpen = (open: boolean) => {
    if (!open && (submitting || preparingImage)) return;
    setShowDialog(open);
    if (!open) {
      clearSelectedImages();
      clearPostQuery();
    }
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selectedFiles.length) return;
    if (images.length || selectedFiles.length !== MAX_IMAGES) {
      toast.error("画像は1枚だけ選択してください");
      return;
    }
    setPreparingImage(true);
    try {
      const file = await prepareSquarePostImage(selectedFiles[0]);
      setImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return [{
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        }];
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "画像を600×600へ変換できませんでした");
    } finally {
      setPreparingImage(false);
    }
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  };

  const cleanupUploadedPaths = async (paths: string[]) => {
    if (!paths.length) return true;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await supabase.storage.from("cast-photos").remove(paths);
      if (!error) return true;
      lastError = error;
    }
    console.error("Uploaded image cleanup failed", lastError);
    return false;
  };

  const uploadImages = async () => {
    const paths: string[] = [];
    const urls: string[] = [];
    for (const image of images) {
      const path = `admin-posts/${storeId}/${form.castId}/${crypto.randomUUID()}-600x600.jpg`;
      const { error } = await supabase.storage.from("cast-photos").upload(path, image.file, {
        cacheControl: "3600",
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) {
        const cleaned = await cleanupUploadedPaths(paths);
        throw new Error(cleaned
          ? "画像をアップロードできませんでした"
          : "画像をアップロードできず、途中画像の削除にも失敗しました");
      }
      paths.push(path);
      urls.push(supabase.storage.from("cast-photos").getPublicUrl(path).data.publicUrl);
    }
    return { paths, urls };
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
    if (images.length !== MAX_IMAGES) {
      toast.error("600×600に変換した画像を1枚選択してください");
      return;
    }
    if (!casts.some((cast) => cast.id === form.castId)) {
      toast.error("アーカイブ済みのセラピストには投稿できません");
      return;
    }
    if (form.title.length > 120 || body.length > 5000) {
      toast.error("タイトル120文字、本文5000文字以内で入力してください");
      return;
    }
    setSubmitting(true);
    let uploadedPaths: string[] = [];
    let postCreated = false;
    try {
      setUploadingImages(true);
      const uploaded = await uploadImages();
      uploadedPaths = uploaded.paths;
      setUploadingImages(false);
      const publishToHp = !testMode;
      const { data, error } = await rpc("create_admin_multi_post", {
        p_store_id: storeId,
        p_cast_id: form.castId,
        p_title: form.title || null,
        p_body: body,
        p_image_urls: uploaded.urls.length ? uploaded.urls : null,
        p_publish_hp: publishToHp,
      });
      if (error || typeof data !== "string") throw new Error(error?.message || "投稿を作成できませんでした");
      postCreated = true;
      setShowDialog(false);
      setTestMode(false);
      clearPostQuery();
      setForm({ castId: "", title: "", body: "" });
      clearSelectedImages();
      toast.success(publishToHp
        ? "HP写メ日記へ掲載し、O2・魂セラピストへ送信中です"
        : "O2・魂セラピストへテスト送信中です");
      await load();
      const results = await Promise.allSettled([publishTarget(data, "o2"), publishTarget(data, "esutama")]);
      await load();
      if (results.some((result) => result.status === "rejected")) {
        toast.warning("外部媒体の一部へ送信できませんでした。投稿履歴の状態を確認してください");
      } else {
        toast.success(publishToHp
          ? "HP写メ日記・O2・魂セラピストへの投稿が完了しました"
          : "O2・魂セラピストへのテスト投稿が完了しました");
      }
    } catch (error) {
      let cleanupFailed = false;
      if (!postCreated && uploadedPaths.length) {
        cleanupFailed = !await cleanupUploadedPaths(uploadedPaths);
      }
      const message = error instanceof Error ? error.message : "投稿に失敗しました";
      toast.error(cleanupFailed ? `${message}。途中画像の削除にも失敗しました` : message);
    } finally {
      setUploadingImages(false);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("ログインが期限切れです");
      const response = await fetch("/api/automations/admin-portal-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "delete-failed-post", postId: deleteTarget.id }),
      });
      const payload = await response.json().catch(() => ({})) as {
        deleted?: boolean;
        imageCleanupFailed?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.deleted) {
        throw new Error(payload.error || "投稿を削除できませんでした");
      }
      setDeleteTarget(null);
      if (payload.imageCleanupFailed) {
        toast.warning("エラー履歴とHP写メ日記は削除しましたが、保存画像の削除に失敗しました");
      } else {
        toast.success("エラー履歴・HP写メ日記・保存画像を削除しました");
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "投稿を削除できませんでした");
    } finally {
      setDeleting(false);
    }
  };

  const toggleTestCompletion = async (castId: string, target: Target) => {
    const key = `${castId}:${target}`;
    if (togglingCompletion === key) return;
    const nextCompleted = !testCompletions[castId]?.[target];
    setTogglingCompletion(key);
    // 楽観的に表示を更新し、失敗時はロールバックする
    setTestCompletions((current) => {
      const next: TestCompletionMap = { ...current, [castId]: { ...current[castId] } };
      if (nextCompleted) {
        next[castId][target] = new Date().toISOString();
      } else {
        delete next[castId][target];
      }
      return next;
    });
    const { error } = await rpc("set_cast_test_post_completion", {
      p_store_id: storeId,
      p_cast_id: castId,
      p_site: target,
      p_completed: nextCompleted,
    });
    if (error) {
      setTestCompletions((current) => {
        const next: TestCompletionMap = { ...current, [castId]: { ...current[castId] } };
        if (nextCompleted) {
          delete next[castId][target];
        } else {
          next[castId][target] = new Date().toISOString();
        }
        return next;
      });
      toast.error(error.message || "テスト完了の状態を更新できませんでした");
    } else {
      toast.success(nextCompleted
        ? `${target === "o2" ? "O2" : "魂セラピスト"}のテスト完了にチェックを付けました`
        : `${target === "o2" ? "O2" : "魂セラピスト"}のテスト完了チェックを外しました`);
    }
    setTogglingCompletion(null);
  };

  const connectionBadge = (castId: string, target: Target, label: string) => {
    const sites = credentials[castId] || new Set<string>();
    const configured = sites.has(target);
    const completed = Boolean(testCompletions[castId]?.[target]);
    const key = `${castId}:${target}`;
    const busy = togglingCompletion === key;
    return (
      <button
        type="button"
        title={completed ? `${label}のテスト完了チェックを外す` : `${label}のテスト投稿が完了したらチェックを付ける`}
        aria-pressed={completed}
        disabled={busy}
        onClick={() => void toggleTestCompletion(castId, target)}
        className="inline-flex items-center gap-0.5 rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Badge variant={configured ? "default" : "outline"}>{label}</Badge>
        {busy
          ? <Loader2 size={12} className="animate-spin text-muted-foreground" />
          : completed && <Check size={13} strokeWidth={3.5} className="text-green-600" aria-label="テスト完了" />}
      </button>
    );
  };

  const hpStatusRow = (post: Post) => (
    <div className="flex items-start gap-1.5 text-xs">
      {STATUS_ICON[post.hp_status] || STATUS_ICON.pending}
      <span className="font-medium">HP写メ日記</span>
      <span className="text-muted-foreground">{post.hp_status === "skipped" ? "未掲載" : STATUS_LABEL[post.hp_status] || post.hp_status}</span>
      {post.hp_error && <span className="text-red-600">{post.hp_error}</span>}
    </div>
  );

  const statusRow = (post: Post, target: Target, label: string) => {
    const status = target === "o2" ? post.o2_status : post.esutama_status;
    const error = target === "o2" ? post.o2_error : post.esutama_error;
    const key = `${post.id}:${target}`;
    const reviewRequired = target === "esutama" && isEstamaReviewRequired(error);
    return (
      <div className="flex items-start justify-between gap-3 text-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">{reviewRequired ? <ShieldAlert size={13} className="text-amber-600" /> : STATUS_ICON[status] || STATUS_ICON.pending}<span className="font-medium">{label}</span><span className="text-muted-foreground">{reviewRequired ? "要確認（再送停止）" : STATUS_LABEL[status] || status}</span></div>
          {error && <p className={`mt-1 break-words ${reviewRequired ? "text-amber-700" : "text-red-600"}`}>{error}</p>}
        </div>
        {!reviewRequired && ["pending", "failed", "skipped"].includes(status) && (
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
              <p className="text-sm text-muted-foreground">{store?.name || "店舗"}のHP写メ日記・O2・魂セラピストへ同時掲載します</p>
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
                {casts.map((cast) => (
                  <div key={cast.id} className="flex items-center justify-between border-b border-dashed py-1.5 text-xs">
                    <span className="truncate font-medium">{cast.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge>HP</Badge>
                      {connectionBadge(cast.id, "o2", "O2")}
                      {connectionBadge(cast.id, "esutama", "魂")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {showConnections && (
              <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
                O2・魂のバッジをタップすると、テスト投稿が完了した媒体にチェックマーク（✓）を付け外しできます。
              </p>
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
                  <div className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-3">
                    {hpStatusRow(post)}
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
        <DialogContent
          className="max-h-[90dvh] max-w-lg overflow-y-auto"
          onEscapeKeyDown={(event) => { if (submitting || preparingImage) event.preventDefault(); }}
          onInteractOutside={(event) => { if (submitting || preparingImage) event.preventDefault(); }}
        >
          <DialogHeader><DialogTitle>{testMode ? "O2・魂へテスト投稿" : "HP・O2・魂へ一括投稿"}</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            <div><Label>セラピスト</Label><Select value={form.castId} onValueChange={(value) => setForm({ ...form, castId: value })} disabled={submitting}><SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger><SelectContent>{casts.map((cast) => <SelectItem key={cast.id} value={cast.id}>{cast.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>タイトル（任意）</Label><Input maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} disabled={submitting} /></div>
            <div><Label>本文</Label><Textarea rows={6} maxLength={5000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="投稿内容を入力" disabled={submitting} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="post-images">画像（必須・1枚）</Label>
                <span className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
              </div>
              {images.length < MAX_IMAGES && (
                <label
                  htmlFor="post-images"
                  className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm font-medium transition-colors ${submitting || preparingImage ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"}`}
                >
                  {preparingImage ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}
                  {preparingImage ? `${POST_IMAGE_SIZE}×${POST_IMAGE_SIZE}へ変換中` : "写真ライブラリ・カメラから選択"}
                  <input
                    id="post-images"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleImageSelect}
                    disabled={submitting || preparingImage}
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">JPEG・PNG・WebP／10MBまで。中央を基準に600×600の正方形へ自動変換します。</p>
              {images.length > 0 && (
                <div className="max-w-64">
                  {images.map((image, index) => (
                    <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                      <img src={image.previewUrl} alt={`添付画像${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={`画像${index + 1}を削除`}
                        onClick={() => removeImage(image.id)}
                        disabled={submitting}
                        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-50"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              {testMode
                ? "テスト投稿はO2と魂セラピストだけへ送信し、公開HPには掲載しません。"
                : "同じタイトル・本文・600×600画像をHP写メ日記へ掲載し、O2と魂セラピストへ送信します。"}
            </p>
            <div className="flex gap-2"><Button className="flex-1" onClick={handleSubmit} disabled={submitting || preparingImage}>{submitting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}{uploadingImages ? "画像アップロード中" : testMode ? "テスト投稿" : "一括投稿"}</Button><Button variant="outline" className="flex-1" onClick={() => changeDialogOpen(false)} disabled={submitting || preparingImage}>キャンセル</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>送信エラーの履歴を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.casts?.name}さんの管理画面上の投稿履歴、HP写メ日記、関連する再送ジョブと保存画像を削除します。O2・魂セラピストですでに投稿済みの内容は削除されません。この操作は元に戻せません。
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
