import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  CheckCircle,
  ChevronLeft,
  Clock,
  ExternalLink,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isEstamaReviewRequired } from "@/lib/estama-post-status";
import { POST_IMAGE_SIZE, prepareSquarePostImage } from "@/lib/post-image";

type Post = {
  id: string;
  title: string | null;
  body: string;
  status: string;
  o2_status: string;
  esutama_status: string;
  o2_error: string | null;
  esutama_error: string | null;
  created_at: string;
};

type Connection = { site: "o2" | "esutama"; configured: boolean };
type Target = "o2" | "esutama";
type PendingImage = { id: string; file: File; previewUrl: string };

const STATUS_ICON: Record<string, JSX.Element> = {
  pending: <Clock size={13} className="text-amber-500" />,
  posting: <Loader2 size={13} className="animate-spin text-blue-500" />,
  posted: <CheckCircle size={13} className="text-green-600" />,
  failed: <XCircle size={13} className="text-red-500" />,
  skipped: <span className="text-xs text-muted-foreground">−</span>,
};

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (rpcName: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(name, args);

export default function TherapistPostPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showPost, setShowPost] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", confirmed: false });
  const [images, setImages] = useState<PendingImage[]>([]);
  const imagesRef = useRef<PendingImage[]>([]);
  const [credential, setCredential] = useState({ email: "", loginId: "", password: "" });

  const clearSelectedImage = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    const { data, error } = await rpc("get_therapist_posts_secure", { p_token: token });
    if (error) {
      toast.error("投稿履歴を取得できませんでした");
      return;
    }
    setPosts((data || []) as Post[]);
  }, [token]);

  const fetchConnections = useCallback(async () => {
    if (!token) return;
    const { data } = await rpc("get_therapist_post_connections", { p_token: token });
    setConnections((data || []) as Connection[]);
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_cast_by_access_token", { p_token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (!active) return;
      if (error || !row) {
        toast.error("無効なリンクです");
        navigate("/");
        return;
      }
      await Promise.all([fetchPosts(), fetchConnections()]);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [token, navigate, fetchPosts, fetchConnections]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (images.length || files.length !== 1) {
      toast.error("画像は1枚だけ選択してください");
      return;
    }
    setPreparingImage(true);
    try {
      const file = await prepareSquarePostImage(files[0]);
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

  const publishTarget = async (postId: string, target: Target) => {
    if (!token) throw new Error("ポータルトークンがありません");
    const response = await fetch("/api/automations/portal-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, accessToken: token, target }),
    });
    const data = await response.json();
    if (!response.ok || data?.status === "failed") {
      const fallback = target === "o2" ? "O2投稿に失敗しました" : "魂セラピスト投稿に失敗しました";
      throw new Error(data?.error || data?.results?.o2?.error || data?.result?.error || fallback);
    }
    return data;
  };

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const prefix = "data:image/jpeg;base64,";
      if (!result.startsWith(prefix)) {
        reject(new Error("600×600のJPEG画像を読み取れませんでした"));
        return;
      }
      resolve(result.slice(prefix.length));
    };
    reader.onerror = () => reject(new Error("画像を読み取れませんでした"));
    reader.readAsDataURL(file);
  });

  const handlePost = async () => {
    if (!form.body.trim()) {
      toast.error("本文を入力してください");
      return;
    }
    if (form.title.length > 120 || form.body.length > 5000) {
      toast.error("タイトル120文字、本文5000文字以内で入力してください");
      return;
    }
    if (!form.confirmed) {
      toast.error("本人投稿と各媒体のルール順守を確認してください");
      return;
    }
    if (images.length !== 1) {
      toast.error("600×600に変換した画像を1枚選択してください");
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      setUploading(true);
      const imageBase64 = await fileToBase64(images[0].file);
      const response = await fetch("/api/automations/portal-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-therapist-post",
          accessToken: token,
          title: form.title,
          postBody: form.body,
          imageBase64,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { postId?: string; error?: string };
      if (!response.ok || !payload.postId) {
        throw new Error(payload.error || "投稿を作成できませんでした");
      }
      setUploading(false);

      setForm({ title: "", body: "", confirmed: false });
      clearSelectedImage();
      setShowPost(false);
      toast.success("O2・魂セラピストへ送信中です");
      await fetchPosts();
      const results = await Promise.allSettled([
        publishTarget(payload.postId, "o2"),
        publishTarget(payload.postId, "esutama"),
      ]);
      await fetchPosts();
      if (results.some((result) => result.status === "rejected")) {
        toast.warning("外部媒体の一部へ送信できませんでした。履歴の状態を確認してください");
      } else {
        toast.success("2媒体への送信処理が完了しました");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "投稿に失敗しました";
      toast.error(message);
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const changePostDialogOpen = (open: boolean) => {
    if (!open && (submitting || preparingImage)) return;
    setShowPost(open);
    if (!open) clearSelectedImage();
  };

  const retry = async (postId: string, target: Target) => {
    setRetrying(`${postId}:${target}`);
    try {
      await publishTarget(postId, target);
      toast.success(`${target === "o2" ? "O2" : "魂セラピスト"}へ再送しました`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "再送に失敗しました");
    } finally {
      await fetchPosts();
      setRetrying(null);
    }
  };

  const handleSaveCredential = async () => {
    if (!token || !credential.loginId.trim() || !credential.password) {
      toast.error("O2のユーザー名とパスワードを入力してください");
      return;
    }
    const email = credential.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("O2・魂セラピストで使う登録メールアドレスを確認してください");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await rpc("save_therapist_o2_credentials", {
        p_token: token,
        p_login_email: email || null,
        p_login_id: credential.loginId,
        p_password: credential.password,
      });
      if (error) throw new Error(error.message);
      setCredential({ email: "", loginId: "", password: "" });
      setShowCreds(false);
      await fetchConnections();
      toast.success("O2と魂セラピストのログイン情報を保存しました");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const o2Connected = connections.find((item) => item.site === "o2")?.configured;
  const estamaConnected = connections.find((item) => item.site === "esutama")?.configured;

  const statusRow = (post: Post, target: Target, label: string) => {
    const status = target === "o2" ? post.o2_status : post.esutama_status;
    const error = target === "o2" ? post.o2_error : post.esutama_error;
    const retryKey = `${post.id}:${target}`;
    const reviewRequired = target === "esutama" && isEstamaReviewRequired(error);
    return (
      <div className="flex items-start justify-between gap-2 text-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">{reviewRequired ? <ShieldAlert size={13} className="text-amber-600" /> : STATUS_ICON[status] || STATUS_ICON.pending}<span>{label}</span><span className="text-muted-foreground">{reviewRequired ? "要確認（再送停止）" : status}</span></div>
          {error && <p className={`mt-1 break-words ${reviewRequired ? "text-amber-700" : "text-red-600"}`}>{error}</p>}
        </div>
        {!reviewRequired && ["pending", "failed", "skipped"].includes(status) && (
          <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => retry(post.id, target)} disabled={retrying === retryKey}>
            {retrying === retryKey ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            <span className="ml-1">再送</span>
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b bg-card/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 max-w-2xl">
          <button onClick={() => navigate(`/therapist/${token}`)} className="text-primary flex items-center gap-1 text-sm"><ChevronLeft size={18} />戻る</button>
          <div className="flex-1"><p className="font-bold">2媒体投稿</p><p className="text-xs text-muted-foreground">O2・魂セラピスト</p></div>
          <button aria-label="O2ログイン設定" onClick={() => setShowCreds(true)} className="text-muted-foreground hover:text-foreground"><Settings size={19} /></button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button onClick={() => setShowCreds(true)} className={`rounded border p-2 text-center ${o2Connected ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>O2<br />{o2Connected ? "✓ 設定済み" : "未設定"}</button>
          <div className={`rounded border p-2 text-center ${estamaConnected ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>魂セラピスト<br />{estamaConnected ? "✓ 接続済み" : "管理者設定待ち"}</div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          O2と魂セラピストへ別々に送信します。通常の送信前エラーは失敗した媒体だけ再送できます。送信結果が「要確認」の場合は重複防止のため再送を停止します。HP写メ日記やその他のSNSには掲載しません。
        </div>

        {posts.length === 0 ? <div className="text-center py-12 text-muted-foreground text-sm">投稿がありません</div> : (
          <div className="space-y-3">
            {posts.map((post) => (
              <article key={post.id} className="border rounded-xl p-4 bg-card space-y-3">
                <div>{post.title && <p className="font-semibold text-sm">{post.title}</p>}<p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{post.body}</p><p className="text-xs text-muted-foreground mt-1">{format(new Date(post.created_at), "M/d HH:mm", { locale: ja })}</p></div>
                <div className="border-t pt-3 space-y-2">
                  {statusRow(post, "o2", "O2")}
                  {statusRow(post, "esutama", "魂セラピスト")}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-4 right-4"><Button aria-label="新規投稿" onClick={() => setShowPost(true)} className="rounded-full h-14 w-14 shadow-lg p-0"><Send size={20} /></Button></div>

      <Dialog open={showPost} onOpenChange={changePostDialogOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onEscapeKeyDown={(event) => { if (submitting || preparingImage) event.preventDefault(); }}
          onInteractOutside={(event) => { if (submitting || preparingImage) event.preventDefault(); }}
        >
          <DialogHeader><DialogTitle>2媒体へ同時投稿</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label htmlFor="post-title">タイトル（任意・120文字まで）</Label><Input id="post-title" maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div><Label htmlFor="post-body">本文（5000文字まで）</Label><Textarea id="post-body" rows={7} maxLength={5000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /><p className="text-right text-xs text-muted-foreground mt-1">{form.body.length}/5000</p></div>
            <div>
              <Label>画像（必須・1枚）</Label>
              <div className="mt-2 space-y-2">
                {images.length < 1 && <label className={`inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm ${preparingImage ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"}`}>{preparingImage ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}{preparingImage ? `${POST_IMAGE_SIZE}×${POST_IMAGE_SIZE}へ変換中` : "画像を選択"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={preparingImage || submitting} /></label>}
                <p className="text-xs text-muted-foreground">JPEG・PNG・WebP／10MBまで。中央を基準に600×600の正方形へ自動変換します。</p>
                {images.length > 0 && <div className="max-w-64">{images.map((image) => <div key={image.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted"><img src={image.previewUrl} alt="添付画像" className="w-full h-full object-cover" /><button type="button" aria-label="画像を削除" onClick={clearSelectedImage} className="absolute top-1 right-1 bg-black/65 text-white rounded-full p-1"><X size={12} /></button></div>)}</div>}
              </div>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} />
              <span>私はセラピスト本人として投稿し、O2を含む各媒体の投稿ルールを確認・順守します。</span>
            </label>
            <Button className="w-full" onClick={handlePost} disabled={submitting || uploading || preparingImage}>{submitting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}{uploading ? "画像アップロード中" : "O2・魂セラピストへ投稿"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreds} onOpenChange={setShowCreds}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>O2・魂セラピスト接続設定</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><ShieldAlert size={17} className="shrink-0" /><p>O2は本人運用が原則です。セラピスト本人だけが設定・投稿し、認証情報をスタッフへ共有しないでください。</p></div>
            <a href="https://m-sns.net/cast/login/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">O2ログイン画面を確認 <ExternalLink size={14} /></a>
            <div><Label htmlFor="o2-email">O2登録メールアドレス（魂ログインにも使用）</Label><Input id="o2-email" type="email" autoComplete="email" placeholder="therapist@example.jp" value={credential.email} onChange={(event) => setCredential({ ...credential, email: event.target.value })} /></div>
            <div><Label htmlFor="o2-id">O2ユーザー名（@なし）</Label><Input id="o2-id" autoComplete="username" value={credential.loginId} onChange={(event) => setCredential({ ...credential, loginId: event.target.value })} /></div>
            <div><Label htmlFor="o2-password">O2パスワード</Label><Input id="o2-password" type="password" autoComplete="current-password" value={credential.password} onChange={(event) => setCredential({ ...credential, password: event.target.value })} /></div>
            <p className="text-xs text-muted-foreground">魂セラピストは登録メールアドレスでログインし、パスワードはO2と共通で使います。保存済みのパスワードは画面へ再表示しません。</p>
            <Button className="w-full" onClick={handleSaveCredential} disabled={submitting}>{submitting && <Loader2 size={14} className="mr-1 animate-spin" />}保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
