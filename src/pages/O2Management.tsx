import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ExternalLink, Eye, EyeOff, Link2, Loader2, Pencil, RefreshCw, ShieldCheck, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type O2Row = {
  cast_id: string;
  cast_name: string;
  photo: string | null;
  o2_created: boolean;
  o2_linkage_requested: boolean;
  profile_url: string | null;
  credential_configured: boolean;
  login_id: string | null;
  o2_login_email: string | null;
  x_profile_url: string | null;
  x_credential_configured: boolean;
  x_login_id: string | null;
  estama_profile_url: string | null;
  estama_credential_configured: boolean;
  last_o2_status: string | null;
  last_o2_error: string | null;
  last_posted_at: string | null;
};

type EditForm = {
  created: boolean;
  linkageRequested: boolean;
  o2Email: string;
  o2LoginId: string;
  o2Password: string;
  xLoginId: string;
  xPassword: string;
  estamaProfileUrl: string;
};

const normalizeO2Id = (value: string) => value
  .trim()
  .replace(/^https?:\/\/(?:www\.)?m-sns\.net\/profile\//i, "")
  .replace(/^@/, "")
  .split(/[/?#]/, 1)[0];

const normalizeXId = (value: string) => value
  .trim()
  .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "")
  .replace(/^@/, "")
  .split(/[/?#]/, 1)[0];

const buildO2ProfileUrl = (value: string) => {
  const id = normalizeO2Id(value);
  return id ? `https://m-sns.net/profile/@${id}` : "";
};

const buildXProfileUrl = (value: string) => {
  const id = normalizeXId(value);
  return id ? `https://x.com/${id}` : "";
};

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (rpcName: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(name, args);

const statusLabel: Record<string, string> = {
  pending: "送信待ち",
  posting: "送信中",
  posted: "投稿済み",
  failed: "失敗",
  skipped: "未設定",
};

export default function O2Management() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState<O2Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<O2Row | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ created: false, linkageRequested: false, o2Email: "", o2LoginId: "", o2Password: "", xLoginId: "", xPassword: "", estamaProfileUrl: "" });
  const [showO2Password, setShowO2Password] = useState(false);
  const [showXPassword, setShowXPassword] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { storeId, store, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    const { data, error } = await rpc("get_sns_connection_overview_v4", { p_store_id: storeId });
    if (error) toast.error(error.message);
    setRows((data || []) as O2Row[]);
    setLoading(false);
  }, [storeId, storeLoading, user]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => ({
    total: rows.length,
    credentials: rows.filter((row) => row.credential_configured).length,
    xCredentials: rows.filter((row) => row.x_credential_configured).length,
    estamaCredentials: rows.filter((row) => row.estama_credential_configured).length,
    created: rows.filter((row) => row.o2_created).length,
    linked: rows.filter((row) => row.o2_linkage_requested).length,
    errors: rows.filter((row) => row.last_o2_status === "failed").length,
  }), [rows]);
  const cards = [
    { label: "在籍", value: summary.total, icon: Users },
    { label: "O2連携済み", value: summary.credentials, icon: ShieldCheck },
    { label: "X連携済み", value: summary.xCredentials, icon: ShieldCheck },
    { label: "魂連携済み", value: summary.estamaCredentials, icon: ShieldCheck },
    { label: "O2作成済み", value: summary.created, icon: CheckCircle },
    { label: "店舗連携申請", value: summary.linked, icon: Link2 },
    { label: "投稿エラー", value: summary.errors, icon: XCircle },
  ];

  const openEdit = (row: O2Row) => {
    setEditing(row);
    setShowO2Password(false);
    setShowXPassword(false);
    setEditForm({
      created: row.o2_created,
      linkageRequested: row.o2_linkage_requested,
      o2Email: row.o2_login_email || "",
      o2LoginId: row.login_id || normalizeO2Id(row.profile_url || ""),
      o2Password: "",
      xLoginId: row.x_login_id || normalizeXId(row.x_profile_url || ""),
      xPassword: "",
      estamaProfileUrl: row.estama_profile_url || "",
    });
  };

  const save = async () => {
    if (!editing) return;
    const o2Email = editForm.o2Email.trim();
    const o2LoginId = normalizeO2Id(editForm.o2LoginId);
    const xLoginId = normalizeXId(editForm.xLoginId);
    if (o2LoginId && (!o2Email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o2Email))) {
      toast.error("O2・魂セラピストで使う登録メールアドレスを確認してください");
      return;
    }
    if (o2LoginId && !/^[A-Za-z0-9_]+$/.test(o2LoginId)) {
      toast.error("O2のIDは半角英数字とアンダーバーで入力してください");
      return;
    }
    if (xLoginId && !/^[A-Za-z0-9_]+$/.test(xLoginId)) {
      toast.error("XのIDは半角英数字とアンダーバーで入力してください");
      return;
    }
    if (editForm.o2Password && !o2LoginId) {
      toast.error("O2のIDを入力してください");
      return;
    }
    if (!editing.credential_configured && o2LoginId && !editForm.o2Password) {
      toast.error("O2の初回設定ではパスワードも入力してください");
      return;
    }
    if (editForm.xPassword && !xLoginId) {
      toast.error("XのIDを入力してください");
      return;
    }
    if (!editing.x_credential_configured && xLoginId && !editForm.xPassword) {
      toast.error("Xの初回設定ではパスワードも入力してください");
      return;
    }
    const estamaProfileUrl = editForm.estamaProfileUrl.trim();
    if (estamaProfileUrl && !/^https:\/\/(?:www\.)?estama\.jp\//i.test(estamaProfileUrl)) {
      toast.error("魂セラピストのプロフィールURLを入力してください");
      return;
    }
    setSaving(true);
    const { error } = await rpc("save_sns_connection_admin_v4", {
      p_store_id: storeId,
      p_cast_id: editing.cast_id,
      p_o2_created: editForm.created,
      p_o2_linkage_requested: editForm.linkageRequested,
      p_o2_login_email: o2Email || null,
      p_login_id: o2LoginId || null,
      p_password: editForm.o2Password || null,
      p_x_login_id: xLoginId || null,
      p_x_password: editForm.xPassword || null,
      p_estama_profile_url: estamaProfileUrl || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    toast.success("SNS連携情報を更新しました");
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((value) => !value)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold">SNS連携管理</h1><p className="text-sm text-muted-foreground">{store?.name || "店舗"}のセラピスト別アカウントと公開プロフィールを管理</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "mr-1 animate-spin" : "mr-1"} />更新</Button>
              <Button variant="outline" asChild><a href="https://m-sns.net/cast/login/" target="_blank" rel="noreferrer">O2を開く<ExternalLink size={15} className="ml-1" /></a></Button>
              <Button asChild><a href="https://estama.jp/admin/tamathera/therapist/" target="_blank" rel="noreferrer">魂セラピストを開く<ExternalLink size={15} className="ml-1" /></a></Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
            {cards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border bg-card p-4"><Icon size={18} className="text-primary mb-2" /><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            ))}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            O2のメールアドレス・ID・パスワードを登録すると、魂セラピストの初回設定には登録メールアドレスと同じパスワードを使用します。公開URLはセラピストカードと詳細ページへ反映されます。パスワードは保存後に再表示しません。
          </div>

          <div className="grid gap-3 md:hidden">
            {loading ? <div className="rounded-xl border bg-card py-16 text-center"><Loader2 className="inline-block animate-spin text-primary" /></div> : rows.length === 0 ? <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">セラピストがいません</div> : rows.map((row) => (
              <div key={row.cast_id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">{row.photo ? <img src={row.photo} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="h-11 w-11 rounded-full bg-muted" />}<div className="min-w-0"><p className="font-medium truncate">{row.cast_name}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant={row.credential_configured ? "default" : "outline"}>O2</Badge><Badge variant={row.x_credential_configured ? "default" : "outline"}>X</Badge><Badge variant={row.estama_credential_configured ? "default" : "outline"}>魂</Badge></div></div></div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil size={13} className="mr-1" />編集</Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">O2作成</p><p className={row.o2_created ? "mt-1 text-green-700" : "mt-1"}>{row.o2_created ? "✓ 作成済み" : "未作成"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">店舗連携</p><p className={row.o2_linkage_requested ? "mt-1 text-green-700" : "mt-1"}>{row.o2_linkage_requested ? "✓ 申請済み" : "未申請"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">直近投稿</p><p className="mt-1">{statusLabel[row.last_o2_status || ""] || "投稿なし"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">公開URL</p>{row.profile_url ? <a className="mt-1 inline-flex items-center text-primary" href={row.profile_url} target="_blank" rel="noreferrer">確認<ExternalLink size={12} className="ml-1" /></a> : <p className="mt-1">未設定</p>}</div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">魂URL</p>{row.estama_profile_url ? <a className="mt-1 inline-flex items-center text-primary" href={row.estama_profile_url} target="_blank" rel="noreferrer">確認<ExternalLink size={12} className="ml-1" /></a> : <p className="mt-1">未設定</p>}</div>
                </div>
                {row.last_o2_error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600 break-words">{row.last_o2_error}</p>}
              </div>
            ))}
          </div>

          <div className="hidden md:block border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">セラピスト</th><th className="px-3 py-3">SNS連携</th><th className="px-3 py-3">O2作成</th><th className="px-3 py-3">店舗連携</th><th className="px-3 py-3">直近投稿</th><th className="px-3 py-3">エラー</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
                <tbody className="divide-y">
                  {loading ? <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="inline-block animate-spin text-primary" /></td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">セラピストがいません</td></tr> : rows.map((row) => (
                    <tr key={row.cast_id} className="align-top">
                      <td className="px-4 py-3"><div className="flex items-center gap-2">{row.photo ? <img src={row.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-muted" />}<span className="font-medium">{row.cast_name}</span></div></td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-1"><Badge variant={row.credential_configured ? "default" : "outline"}>O2</Badge><Badge variant={row.x_credential_configured ? "default" : "outline"}>X</Badge><Badge variant={row.estama_credential_configured ? "default" : "outline"}>魂</Badge></div></td>
                      <td className="px-3 py-3">{row.o2_created ? <span className="text-green-700">✓ 作成済み</span> : <span className="text-muted-foreground">未作成</span>}</td>
                      <td className="px-3 py-3">{row.o2_linkage_requested ? <span className="text-green-700">✓ 申請済み</span> : <span className="text-muted-foreground">未申請</span>}</td>
                      <td className="px-3 py-3"><span>{statusLabel[row.last_o2_status || ""] || "投稿なし"}</span>{row.last_posted_at && <p className="text-[11px] text-muted-foreground mt-1">{new Date(row.last_posted_at).toLocaleString("ja-JP")}</p>}</td>
                      <td className="px-3 py-3 max-w-[250px] text-xs text-red-600 break-words">{row.last_o2_error || "—"}</td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-2">{row.profile_url && <Button size="sm" variant="outline" asChild><a href={row.profile_url} target="_blank" rel="noreferrer">O2<ExternalLink size={13} className="ml-1" /></a></Button>}{row.estama_profile_url && <Button size="sm" variant="outline" asChild><a href={row.estama_profile_url} target="_blank" rel="noreferrer">魂<ExternalLink size={13} className="ml-1" /></a></Button>}<Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil size={13} className="mr-1" />編集</Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.cast_name}さんのSNS連携</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <section className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold">O2</h3>{editing?.credential_configured && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">設定済み</Badge>}</div>
              <div><Label htmlFor="o2-email">登録メールアドレス</Label><Input id="o2-email" type="email" autoComplete="email" placeholder="therapist@example.jp" value={editForm.o2Email} onChange={(event) => setEditForm({ ...editForm, o2Email: event.target.value })} /></div>
              <div><Label htmlFor="o2-login-id">ID</Label><Input id="o2-login-id" autoComplete="off" placeholder="例: enka_asami" value={editForm.o2LoginId} onChange={(event) => setEditForm({ ...editForm, o2LoginId: event.target.value })} /></div>
              <div>
                <Label htmlFor="o2-password">パスワード</Label>
                <div className="relative"><Input id="o2-password" className="pr-10" type={showO2Password ? "text" : "password"} autoComplete="new-password" placeholder={editing?.credential_configured ? "変更する場合のみ入力" : "O2のパスワード"} value={editForm.o2Password} onChange={(event) => setEditForm({ ...editForm, o2Password: event.target.value })} /><button type="button" aria-label={showO2Password ? "O2のパスワードを隠す" : "O2のパスワードを表示"} className="absolute right-0 top-0 h-full px-3 text-muted-foreground" onClick={() => setShowO2Password((value) => !value)}>{showO2Password ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                {editing?.credential_configured && <p className="mt-1 text-xs text-muted-foreground">現在のパスワードは表示されません。空欄なら変更しません。</p>}
              </div>
              <div><Label htmlFor="o2-profile-url">公開URL（自動生成）</Label><Input id="o2-profile-url" readOnly value={buildO2ProfileUrl(editForm.o2LoginId)} placeholder="IDを入力すると自動生成されます" className="bg-muted/60" /><p className="mt-1 text-xs text-muted-foreground">公開側のセラピストカードと詳細ページへ反映されます。</p></div>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.created} onChange={(event) => setEditForm({ ...editForm, created: event.target.checked })} />O2アカウント作成済み</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.linkageRequested} onChange={(event) => setEditForm({ ...editForm, linkageRequested: event.target.checked })} />店舗連携を申請済み</label>
              </div>
            </section>

            <section className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold">X</h3>{editing?.x_credential_configured && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">設定済み</Badge>}</div>
              <div><Label htmlFor="x-login-id">ID</Label><Input id="x-login-id" autoComplete="off" placeholder="例: enka_asami" value={editForm.xLoginId} onChange={(event) => setEditForm({ ...editForm, xLoginId: event.target.value })} /></div>
              <div>
                <Label htmlFor="x-password">パスワード</Label>
                <div className="relative"><Input id="x-password" className="pr-10" type={showXPassword ? "text" : "password"} autoComplete="new-password" placeholder={editing?.x_credential_configured ? "変更する場合のみ入力" : "Xのパスワード"} value={editForm.xPassword} onChange={(event) => setEditForm({ ...editForm, xPassword: event.target.value })} /><button type="button" aria-label={showXPassword ? "Xのパスワードを隠す" : "Xのパスワードを表示"} className="absolute right-0 top-0 h-full px-3 text-muted-foreground" onClick={() => setShowXPassword((value) => !value)}>{showXPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                {editing?.x_credential_configured && <p className="mt-1 text-xs text-muted-foreground">現在のパスワードは表示されません。空欄なら変更しません。</p>}
              </div>
              <div><Label htmlFor="x-profile-url">公開URL（自動生成）</Label><Input id="x-profile-url" readOnly value={buildXProfileUrl(editForm.xLoginId)} placeholder="IDを入力すると自動生成されます" className="bg-muted/60" /></div>
            </section>

            <section className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold">魂セラピスト</h3>{editing?.estama_credential_configured && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">設定済み</Badge>}</div>
              <div className="rounded-lg bg-muted/60 p-3 text-sm"><p className="font-medium">登録メール・パスワードを自動使用</p><p className="mt-1 text-xs text-muted-foreground">魂セラピストはO2登録メールアドレスでログインし、パスワードはO2と共通で設定します。</p></div>
              <div><Label htmlFor="estama-profile-url">プロフィールURL</Label><Input id="estama-profile-url" type="url" placeholder="https://estama.jp/shop/..." value={editForm.estamaProfileUrl} onChange={(event) => setEditForm({ ...editForm, estamaProfileUrl: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">公開側のセラピストカードと詳細ページへ自動反映されます。</p></div>
            </section>

            <p className="text-xs text-muted-foreground">O2とXはIDから公開URLを自動生成します。魂セラピストはO2登録メールアドレスと共通パスワードを使い、入力したプロフィールURLを公開側へ反映します。</p>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 size={14} className="mr-1 animate-spin" />}保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
