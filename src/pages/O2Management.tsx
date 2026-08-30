import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ExternalLink, Eye, EyeOff, Link2, Loader2, Pencil, RefreshCw, Send, ShieldCheck, Users, XCircle } from "lucide-react";
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
import { isValidEmail } from "@/lib/email";

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
  x_password_configured: boolean;
  x_login_id: string | null;
  estama_profile_url: string | null;
  estama_credential_configured: boolean;
  estama_login_id: string | null;
  last_o2_status: string | null;
  last_o2_error: string | null;
  last_posted_at: string | null;
  settings_updated_at: string | null;
  settings_version: number;
};

type EditForm = {
  created: boolean;
  linkageRequested: boolean;
  o2Email: string;
  o2LoginId: string;
  o2Password: string;
  xLoginId: string;
  xPassword: string;
  deleteXPassword: boolean;
  estamaLoginId: string;
  estamaPassword: string;
  estamaProfileUrl: string;
};

type CredentialSite = "o2" | "x" | "esutama";

type RevealedPasswords = Partial<Record<CredentialSite, string>>;

type PasswordControlProps = {
  configured: boolean;
  disabled: boolean;
  editing: boolean;
  id: string;
  label: string;
  loading: boolean;
  newPassword: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
  revealedPassword?: string;
  visible: boolean;
};

const EMPTY_EDIT_FORM: EditForm = {
  created: false,
  linkageRequested: false,
  o2Email: "",
  o2LoginId: "",
  o2Password: "",
  xLoginId: "",
  xPassword: "",
  deleteXPassword: false,
  estamaLoginId: "",
  estamaPassword: "",
  estamaProfileUrl: "",
};

const normalizeO2Id = (value: string) => value
  .trim()
  .replace(/^https?:\/\/(?:www\.)?m-sns\.net\/profile\//i, "")
  .replace(/^@/, "")
  .split(/[/?#]/, 1)[0];

const buildO2ProfileUrl = (value: string) => {
  const id = normalizeO2Id(value);
  return id ? `https://m-sns.net/profile/@${id}` : "";
};

const normalizeXId = (value: string) => value
  .trim()
  .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "")
  .replace(/^@/, "")
  .split(/[/?#]/, 1)[0];

const buildXProfileUrl = (value: string) => {
  const id = normalizeXId(value);
  return id ? `https://x.com/${id}` : "";
};

const isSoulConfigured = (row: O2Row) => row.estama_credential_configured;

const hasSavedSettings = (row: O2Row) => Boolean(row.settings_updated_at);

const createEditForm = (row: O2Row): EditForm => ({
  created: row.o2_created,
  linkageRequested: row.o2_linkage_requested,
  o2Email: row.o2_login_email || "",
  o2LoginId: row.login_id || normalizeO2Id(row.profile_url || ""),
  o2Password: "",
  xLoginId: row.x_login_id || normalizeXId(row.x_profile_url || ""),
  xPassword: "",
  deleteXPassword: false,
  estamaLoginId: row.estama_login_id || "",
  estamaPassword: "",
  estamaProfileUrl: row.estama_profile_url || "",
});

const connectionBadgeClass = {
  o2: "border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-100",
  x: "border-slate-800 bg-slate-900 text-white hover:bg-slate-900",
  soul: "border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-100",
};

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (rpcName: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>)(name, args);

const statusLabel: Record<string, string> = {
  pending: "送信待ち",
  posting: "送信中",
  posted: "投稿済み",
  failed: "失敗",
  skipped: "未設定",
};

function PasswordControl({
  configured,
  disabled,
  editing,
  id,
  label,
  loading,
  newPassword,
  onChange,
  onToggle,
  placeholder,
  revealedPassword,
  visible,
}: PasswordControlProps) {
  const toggleLabel = visible ? `${label}のパスワードを隠す` : `${label}のパスワードを表示`;

  if (editing) {
    return (
      <div className="relative">
        <Input
          id={id}
          className="bg-white pr-10"
          readOnly={disabled}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder={configured ? "変更する場合のみ入力" : placeholder}
          value={newPassword}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={toggleLabel}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-full items-center px-3 text-muted-foreground disabled:opacity-40"
          disabled={disabled || !newPassword}
          onClick={onToggle}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        id={id}
        aria-live="polite"
        aria-label={`${label}の保存済みパスワード`}
        aria-readonly="true"
        role="textbox"
        className="flex min-h-10 w-full items-center rounded-md border border-input bg-white/70 px-3 py-2 pr-10 text-sm break-all"
      >
        {configured ? (visible && revealedPassword ? revealedPassword : "••••••••") : "未設定"}
      </div>
      <button
        type="button"
        aria-label={toggleLabel}
        aria-pressed={visible}
        className="absolute right-0 top-0 flex h-full items-center px-3 text-muted-foreground disabled:opacity-40"
        disabled={loading || !configured}
        onClick={onToggle}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function O2Management() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState<O2Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingCastId, setOpeningCastId] = useState<string | null>(null);
  const [refreshingSettings, setRefreshingSettings] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState<CredentialSite | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<RevealedPasswords>({});
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [editing, setEditing] = useState<O2Row | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [savedForm, setSavedForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [showO2Password, setShowO2Password] = useState(false);
  const [showXPassword, setShowXPassword] = useState(false);
  const [showEstamaPassword, setShowEstamaPassword] = useState(false);
  const passwordRequestId = useRef(0);
  const settingsRequestId = useRef(0);
  const savingRef = useRef(false);
  const { user, loading: authLoading } = useAuth();
  const { storeId, store, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    const [{ data, error }, { data: activeCasts, error: activeCastsError }] = await Promise.all([
      rpc("get_sns_connection_overview_v7", { p_store_id: storeId }),
      supabase.from("casts").select("id").eq("store_id", storeId).eq("is_active", true),
    ]);
    if (error) toast.error(error.message);
    if (activeCastsError) toast.error(activeCastsError.message);
    const activeCastIds = new Set((activeCasts || []).map((cast) => cast.id));
    setRows(((data || []) as O2Row[]).filter((row) => activeCastIds.has(row.cast_id)));
    setLoading(false);
  }, [storeId, storeLoading, user]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => ({
    total: rows.length,
    credentials: rows.filter((row) => row.credential_configured).length,
    xCredentials: rows.filter((row) => row.x_credential_configured).length,
    soulConfigured: rows.filter(isSoulConfigured).length,
    created: rows.filter((row) => row.o2_created).length,
    linked: rows.filter((row) => row.o2_linkage_requested).length,
    errors: rows.filter((row) => row.last_o2_status === "failed").length,
  }), [rows]);
  const cards = [
    { label: "在籍", value: summary.total, icon: Users, cardClass: "", iconClass: "text-primary" },
    { label: "O2設定済み", value: summary.credentials, icon: ShieldCheck, cardClass: "border-rose-200 bg-rose-50/60", iconClass: "text-rose-600" },
    { label: "X設定済み", value: summary.xCredentials, icon: ShieldCheck, cardClass: "border-slate-300 bg-slate-50", iconClass: "text-slate-800" },
    { label: "魂連携済み", value: summary.soulConfigured, icon: ShieldCheck, cardClass: "border-violet-200 bg-violet-50/60", iconClass: "text-violet-600" },
    { label: "O2作成済み", value: summary.created, icon: CheckCircle, cardClass: "", iconClass: "text-primary" },
    { label: "店舗連携申請", value: summary.linked, icon: Link2, cardClass: "", iconClass: "text-primary" },
    { label: "投稿エラー", value: summary.errors, icon: XCircle, cardClass: "", iconClass: "text-primary" },
  ];

  const closeEdit = () => {
    passwordRequestId.current += 1;
    settingsRequestId.current += 1;
    setEditing(null);
    setOpeningCastId(null);
    setRefreshingSettings(false);
    setLoadingPassword(null);
    setRevealedPasswords({});
    setIsEditingCredentials(false);
    setEditForm(EMPTY_EDIT_FORM);
    setSavedForm(EMPTY_EDIT_FORM);
    setShowO2Password(false);
    setShowXPassword(false);
    setShowEstamaPassword(false);
  };

  const openEdit = async (row: O2Row) => {
    if (saving) return;
    passwordRequestId.current += 1;
    const requestId = settingsRequestId.current + 1;
    settingsRequestId.current = requestId;
    setOpeningCastId(row.cast_id);
    const { data, error } = await rpc("get_sns_connection_overview_v7", { p_store_id: storeId });

    if (settingsRequestId.current !== requestId) return;
    setOpeningCastId(null);
    if (error) {
      toast.error(error.message);
      return;
    }

    const freshRow = ((data || []) as O2Row[]).find((candidate) => candidate.cast_id === row.cast_id);
    if (!freshRow) {
      toast.error("最新の設定を取得できませんでした");
      return;
    }

    const baseForm = createEditForm(freshRow);
    setEditing(freshRow);
    setEditForm(baseForm);
    setSavedForm(baseForm);
    setIsEditingCredentials(!hasSavedSettings(freshRow));
    setLoadingPassword(null);
    setRevealedPasswords({});
    setShowO2Password(false);
    setShowXPassword(false);
    setShowEstamaPassword(false);
  };

  const clearRevealedPasswords = () => {
    passwordRequestId.current += 1;
    setLoadingPassword(null);
    setRevealedPasswords({});
    setShowO2Password(false);
    setShowXPassword(false);
    setShowEstamaPassword(false);
  };

  const beginEdit = async () => {
    if (!editing || saving || refreshingSettings) return;

    const castId = editing.cast_id;
    const requestId = settingsRequestId.current + 1;
    settingsRequestId.current = requestId;
    setRefreshingSettings(true);
    const { data, error } = await rpc("get_sns_connection_overview_v7", { p_store_id: storeId });

    if (settingsRequestId.current !== requestId) return;
    setRefreshingSettings(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const freshRow = ((data || []) as O2Row[]).find((row) => row.cast_id === castId);
    if (!freshRow) {
      toast.error("最新の設定を取得できませんでした");
      return;
    }

    const freshForm = createEditForm(freshRow);
    clearRevealedPasswords();
    setEditing(freshRow);
    setEditForm(freshForm);
    setSavedForm(freshForm);
    setIsEditingCredentials(true);
  };

  const cancelEdit = () => {
    setEditForm(savedForm);
    setIsEditingCredentials(false);
    clearRevealedPasswords();
  };

  const togglePassword = async (site: CredentialSite) => {
    if (!editing) return;

    const isVisible = site === "o2"
      ? showO2Password
      : site === "x"
        ? showXPassword
        : showEstamaPassword;
    const setVisible = site === "o2"
      ? setShowO2Password
      : site === "x"
        ? setShowXPassword
        : setShowEstamaPassword;

    if (isVisible) {
      setVisible(false);
      if (!isEditingCredentials) {
        setRevealedPasswords((current) => ({ ...current, [site]: undefined }));
      }
      return;
    }

    if (isEditingCredentials) {
      setVisible(true);
      return;
    }

    const requestId = passwordRequestId.current + 1;
    passwordRequestId.current = requestId;
    setRevealedPasswords({});
    setShowO2Password(false);
    setShowXPassword(false);
    setShowEstamaPassword(false);
    setLoadingPassword(site);
    const { data, error } = await rpc("get_sns_connection_password_admin_v1", {
      p_store_id: storeId,
      p_cast_id: editing.cast_id,
      p_site: site,
    });

    if (passwordRequestId.current !== requestId) return;
    setLoadingPassword(null);
    if (error || typeof data !== "string" || !data) {
      toast.error(error?.message || "保存済みパスワードを取得できませんでした");
      return;
    }

    setRevealedPasswords((current) => ({ ...current, [site]: data }));
    setVisible(true);
  };

  const openPostForm = (row: O2Row) => {
    navigate(`/post-management?cast=${encodeURIComponent(row.cast_id)}&mode=test`);
  };

  const save = async () => {
    if (!editing || !isEditingCredentials || savingRef.current) return;
    const o2Email = editForm.o2Email.trim();
    const o2LoginId = normalizeO2Id(editForm.o2LoginId);
    if (o2Email && !isValidEmail(o2Email)) {
      toast.error("O2の登録メールアドレスの形式が正しくありません（例: therapist@example.jp）");
      return;
    }
    if (o2LoginId && !o2Email) {
      toast.error("O2の登録メールアドレスを入力してください");
      return;
    }
    if (o2LoginId && !/^[A-Za-z0-9_]+$/.test(o2LoginId)) {
      toast.error("O2のIDは半角英数字とアンダーバーで入力してください");
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
    const xLoginId = normalizeXId(editForm.xLoginId);
    if (xLoginId && !/^[A-Za-z0-9_]+$/.test(xLoginId)) {
      toast.error("XのIDは半角英数字とアンダーバーで入力してください");
      return;
    }
    if (editForm.xPassword && !xLoginId) {
      toast.error("XのIDを入力してください");
      return;
    }
    if (editForm.deleteXPassword && editForm.xPassword) {
      toast.error("Xのパスワードは変更か削除のどちらか一方を選んでください");
      return;
    }
    const estamaLoginId = editForm.estamaLoginId.trim();
    if (editForm.estamaPassword && !estamaLoginId) {
      toast.error("魂セラピストのIDを入力してください");
      return;
    }
    if (!editing.estama_credential_configured && estamaLoginId && !editForm.estamaPassword) {
      toast.error("魂セラピストの初回設定ではパスワードも入力してください");
      return;
    }
    const estamaProfileUrl = editForm.estamaProfileUrl.trim();
    if (estamaProfileUrl && !/^https:\/\/(?:www\.)?estama\.jp\//i.test(estamaProfileUrl)) {
      toast.error("魂セラピストのプロフィールURLを入力してください");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const { error } = await rpc("save_sns_connection_admin_v7", {
        p_store_id: storeId,
        p_cast_id: editing.cast_id,
        p_o2_created: editForm.created,
        p_o2_linkage_requested: editForm.linkageRequested,
        p_o2_login_email: o2Email || null,
        p_login_id: o2LoginId || null,
        p_password: editForm.o2Password || null,
        p_x_login_id: xLoginId || null,
        p_x_password: editForm.xPassword || null,
        p_delete_x_password: editForm.deleteXPassword,
        p_estama_login_id: estamaLoginId || null,
        p_estama_password: editForm.estamaPassword || null,
        p_estama_profile_url: estamaProfileUrl || null,
        p_expected_settings_version: editing.settings_version,
      });
      if (error) {
        toast.error(error.message);
        if (error.code === "40001") {
          closeEdit();
          await load();
        }
        return;
      }
      closeEdit();
      toast.success("O2・X・魂セラピストの設定を更新しました");
      await load();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const savedSettings = editing ? hasSavedSettings(editing) : false;
  const fieldsReadOnly = !isEditingCredentials || saving;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen((value) => !value)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold">O2・X・魂セラピスト連携管理</h1><p className="text-sm text-muted-foreground">{store?.name || "店舗"}のセラピスト別アカウントと公開プロフィールを管理</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "mr-1 animate-spin" : "mr-1"} />更新</Button>
              <Button variant="outline" asChild><a href="https://m-sns.net/cast/login/" target="_blank" rel="noreferrer">O2を開く<ExternalLink size={15} className="ml-1" /></a></Button>
              <Button asChild><a href="https://estama.jp/tamathera/login/" target="_blank" rel="noreferrer">魂セラピストにログイン<ExternalLink size={15} className="ml-1" /></a></Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
            {cards.map(({ label, value, icon: Icon, cardClass, iconClass }) => (
              <div key={label} className={`rounded-xl border bg-card p-4 ${cardClass}`}><Icon size={18} className={`${iconClass} mb-2`} /><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            ))}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            魂セラピストの初回設定は手動で完了してください。同時投稿では、ここに保存した魂セラピスト専用のID・パスワードで固定ログイン画面から投稿します。
          </div>

          <div className="grid gap-3 md:hidden">
            {loading ? <div className="rounded-xl border bg-card py-16 text-center"><Loader2 className="inline-block animate-spin text-primary" /></div> : rows.length === 0 ? <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">セラピストがいません</div> : rows.map((row) => (
              <div key={row.cast_id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">{row.photo ? <img src={row.photo} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="h-11 w-11 rounded-full bg-muted" />}<div className="min-w-0"><p className="font-medium truncate">{row.cast_name}</p><div className="mt-1 flex flex-wrap gap-1"><Badge className={`${connectionBadgeClass.o2} ${row.credential_configured ? "" : "opacity-45"}`}>O2</Badge><Badge className={`${connectionBadgeClass.x} ${row.x_credential_configured ? "" : "opacity-35"}`}>X</Badge><Badge className={`${connectionBadgeClass.soul} ${isSoulConfigured(row) ? "" : "opacity-45"}`}>魂セラピスト</Badge></div></div></div>
                  <Button size="sm" variant="outline" onClick={() => void openEdit(row)} disabled={openingCastId === row.cast_id}>
                    {openingCastId === row.cast_id ? <Loader2 size={13} className="mr-1 animate-spin" /> : hasSavedSettings(row) ? <Eye size={13} className="mr-1" /> : <Pencil size={13} className="mr-1" />}
                    {hasSavedSettings(row) ? "確認" : "設定"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">O2作成</p><p className={row.o2_created ? "mt-1 text-green-700" : "mt-1"}>{row.o2_created ? "✓ 作成済み" : "未作成"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">店舗連携</p><p className={row.o2_linkage_requested ? "mt-1 text-green-700" : "mt-1"}>{row.o2_linkage_requested ? "✓ 申請済み" : "未申請"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">直近投稿</p><p className="mt-1">{statusLabel[row.last_o2_status || ""] || "投稿なし"}</p></div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">公開URL</p>{row.profile_url ? <a className="mt-1 inline-flex items-center text-primary" href={row.profile_url} target="_blank" rel="noreferrer">確認<ExternalLink size={12} className="ml-1" /></a> : <p className="mt-1">未設定</p>}</div>
                  <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">魂URL</p>{row.estama_profile_url ? <a className="mt-1 inline-flex items-center text-primary" href={row.estama_profile_url} target="_blank" rel="noreferrer">確認<ExternalLink size={12} className="ml-1" /></a> : <p className="mt-1">未設定</p>}</div>
                </div>
                <Button className="w-full" onClick={() => openPostForm(row)}><Send size={14} className="mr-1" />投稿フォーム</Button>
                {row.last_o2_error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600 break-words">{row.last_o2_error}</p>}
              </div>
            ))}
          </div>

          <div className="hidden md:block border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">セラピスト</th><th className="px-3 py-3">媒体連携</th><th className="px-3 py-3">O2作成</th><th className="px-3 py-3">店舗連携</th><th className="px-3 py-3">直近投稿</th><th className="px-3 py-3">エラー</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
                <tbody className="divide-y">
                  {loading ? <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="inline-block animate-spin text-primary" /></td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">セラピストがいません</td></tr> : rows.map((row) => (
                    <tr key={row.cast_id} className="align-top">
                      <td className="px-4 py-3"><div className="flex items-center gap-2">{row.photo ? <img src={row.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-muted" />}<span className="font-medium">{row.cast_name}</span></div></td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-1"><Badge className={`${connectionBadgeClass.o2} ${row.credential_configured ? "" : "opacity-45"}`}>O2</Badge><Badge className={`${connectionBadgeClass.x} ${row.x_credential_configured ? "" : "opacity-35"}`}>X</Badge><Badge className={`${connectionBadgeClass.soul} ${isSoulConfigured(row) ? "" : "opacity-45"}`}>魂セラピスト</Badge></div></td>
                      <td className="px-3 py-3">{row.o2_created ? <span className="text-green-700">✓ 作成済み</span> : <span className="text-muted-foreground">未作成</span>}</td>
                      <td className="px-3 py-3">{row.o2_linkage_requested ? <span className="text-green-700">✓ 申請済み</span> : <span className="text-muted-foreground">未申請</span>}</td>
                      <td className="px-3 py-3"><span>{statusLabel[row.last_o2_status || ""] || "投稿なし"}</span>{row.last_posted_at && <p className="text-[11px] text-muted-foreground mt-1">{new Date(row.last_posted_at).toLocaleString("ja-JP")}</p>}</td>
                      <td className="px-3 py-3 max-w-[250px] text-xs text-red-600 break-words">{row.last_o2_error || "—"}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-2"><Button size="sm" onClick={() => openPostForm(row)}><Send size={13} className="mr-1" />投稿フォーム</Button>{row.profile_url && <Button size="sm" variant="outline" asChild><a href={row.profile_url} target="_blank" rel="noreferrer">O2<ExternalLink size={13} className="ml-1" /></a></Button>}{row.estama_profile_url && <Button size="sm" variant="outline" asChild><a href={row.estama_profile_url} target="_blank" rel="noreferrer">魂<ExternalLink size={13} className="ml-1" /></a></Button>}<Button size="sm" variant="outline" onClick={() => void openEdit(row)} disabled={openingCastId === row.cast_id}>{openingCastId === row.cast_id ? <Loader2 size={13} className="mr-1 animate-spin" /> : hasSavedSettings(row) ? <Eye size={13} className="mr-1" /> : <Pencil size={13} className="mr-1" />}{hasSavedSettings(row) ? "確認" : "設定"}</Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !saving && closeEdit()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-8">
              <DialogTitle>{editing?.cast_name}さんのO2・X・魂セラピスト連携</DialogTitle>
              {savedSettings && !isEditingCredentials && (
                <Button type="button" size="sm" variant="outline" onClick={() => void beginEdit()} disabled={refreshingSettings}>
                  {refreshingSettings ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Pencil size={13} className="mr-1" />}編集
                </Button>
              )}
            </div>
          </DialogHeader>
          {savedSettings && !isEditingCredentials && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
              保存済みの内容です。入力内容を変更する場合だけ「編集」を押してください。
            </p>
          )}
          <div className="space-y-4 mt-2">
            <section className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-rose-800">O2</h3>{editing?.credential_configured && <Badge className={connectionBadgeClass.o2}>設定済み</Badge>}</div>
              <div><Label htmlFor="o2-email">登録メールアドレス</Label><Input id="o2-email" readOnly={fieldsReadOnly} className={fieldsReadOnly ? "bg-white/70" : "bg-white"} type="email" autoComplete="email" placeholder="therapist@example.jp" value={editForm.o2Email} onChange={(event) => setEditForm({ ...editForm, o2Email: event.target.value })} /></div>
              <div><Label htmlFor="o2-login-id">ID</Label><Input id="o2-login-id" readOnly={fieldsReadOnly} className={fieldsReadOnly ? "bg-white/70" : "bg-white"} autoComplete="off" placeholder="例: enka_asami" value={editForm.o2LoginId} onChange={(event) => setEditForm({ ...editForm, o2LoginId: event.target.value })} /></div>
              <div>
                <Label htmlFor="o2-password">パスワード</Label>
                <PasswordControl
                  id="o2-password"
                  label="O2"
                  configured={Boolean(editing?.credential_configured)}
                  disabled={saving}
                  editing={isEditingCredentials}
                  loading={loadingPassword === "o2"}
                  newPassword={editForm.o2Password}
                  onChange={(value) => setEditForm({ ...editForm, o2Password: value })}
                  onToggle={() => void togglePassword("o2")}
                  placeholder="O2のパスワード"
                  revealedPassword={revealedPasswords.o2}
                  visible={showO2Password}
                />
                {editing?.credential_configured && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isEditingCredentials ? "新しいパスワードを入力した場合のみ変更します。" : "目のボタンを押すと保存済みのパスワードを確認できます。"}
                  </p>
                )}
              </div>
              <div><Label htmlFor="o2-profile-url">公開URL（自動生成）</Label><Input id="o2-profile-url" readOnly value={buildO2ProfileUrl(editForm.o2LoginId)} placeholder="IDを入力すると自動生成されます" className="bg-muted/60" /><p className="mt-1 text-xs text-muted-foreground">公開側のセラピストカードと詳細ページへ反映されます。</p></div>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={fieldsReadOnly} checked={editForm.created} onChange={(event) => setEditForm({ ...editForm, created: event.target.checked })} />O2アカウント作成済み</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={fieldsReadOnly} checked={editForm.linkageRequested} onChange={(event) => setEditForm({ ...editForm, linkageRequested: event.target.checked })} />店舗連携を申請済み</label>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">X</h3>{editing?.x_credential_configured && <Badge className={connectionBadgeClass.x}>ID設定済み</Badge>}</div>
              <div><Label htmlFor="x-login-id">ID</Label><Input id="x-login-id" readOnly={fieldsReadOnly} className={fieldsReadOnly ? "bg-white/70" : "bg-white"} autoComplete="off" placeholder="例: enka_asami" value={editForm.xLoginId} onChange={(event) => setEditForm({ ...editForm, xLoginId: event.target.value })} /></div>
              <div>
                <Label htmlFor="x-password">パスワード（任意メモ）</Label>
                <PasswordControl
                  id="x-password"
                  label="X"
                  configured={Boolean(editing?.x_password_configured)}
                  disabled={saving || editForm.deleteXPassword}
                  editing={isEditingCredentials}
                  loading={loadingPassword === "x"}
                  newPassword={editForm.xPassword}
                  onChange={(value) => setEditForm({ ...editForm, xPassword: value, deleteXPassword: false })}
                  onToggle={() => void togglePassword("x")}
                  placeholder="Xのパスワード"
                  revealedPassword={revealedPasswords.x}
                  visible={showXPassword}
                />
                {editing?.x_password_configured && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isEditingCredentials ? "新しいパスワードを入力した場合のみ変更します。" : "目のボタンを押すと保存済みのパスワードを確認できます。"}
                  </p>
                )}
                {isEditingCredentials && editing?.x_password_configured && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={editForm.deleteXPassword}
                      disabled={saving}
                      onChange={(event) => setEditForm({
                        ...editForm,
                        deleteXPassword: event.target.checked,
                        xPassword: event.target.checked ? "" : editForm.xPassword,
                      })}
                    />
                    保存済みのXパスワードを削除する
                  </label>
                )}
              </div>
              <div><Label htmlFor="x-profile-url">公開URL（自動生成）</Label><Input id="x-profile-url" readOnly value={buildXProfileUrl(editForm.xLoginId)} placeholder="IDを入力すると自動生成されます" className="bg-white/70" /></div>
              <p className="rounded-lg bg-white/80 p-3 text-xs text-slate-600">XはIDだけで保存できます。パスワードは任意のメモで、投稿フォームからXへの投稿連携には使用しません。</p>
            </section>

            <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-violet-800">魂セラピスト</h3>{editing?.estama_credential_configured && <Badge className={connectionBadgeClass.soul}>ID・PW設定済み</Badge>}</div>
              <div><Label htmlFor="estama-login-id">ID</Label><Input id="estama-login-id" readOnly={fieldsReadOnly} className={fieldsReadOnly ? "bg-white/70" : "bg-white"} autoComplete="off" placeholder="魂セラピストのID" value={editForm.estamaLoginId} onChange={(event) => setEditForm({ ...editForm, estamaLoginId: event.target.value })} /></div>
              <div>
                <Label htmlFor="estama-password">パスワード</Label>
                <PasswordControl
                  id="estama-password"
                  label="魂セラピスト"
                  configured={Boolean(editing?.estama_credential_configured)}
                  disabled={saving}
                  editing={isEditingCredentials}
                  loading={loadingPassword === "esutama"}
                  newPassword={editForm.estamaPassword}
                  onChange={(value) => setEditForm({ ...editForm, estamaPassword: value })}
                  onToggle={() => void togglePassword("esutama")}
                  placeholder="魂セラピストのパスワード"
                  revealedPassword={revealedPasswords.esutama}
                  visible={showEstamaPassword}
                />
                {editing?.estama_credential_configured && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isEditingCredentials ? "新しいパスワードを入力した場合のみ変更します。" : "目のボタンを押すと保存済みのパスワードを確認できます。"}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="font-medium">初回設定は手動で行います</p>
                <p className="mt-1 text-xs text-muted-foreground">初回設定後、同時投稿では毎回ログイン画面からID・パスワードを入力して投稿します。</p>
                <a href="https://estama.jp/tamathera/login/" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center text-xs text-primary">魂セラピストのログイン画面を開く<ExternalLink size={12} className="ml-1" /></a>
              </div>
              <div><Label htmlFor="estama-profile-url">プロフィールURL</Label><Input id="estama-profile-url" readOnly={fieldsReadOnly} className={fieldsReadOnly ? "bg-white/70" : "bg-white"} type="url" placeholder="https://estama.jp/shop/..." value={editForm.estamaProfileUrl} onChange={(event) => setEditForm({ ...editForm, estamaProfileUrl: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">公開側のセラピストカードと詳細ページへ自動反映されます。</p></div>
            </section>

            <p className="text-xs text-muted-foreground">O2・X・魂セラピストの情報は別々に保存されます。Xのパスワードは任意で、投稿フォームの連携先はO2と魂セラピストのみです。</p>
            {isEditingCredentials && (
              <div className="flex gap-2">
                {savedSettings && <Button type="button" className="flex-1" variant="outline" onClick={cancelEdit} disabled={saving}>編集をやめる</Button>}
                <Button className="flex-1" onClick={save} disabled={saving}>{saving && <Loader2 size={14} className="mr-1 animate-spin" />}保存</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
