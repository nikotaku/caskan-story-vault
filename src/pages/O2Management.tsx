import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ExternalLink, Link2, Loader2, Pencil, RefreshCw, ShieldCheck, Users, XCircle } from "lucide-react";
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
  o2_url: string | null;
  credential_configured: boolean;
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
  const [editForm, setEditForm] = useState({ created: false, linkageRequested: false, url: "" });
  const { user, loading: authLoading } = useAuth();
  const { storeId, store, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    const { data, error } = await rpc("get_o2_connection_overview", { p_store_id: storeId });
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
    { label: "本人設定済み", value: summary.credentials, icon: ShieldCheck },
    { label: "O2作成済み", value: summary.created, icon: CheckCircle },
    { label: "店舗連携申請", value: summary.linked, icon: Link2 },
    { label: "投稿エラー", value: summary.errors, icon: XCircle },
  ];

  const openEdit = (row: O2Row) => {
    setEditing(row);
    setEditForm({ created: row.o2_created, linkageRequested: row.o2_linkage_requested, url: row.o2_url || "" });
  };

  const save = async () => {
    if (!editing) return;
    if (editForm.url && !/^https:\/\//i.test(editForm.url)) {
      toast.error("プロフィールURLはhttps://から入力してください");
      return;
    }
    setSaving(true);
    const { error } = await rpc("update_o2_linkage_admin", {
      p_store_id: storeId,
      p_cast_id: editing.cast_id,
      p_o2_created: editForm.created,
      p_o2_linkage_requested: editForm.linkageRequested,
      p_o2_url: editForm.url || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    toast.success("O2連携状況を更新しました");
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((value) => !value)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold">O2連携管理</h1><p className="text-sm text-muted-foreground">{store?.name || "店舗"}のアカウント作成・店舗連携・投稿結果を一覧で確認</p></div>
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
            O2のログイン情報はセラピスト本人がポータルで設定し、管理画面には表示しません。この画面では設定有無・店舗連携・投稿エラーだけを管理します。
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">セラピスト</th><th className="px-3 py-3">本人ログイン</th><th className="px-3 py-3">O2作成</th><th className="px-3 py-3">店舗連携</th><th className="px-3 py-3">直近投稿</th><th className="px-3 py-3">エラー</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
                <tbody className="divide-y">
                  {loading ? <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="inline-block animate-spin text-primary" /></td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">セラピストがいません</td></tr> : rows.map((row) => (
                    <tr key={row.cast_id} className="align-top">
                      <td className="px-4 py-3"><div className="flex items-center gap-2">{row.photo ? <img src={row.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-muted" />}<span className="font-medium">{row.cast_name}</span></div></td>
                      <td className="px-3 py-3">{row.credential_configured ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">設定済み</Badge> : <Badge variant="outline">未設定</Badge>}</td>
                      <td className="px-3 py-3">{row.o2_created ? <span className="text-green-700">✓ 作成済み</span> : <span className="text-muted-foreground">未作成</span>}</td>
                      <td className="px-3 py-3">{row.o2_linkage_requested ? <span className="text-green-700">✓ 申請済み</span> : <span className="text-muted-foreground">未申請</span>}</td>
                      <td className="px-3 py-3"><span>{statusLabel[row.last_o2_status || ""] || "投稿なし"}</span>{row.last_posted_at && <p className="text-[11px] text-muted-foreground mt-1">{new Date(row.last_posted_at).toLocaleString("ja-JP")}</p>}</td>
                      <td className="px-3 py-3 max-w-[250px] text-xs text-red-600 break-words">{row.last_o2_error || "—"}</td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-2">{row.o2_url && <Button size="sm" variant="outline" asChild><a href={row.o2_url} target="_blank" rel="noreferrer">プロフィール<ExternalLink size={13} className="ml-1" /></a></Button>}<Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil size={13} className="mr-1" />編集</Button></div></td>
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
          <DialogHeader><DialogTitle>{editing?.cast_name}さんのO2状況</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.created} onChange={(event) => setEditForm({ ...editForm, created: event.target.checked })} />O2アカウント作成済み</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.linkageRequested} onChange={(event) => setEditForm({ ...editForm, linkageRequested: event.target.checked })} />店舗連携を申請済み</label>
            <div><Label htmlFor="o2-profile-url">O2プロフィールURL</Label><Input id="o2-profile-url" placeholder="https://m-sns.net/..." value={editForm.url} onChange={(event) => setEditForm({ ...editForm, url: event.target.value })} /></div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 size={14} className="mr-1 animate-spin" />}保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
