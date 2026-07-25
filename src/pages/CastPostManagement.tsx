import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, Send, Loader2, CheckCircle, XCircle, Clock, Link2, ChevronDown, ChevronUp, Copy, Check, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Cast { id: string; name: string; }
interface Post {
  id: string;
  cast_id: string;
  title: string | null;
  body: string;
  image_urls: string[] | null;
  status: string;
  posted_at: string | null;
  o2_status: string;
  esutama_status: string;
  o2_error: string | null;
  esutama_error: string | null;
  created_at: string;
  casts: { name: string };
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft:   { label: "下書き",  color: "bg-gray-100 text-gray-700" },
  pending: { label: "投稿待ち", color: "bg-yellow-100 text-yellow-700" },
  posted:  { label: "投稿済み", color: "bg-green-100 text-green-700" },
  failed:  { label: "失敗",    color: "bg-red-100 text-red-700" },
};
const SITE_BADGE: Record<string, JSX.Element> = {
  pending: <Clock size={12} className="text-yellow-500" />,
  posted:  <CheckCircle size={12} className="text-green-500" />,
  failed:  <XCircle size={12} className="text-red-500" />,
  skipped: <span className="text-xs text-muted-foreground">-</span>,
};

export default function CastPostManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ cast_id: "", title: "", body: "", image_urls: "" });
  // 連携ステータス（cast_id -> 設定済みサイトの集合）
  const [credsByCast, setCredsByCast] = useState<Record<string, Set<string>>>({});
  const [showStatus, setShowStatus] = useState(true);
  // エスたま投稿用パネルの開閉・エスたま未投稿のみ表示
  const [openEsutama, setOpenEsutama] = useState<string | null>(null);
  const [onlyEsutamaPending, setOnlyEsutamaPending] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);
  useEffect(() => { if (user) { fetchPosts(); fetchCasts(); fetchCreds(); } }, [user]);

  const fetchCasts = async () => {
    const { data } = await supabase.from("casts").select("id, name").order("display_order", { ascending: true });
    setCasts(data || []);
  };

  const fetchCreds = async () => {
    const { data } = await supabase.from("cast_site_credentials").select("cast_id, site");
    const map: Record<string, Set<string>> = {};
    (data || []).forEach((c: any) => {
      (map[c.cast_id] ??= new Set()).add(c.site);
    });
    setCredsByCast(map);
  };

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cast_posts")
      .select("*, casts(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setPosts((data || []) as Post[]);
    setLoading(false);
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  // エスたまの投稿ステータスを手動で切り替える（Claude for Chrome／手作業で投稿した後に印を付ける）
  const setEsutamaStatus = async (post: Post, status: "posted" | "pending") => {
    const { error } = await supabase
      .from("cast_posts")
      .update({ esutama_status: status })
      .eq("id", post.id);
    if (error) { toast.error("更新に失敗しました"); return; }
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, esutama_status: status } : p)));
    toast.success(status === "posted" ? "エスたま投稿済みにしました" : "エスたま未投稿に戻しました");
  };

  const handleSubmit = async () => {
    if (!form.cast_id || !form.body.trim()) { toast.error("セラピストと本文は必須です"); return; }
    setSubmitting(true);
    const imageUrls = form.image_urls.split("\n").map(s => s.trim()).filter(Boolean);
    const { data, error } = await supabase.from("cast_posts").insert({
      cast_id: form.cast_id,
      title: form.title || null,
      body: form.body,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
      status: "pending",
    }).select("*, casts(name)").single();
    setSubmitting(false);
    if (error) { toast.error("作成に失敗しました"); return; }
    toast.success("投稿を作成しました。自動投稿を開始します...");
    setPosts(prev => [data as Post, ...prev]);
    setShowDialog(false);
    setForm({ cast_id: "", title: "", body: "", image_urls: "" });
    // Edge Functionを呼び出して自動投稿
    supabase.functions.invoke("post-to-sites", { body: { post_id: data.id } })
      .then(({ error }) => {
        if (error) toast.error("自動投稿に失敗しました: " + error.message);
        else fetchPosts();
      });
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">投稿管理</h1>
              <p className="text-sm text-muted-foreground">O2・エスたまの魂への自動投稿</p>
            </div>
            <Button onClick={() => setShowDialog(true)}>
              <Plus size={16} className="mr-1" />新規投稿
            </Button>
          </div>

          {/* 連携ステータス一覧 */}
          <div className="border rounded-lg bg-card mb-4">
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => setShowStatus(!showStatus)}
            >
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Link2 size={16} className="text-primary" />
                媒体連携ステータス
                <span className="text-xs font-normal text-muted-foreground">
                  （セラピストごとのO2・エスたまの魂ログイン設定）
                </span>
              </span>
              {showStatus ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showStatus && (
              <div className="px-4 pb-3 border-t pt-3">
                {casts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">セラピストがいません</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {casts.map((c) => {
                      const sites = credsByCast[c.id] ?? new Set<string>();
                      const badge = (ok: boolean) =>
                        ok ? (
                          <span className="inline-flex items-center gap-0.5 text-green-600"><CheckCircle size={12} />連携済</span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-muted-foreground"><XCircle size={12} />未連携</span>
                        );
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs border-b border-dashed py-1">
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="flex items-center gap-3 shrink-0">
                            <span className="flex items-center gap-1"><span className="text-muted-foreground">O2</span>{badge(sites.has("o2"))}</span>
                            <span className="flex items-center gap-1"><span className="text-muted-foreground">魂</span>{badge(sites.has("esutama"))}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  ※ ログイン情報の登録は各セラピストのポータル（投稿管理 → ⚙️）から行えます。「連携済」でも投稿の成否は各投稿のステータスで確認してください。
                </p>
              </div>
            )}
          </div>

          {/* エスたま未投稿フィルタ */}
          {posts.length > 0 && (
            <div className="flex items-center justify-end mb-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyEsutamaPending}
                  onChange={(e) => setOnlyEsutamaPending(e.target.checked)}
                />
                エスたま未投稿のみ表示
              </label>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">読み込み中...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">投稿がありません</div>
          ) : (
            <div className="space-y-2">
              {posts
                .filter((p) => !onlyEsutamaPending || (p.esutama_status !== "posted" && p.esutama_status !== "skipped"))
                .map(post => {
                const s = STATUS_BADGE[post.status] ?? STATUS_BADGE.draft;
                const esutamaDone = post.esutama_status === "posted";
                const isOpen = openEsutama === post.id;
                return (
                  <div key={post.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{post.casts?.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.color}`}>{s.label}</span>
                          {post.posted_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(post.posted_at), "M/d HH:mm", { locale: ja })}
                            </span>
                          )}
                        </div>
                        {post.title && <p className="text-sm font-medium mb-0.5">{post.title}</p>}
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0 text-xs">
                        <div className="flex items-center gap-1">
                          {SITE_BADGE[post.o2_status]}
                          <span className="text-muted-foreground">O2</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {SITE_BADGE[post.esutama_status]}
                          <span className="text-muted-foreground">エスたま</span>
                        </div>
                      </div>
                    </div>
                    {(post.o2_error || post.esutama_error) && (
                      <p className="text-xs text-red-500 mt-1">
                        {post.o2_error && `O2: ${post.o2_error}`}
                        {post.esutama_error && ` エスたま: ${post.esutama_error}`}
                      </p>
                    )}

                    {/* エスたま投稿用パネル（Claude for Chrome／手作業で貼り付ける用） */}
                    <div className="mt-2 border-t pt-2">
                      <button
                        onClick={() => setOpenEsutama(isOpen ? null : post.id)}
                        className="w-full flex items-center justify-between text-xs font-medium"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={esutamaDone ? "text-green-600" : "text-yellow-600"}>
                            {esutamaDone ? <CheckCircle size={13} /> : <Clock size={13} />}
                          </span>
                          エスたま投稿用（コピー＆貼り付け）
                          {esutamaDone && <span className="text-green-600">投稿済み</span>}
                        </span>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {isOpen && (
                        <div className="mt-2 space-y-2 bg-muted/40 rounded-md p-2.5">
                          {/* タイトル */}
                          {post.title && (
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] text-muted-foreground w-10 shrink-0 pt-1">タイトル</span>
                              <p className="flex-1 text-xs break-words">{post.title}</p>
                              <Button size="sm" variant="outline" className="h-6 px-2 shrink-0"
                                onClick={() => copyText(`t-${post.id}`, post.title || "")}>
                                {copiedKey === `t-${post.id}` ? <Check size={11} /> : <Copy size={11} />}
                              </Button>
                            </div>
                          )}
                          {/* 本文 */}
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-muted-foreground w-10 shrink-0 pt-1">本文</span>
                            <p className="flex-1 text-xs whitespace-pre-wrap break-words">{post.body}</p>
                            <Button size="sm" variant="outline" className="h-6 px-2 shrink-0"
                              onClick={() => copyText(`b-${post.id}`, post.body)}>
                              {copiedKey === `b-${post.id}` ? <Check size={11} /> : <Copy size={11} />}
                            </Button>
                          </div>
                          {/* 画像 */}
                          {post.image_urls && post.image_urls.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] text-muted-foreground w-10 shrink-0 pt-1">画像</span>
                              <div className="flex-1 flex flex-wrap gap-1.5">
                                {post.image_urls.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-primary underline">
                                    <ImageIcon size={11} />画像{i + 1}
                                  </a>
                                ))}
                              </div>
                              <Button size="sm" variant="outline" className="h-6 px-2 shrink-0"
                                onClick={() => copyText(`i-${post.id}`, (post.image_urls || []).join("\n"))}>
                                {copiedKey === `i-${post.id}` ? <Check size={11} /> : <Copy size={11} />}
                              </Button>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <a
                              href="https://estama.jp/admin/tamathera/therapist/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-primary underline"
                            >
                              エスたま管理画面を開く ↗
                            </a>
                            <span className="flex-1" />
                            {esutamaDone ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                                onClick={() => setEsutamaStatus(post, "pending")}>
                                未投稿に戻す
                              </Button>
                            ) : (
                              <Button size="sm" className="h-7 text-xs"
                                onClick={() => setEsutamaStatus(post, "posted")}>
                                <Check size={12} className="mr-1" />エスたま投稿済みにする
                              </Button>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            ※「エスたま管理画面を開く」→対象セラピストの「本人の代わりにログイン」→写メ日記に上記を貼り付け。投稿できたら「投稿済みにする」を押してください。
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新規投稿作成</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>セラピスト</Label>
              <Select value={form.cast_id} onValueChange={v => setForm({ ...form, cast_id: v })}>
                <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                <SelectContent>
                  {casts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>タイトル（任意）</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="タイトル" />
            </div>
            <div>
              <Label>本文</Label>
              <Textarea
                rows={5}
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
                placeholder="投稿内容を入力..."
              />
            </div>
            <div>
              <Label>画像URL（1行1URL）</Label>
              <Textarea
                rows={2}
                value={form.image_urls}
                onChange={e => setForm({ ...form, image_urls: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
                {submitting ? "投稿中..." : "投稿する"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
