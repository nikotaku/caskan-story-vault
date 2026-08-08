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
  last_o2_status: string | null;
  last_o2_error: string | null;
  last_posted_at: string | null;
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
  const [editForm, setEditForm] = useState({ created: false, linkageRequested: false, loginId: "", password: "", profileUrl: "" });
  const [showPassword, setShowPassword] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { storeId, store, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    const { data, error } = await rpc("get_sns_connection_overview", { p_store_id: storeId });
    if (error) toast.error(error.message);
    setRows((data || []) as O2Row[]);
    setLoading(false);
  }, [storeId, storeLoading, user]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => ({
    total: rows.length,
    credentials: rows.filter((row) => row.credential_configured).length,
    created: rows.filter((row) => row.o2_created).length,
    linked: rows.filter((row) => row.o2_linkage_requested).length,
    errors: rows.filter((row) => row.last_o2_status === "failed").length,
  }), [rows]);
  const cards = [
    { label: "在籍", value: summary.total, icon: Users },
    { label: "連携設定済み", value: summary.credentials, icon: ShieldCheck },
    { label: "O2作成済み", value: summary.created, icon: CheckCircle },
    { label: "店舗連携申請", value: summary.linked, icon: Link2 },
    { label: "投稿エラー", value: summary.errors, icon: XCircle },
  ];

  const openEdit = (row: O2Row) => {
    setEditing(row);
    setShowPassword(false);
    setEditForm({
      created: row.o2_created,
      linkageRequested: row.o2_linkage_requested,
      loginId: row.login_id || "",
      password: "",
      profileUrl: row.profile_url || "",
    });
  };

  const save = async () => {
    if (!editing) return;
    if (editForm.profileUrl && !/^https:\/\//i.test(editForm.profileUrl)) {
      toast.error("プロフィールURLはhttps://から入力してください");
      return;
    }
    if (editForm.password && !editForm.loginId.trim()) {
      toast.error("IDを入力してください");
      return;
    }
    if (!editing.credential_configured && editForm.loginId.trim() && !editForm.password) {
      toast.error("初回設定ではパスワードも入力してください");
      return;
    }
    setSaving(true);
    const { error } = await rpc("save_sns_connection_admin", {
      p_store_id: storeId,
      p_cast_id: editing.cast_id,
      p_o2_created: editForm.created,
      p_o2_linkage_requested: editForm.linkageRequested,
      p_login_id: editForm.loginId.trim() || null,
      p_password: editForm.password || null,
      p_profile_url: editForm.profileUrl.trim() || null,
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "mr-1 animate-spin" : "mr-1"} />更新</Button>
              <Button asChild><a href="https://m-sns.net/cast/login/" target="_blank" rel="noreferrer">O2を開く<ExternalLink size={15} className="ml-1" /></a></Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {cards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border bg-card p-4"><Icon size={18} className="text-primary mb-2" /><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            ))}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            管理者が本人に代わってID・パスワード・プロフィールURLを登録できます。パスワードは保存後に再表示せず、公開ページにはプロフィールURLだけを反映します。
          </div>

          <div className="grid gap-3 md:hidden">
            {loading ? <div className="rounded-xl border bg-card py-16 text-center"><Loader2 className="inline-block animate-spin text-primary" /></div> : rows.length === 0 ? <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">セラピストがいません</div> : rows.map((row) => (
              <div key={row.cast_id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">{row.photo ? <img src={row.photo} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="h-11 w-11 rounded-full bg-muted" />}<div className="min-w-0"><p className="font-medium truncate">{row.cast_name}</p>{row.credential_configured ? <Badge className="mt-1 bg-green-100 text-green-700 hover:bg-green-100">連携設定済み</Badge> : <Badge className="mt-1" variant="outline">未設定</Badge>}</div></div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil size={13} className="mr-1" />編集</Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">O2作成</p><p className={row.o2_created ? "mt-1 text-green-700" : "mt-1"}>{row.o2_created ? "✓ 作成済み" : "未作成"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">店舗連携</p><p className={row.o2_linkage_requested ? "mt-1 text-green-700" : "mt-1"}>{row.o2_linkage_requested ? "✓ 申請済み" : "未申請"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">直近投稿</p><p className="mt-1">{statusLabel[row.last_o2_status || ""] || "投稿なし"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">公開URL</p>{row.profile_url ? <a className="mt-1 inline-flex items-center text-primary" href={row.profile_url} target="_blank" rel="noreferrer">確認<ExternalLink size={12} className="ml-1" /></a> : <p className="mt-1">未設定</p>}</div>
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
                      <td className="px-3 py-3">{row.credential_configured ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">連携設定済み</Badge> : <Badge variant="outline">未設定</Badge>}</td>
                      <td className="px-3 py-3">{row.o2_created ? <span className="text-green-700">✓ 作成済み</span> : <span className="text-muted-foreground">未作成</span>}</td>
                      <td className="px-3 py-3">{row.o2_linkage_requested ? <span className="text-green-700">✓ 申請済み</span> : <span className="text-muted-foreground">未申請</span>}</td>
                      <td className="px-3 py-3"><span>{statusLabel[row.last_o2_status || ""] || "投稿なし"}</span>{row.last_posted_at && <p className="text-[11px] text-muted-foreground mt-1">{new Date(row.last_posted_at).toLocaleString("ja-JP")}</p>}</td>
                      <td className="px-3 py-3 max-w-[250px] text-xs text-red-600 break-words">{row.last_o2_error || "—"}</td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-2">{row.profile_url && <Button size="sm" variant="outline" asChild><a href={row.profile_url} target="_blank" rel="noreferrer">プロフィール<ExternalLink size={13} className="ml-1" /></a></Button>}<Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil size={13} className="mr-1" />編集</Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.cast_name}さんのSNS連携</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label htmlFor="sns-login-id">ID</Label><Input id="sns-login-id" autoComplete="off" placeholder="O2のログインID" value={editForm.loginId} onChange={(event) => setEditForm({ ...editForm, loginId: event.target.value })} /></div>
            <div>
              <Label htmlFor="sns-password">パスワード</Label>
              <div className="relative"><Input id="sns-password" className="pr-10" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={editing?.credential_configured ? "変更する場合のみ入力" : "O2のパスワード"} value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} /><button type="button" aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"} className="absolute right-0 top-0 h-full px-3 text-muted-foreground" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
              {editing?.credential_configured && <p className="mt-1 text-xs text-muted-foreground">現在のパスワードは表示されません。空欄なら変更しません。</p>}
            </div>
            <div><Label htmlFor="sns-profile-url">プロフィールURL</Label><Input id="sns-profile-url" inputMode="url" placeholder="https://m-sns.net/..." value={editForm.profileUrl} onChange={(event) => setEditForm({ ...editForm, profileUrl: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">保存すると公開側のセラピストカードと詳細ページへ反映されます。</p></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.created} onChange={(event) => setEditForm({ ...editForm, created: event.target.checked })} />O2アカウント作成済み</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.linkageRequested} onChange={(event) => setEditForm({ ...editForm, linkageRequested: event.target.checked })} />店舗連携を申請済み</label>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 size={14} className="mr-1 animate-spin" />}保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
