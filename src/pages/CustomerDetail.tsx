import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, Loader2, Save, Heart, History, Phone, User, Lightbulb, Copy, ShieldAlert, Trash2 } from "lucide-react";
import {
  getCustomerRank, PRESSURE_OPTIONS, AREA_OPTIONS, CONVERSATION_OPTIONS,
} from "@/lib/customerRank";
import { getCustomerInsights } from "@/lib/customerInsights";

/**
 * 顧客詳細ページ（/database/customers/:id）。
 * 好み・セラピストNGの登録編集と、全来店履歴（電話番号正規化マッチ）を表示する。
 * 日別予約情報の顧客パネルなどからリンクされる。
 */

interface Customer {
  id: string;
  store_id: string;
  name: string;
  phone: string | null;
  visit_count: number | null;
  total_spent: number | null;
  last_visited: string | null;
  last_cast_id: string | null;
  tags: string[] | null;
  notes: string | null;
  is_banned: boolean | null;
  ban_reason: string | null;
}

interface CrmMetric {
  median_visit_interval_days: number | null;
  future_booking_date: string | null;
  cancellation_rate: number | null;
  favorite_course: string | null;
  latest_followup_date: string | null;
  next_action_date: string | null;
  identity_conflict: boolean | null;
}

interface Profile {
  preferred_pressure: string | null;
  concern_areas: string[] | null;
  conversation_level: string | null;
  ng_items: string | null;
  preference_notes: string | null;
}

const EMPTY_PROFILE: Profile = {
  preferred_pressure: null,
  concern_areas: null,
  conversation_level: null,
  ng_items: null,
  preference_notes: null,
};

interface Visit {
  id: string;
  reservation_date: string;
  start_time: string;
  course_name: string | null;
  options: string[] | null;
  nomination_type: string | null;
  price: number | null;
  discount: number | null;
  status: string;
  cast_name: string | null;
  notes: string | null;
}

interface CastOption {
  id: string;
  name: string;
  is_active: boolean | null;
}

interface TherapistNg {
  id: string;
  cast_id: string;
  reason: string | null;
  created_at: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "完了", cls: "bg-green-100 text-green-700" },
  confirmed: { label: "確定", cls: "bg-blue-100 text-blue-700" },
  pending: { label: "リクエスト", cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "キャンセル", cls: "bg-gray-100 text-gray-500" },
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [crmMetric, setCrmMetric] = useState<CrmMetric | null>(null);
  const [metricsUnavailable, setMetricsUnavailable] = useState(false);
  const [lastTherapist, setLastTherapist] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [casts, setCasts] = useState<CastOption[]>([]);
  const [therapistNgs, setTherapistNgs] = useState<TherapistNg[]>([]);
  const [ngCastId, setNgCastId] = useState("");
  const [ngReason, setNgReason] = useState("");
  const [ngSaving, setNgSaving] = useState(false);
  const [removingNgId, setRemovingNgId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => { document.title = "顧客詳細"; }, []);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setVisitsLoading(true);
    const [custRes, profRes, metricRes] = await Promise.all([
      supabase.from("customers").select("id, store_id, name, phone, visit_count, total_spent, last_visited, last_cast_id, tags, notes, is_banned, ban_reason").eq("id", id).maybeSingle(),
      supabase.from("customer_profiles").select("preferred_pressure, concern_areas, conversation_level, ng_items, preference_notes").eq("customer_id", id).maybeSingle(),
      supabase.rpc("get_customer_crm_metrics", { p_customer_ids: [id] }),
    ]);
    if (!custRes.data) {
      toast.error("顧客が見つかりませんでした");
      setLoading(false);
      setVisitsLoading(false);
      return;
    }
    const loadedCustomer = custRes.data as Customer;
    setCustomer(loadedCustomer);
    const loadedProfile = (profRes.data as Profile) ?? EMPTY_PROFILE;
    setProfile(loadedProfile);
    if (metricRes.error) {
      console.warn("CRM metrics unavailable", metricRes.error);
      setCrmMetric(null);
      setMetricsUnavailable(true);
    } else {
      const loadedMetric = ((metricRes.data || [])[0] as unknown as CrmMetric) ?? null;
      setCrmMetric(loadedMetric);
      setMetricsUnavailable(!loadedMetric);
    }

    const [castsRes, therapistNgsRes] = await Promise.all([
      supabase
        .from("casts")
        .select("id, name, is_active")
        .eq("store_id", loadedCustomer.store_id)
        .order("name"),
      supabase
        .from("customer_ng_casts")
        .select("id, cast_id, reason, created_at")
        .eq("customer_id", id)
        .eq("store_id", loadedCustomer.store_id)
        .order("created_at", { ascending: false }),
    ]);
    if (castsRes.error || therapistNgsRes.error) {
      console.error("Therapist NG data unavailable", castsRes.error ?? therapistNgsRes.error);
      toast.error("セラピストNG情報の取得に失敗しました");
    }
    setCasts((castsRes.data ?? []) as CastOption[]);
    setTherapistNgs((therapistNgsRes.data ?? []) as TherapistNg[]);

    const castId = loadedCustomer.last_cast_id;
    if (castId) {
      const { data: cast } = await supabase.from("casts").select("name").eq("id", castId).maybeSingle();
      setLastTherapist(cast?.name ?? null);
    } else {
      setLastTherapist(null);
    }
    setLoading(false);

    const { data: visitData, error: visitErr } = await supabase.rpc("get_customer_reservations", { p_customer_id: id });
    if (visitErr) toast.error("来店履歴の取得に失敗しました");
    setVisits(((visitData || []) as Visit[]));
    setVisitsLoading(false);
  }, [id]);

  useEffect(() => {
    if (user && id) fetchAll();
  }, [user, id, fetchAll]);

  const handleSaveProfile = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from("customer_profiles").upsert(
      {
        customer_id: id,
        store_id: customer?.store_id,
        preferred_pressure: profile.preferred_pressure,
        concern_areas: profile.concern_areas,
        conversation_level: profile.conversation_level,
        ng_items: profile.ng_items,
        preference_notes: profile.preference_notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    );
    if (error) {
      console.error(error);
      toast.error("保存に失敗しました");
    } else {
      toast.success("好みを保存しました");
    }
    setSaving(false);
  };

  const toggleArea = (area: string) => {
    const current = profile.concern_areas ?? [];
    const next = current.includes(area) ? current.filter((a) => a !== area) : [...current, area];
    setProfile({ ...profile, concern_areas: next.length > 0 ? next : null });
  };

  const handleAddTherapistNg = async () => {
    if (!id || !customer) return;
    if (!ngCastId) {
      toast.error("セラピストを選択してください");
      return;
    }
    const reason = ngReason.trim();
    if (!reason) {
      toast.error("NG理由を入力してください");
      return;
    }
    if (therapistNgs.some((entry) => entry.cast_id === ngCastId)) {
      toast.error("このセラピストはすでにNG登録されています");
      return;
    }

    setNgSaving(true);
    const { data, error } = await supabase
      .from("customer_ng_casts")
      .insert({
        customer_id: id,
        cast_id: ngCastId,
        store_id: customer.store_id,
        reason,
      })
      .select("id, cast_id, reason, created_at")
      .single();

    if (error) {
      console.error(error);
      toast.error(error.code === "23505" ? "このセラピストはすでにNG登録されています" : "NG登録に失敗しました");
    } else {
      setTherapistNgs((current) => [data as TherapistNg, ...current]);
      setNgCastId("");
      setNgReason("");
      toast.success("セラピストNGを登録しました");
    }
    setNgSaving(false);
  };

  const handleRemoveTherapistNg = async (entry: TherapistNg) => {
    if (!id || !customer) return;
    const castName = casts.find((cast) => cast.id === entry.cast_id)?.name ?? "選択したセラピスト";
    if (!window.confirm(`${castName}さんのNG登録を解除しますか？`)) return;

    setRemovingNgId(entry.id);
    const { data, error } = await supabase
      .from("customer_ng_casts")
      .delete()
      .eq("id", entry.id)
      .eq("customer_id", id)
      .eq("store_id", customer.store_id)
      .select("id");

    if (error || !data?.length) {
      console.error(error);
      toast.error("NG登録の解除に失敗しました");
    } else {
      setTherapistNgs((current) => current.filter((item) => item.id !== entry.id));
      toast.success("セラピストNGを解除しました");
    }
    setRemovingNgId(null);
  };

  const completedVisits = visits.filter((v) => v.status === "completed");
  const rank = customer ? getCustomerRank(customer) : null;
  const insight = useMemo(() => customer ? getCustomerInsights({
    ...customer,
    last_therapist: lastTherapist,
    favorite_course: crmMetric?.favorite_course,
    median_visit_interval_days: crmMetric?.median_visit_interval_days,
    future_booking_date: crmMetric?.future_booking_date,
    cancellation_rate: crmMetric?.cancellation_rate,
    latest_followup_date: crmMetric?.latest_followup_date,
    next_action_date: crmMetric?.next_action_date,
    identity_conflict: crmMetric?.identity_conflict ?? false,
    data_unavailable: metricsUnavailable,
  }, new Date()) : null, [customer, lastTherapist, crmMetric, metricsUnavailable]);
  const availableCasts = useMemo(
    () => casts.filter((cast) => cast.is_active !== false && !therapistNgs.some((entry) => entry.cast_id === cast.id)),
    [casts, therapistNgs],
  );

  useEffect(() => {
    setMessageDraft(insight?.messageDraft ?? "");
  }, [insight?.messageDraft]);

  const copyMessageDraft = async () => {
    if (!messageDraft) return;
    await navigator.clipboard.writeText(messageDraft);
    toast.success("文面案をコピーしました");
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px]">
        <div className="container mx-auto px-4 py-6 max-w-3xl">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate("/database/customers")}>
            <ArrowLeft size={15} className="mr-1" />顧客一覧
          </Button>

          {loading ? (
            <div className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : !customer ? (
            <p className="text-center text-muted-foreground py-16">顧客が見つかりませんでした</p>
          ) : (
            <div className="space-y-5">
              {/* 顧客ヘッダー */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold flex items-center gap-2">
                          <User size={19} className="text-primary" />{customer.name} 様
                        </h1>
                        {rank && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rank.className}`}>{rank.label}</span>
                        )}
                        {customer.is_banned && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⛔ 出入り禁止</span>
                        )}
                        {(customer.tags ?? []).filter((t) => t !== "VIP").map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                        ))}
                      </div>
                      {customer.phone && (
                        <a href={`tel:${customer.phone.replace(/\D/g, "")}`} className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5 hover:underline">
                          <Phone size={13} />{customer.phone}
                        </a>
                      )}
                      {customer.is_banned && customer.ban_reason && (
                        <p className="text-xs text-red-600 mt-1">禁止理由：{customer.ban_reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
                      <p className="text-[11px] text-muted-foreground">来店回数</p>
                      <p className="text-lg font-bold">{customer.visit_count ?? 0}<span className="text-xs font-normal">回</span></p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
                      <p className="text-[11px] text-muted-foreground">累計利用額</p>
                      <p className="text-lg font-bold">¥{(customer.total_spent ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
                      <p className="text-[11px] text-muted-foreground">平均利用額</p>
                      <p className="text-lg font-bold">{insight?.averageSpend != null ? `¥${insight.averageSpend.toLocaleString()}` : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
                      <p className="text-[11px] text-muted-foreground">最終来店</p>
                      <p className="text-lg font-bold">
                        {customer.last_visited ? format(new Date(customer.last_visited), "M/d") : "—"}
                      </p>
                    </div>
                  </div>
                  {customer.notes && (
                    <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded-lg px-3 py-2">管理メモ：{customer.notes}</p>
                  )}
                </CardContent>
              </Card>

              {/* CRM提案 */}
              {insight && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <Lightbulb size={17} className="text-amber-500" />フォローアプローチ提案
                      <span className="text-[11px] font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5">
                        {insight.stage}
                      </span>
                      <span className="text-[11px] font-semibold rounded-full bg-muted px-2 py-0.5">
                        優先度：{insight.salesPriority}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-semibold">{insight.approachTitle}</p>
                      <p className="text-sm mt-1">{insight.staffAction}</p>
                    </div>
                    <div className="rounded-lg bg-muted/35 px-3 py-2.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">判定根拠</p>
                      <ul className="text-xs space-y-1 list-disc pl-4">
                        {insight.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </div>
                    {insight.messageDraft && (
                      <div className="rounded-lg border px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-xs font-semibold text-muted-foreground">連絡文面案</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={copyMessageDraft}
                            disabled={!messageDraft}
                          >
                            <Copy size={12} className="mr-1" />コピー
                          </Button>
                        </div>
                        <Textarea
                          value={messageDraft}
                          onChange={(event) => setMessageDraft(event.target.value)}
                          rows={4}
                          className="text-sm resize-y"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* セラピストNG */}
              <Card className="border-red-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert size={17} className="text-red-500" />セラピストNG
                    {therapistNgs.length > 0 && (
                      <span className="text-xs font-normal rounded-full bg-red-50 text-red-700 px-2 py-0.5">
                        {therapistNgs.length}名
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    この顧客を担当させないセラピストを登録します。予約登録時にも警告が表示されます。
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {therapistNgs.length > 0 ? (
                    <div className="space-y-2">
                      {therapistNgs.map((entry) => {
                        const cast = casts.find((item) => item.id === entry.cast_id);
                        return (
                          <div key={entry.id} className="rounded-lg border border-red-100 bg-red-50/40 px-3 py-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold">{cast?.name ?? "セラピスト情報なし"}</p>
                                {cast?.is_active === false && (
                                  <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">在籍外</span>
                                )}
                              </div>
                              <p className="text-sm mt-1 whitespace-pre-wrap break-words">理由：{entry.reason || "未記入"}</p>
                              {entry.created_at && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  登録日：{format(new Date(entry.created_at), "yyyy/M/d")}
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 shrink-0 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                              disabled={removingNgId === entry.id}
                              onClick={() => handleRemoveTherapistNg(entry)}
                            >
                              {removingNgId === entry.id ? (
                                <Loader2 size={13} className="mr-1 animate-spin" />
                              ) : (
                                <Trash2 size={13} className="mr-1" />
                              )}
                              解除
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground rounded-lg bg-muted/30 px-3 py-3">登録されているセラピストNGはありません</p>
                  )}

                  <div className="rounded-lg border px-3 py-3 space-y-3">
                    <p className="text-sm font-semibold">NGセラピストを追加</p>
                    <div>
                      <Label className="text-xs">対象セラピスト</Label>
                      <Select value={ngCastId} onValueChange={setNgCastId} disabled={availableCasts.length === 0 || ngSaving}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={availableCasts.length === 0 ? "登録できるセラピストがいません" : "セラピストを選択"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCasts.map((cast) => <SelectItem key={cast.id} value={cast.id}>{cast.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">理由 <span className="text-red-600">必須</span></Label>
                      <Textarea
                        value={ngReason}
                        onChange={(event) => setNgReason(event.target.value)}
                        placeholder="例：セラピストへの嫌がらせ行為があったため"
                        rows={3}
                        maxLength={500}
                        disabled={ngSaving}
                        className="mt-1"
                      />
                      <p className="text-[11px] text-muted-foreground text-right mt-1">{ngReason.length}/500</p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleAddTherapistNg}
                      disabled={ngSaving || !ngCastId || !ngReason.trim()}
                      className="w-full sm:w-auto"
                    >
                      {ngSaving ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <ShieldAlert size={15} className="mr-1.5" />}
                      NG登録する
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 好み（カルテ） */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart size={16} className="text-rose-500" />お客様の好み
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">圧の好み</Label>
                      <Select
                        value={profile.preferred_pressure ?? "unset"}
                        onValueChange={(v) => setProfile({ ...profile, preferred_pressure: v === "unset" ? null : v })}
                      >
                        <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="未設定" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">未設定</SelectItem>
                          {PRESSURE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">会話の好み</Label>
                      <Select
                        value={profile.conversation_level ?? "unset"}
                        onValueChange={(v) => setProfile({ ...profile, conversation_level: v === "unset" ? null : v })}
                      >
                        <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="未設定" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">未設定</SelectItem>
                          {CONVERSATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">気になる部位</Label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1.5">
                      {AREA_OPTIONS.map((area) => (
                        <label key={area} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={(profile.concern_areas ?? []).includes(area)}
                            onCheckedChange={() => toggleArea(area)}
                          />
                          <span className="text-sm">{area}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">NG・アレルギー</Label>
                    <Textarea
                      value={profile.ng_items ?? ""}
                      onChange={(e) => setProfile({ ...profile, ng_items: e.target.value || null })}
                      placeholder="例：強圧NG、オイルアレルギーあり"
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">好みメモ</Label>
                    <Textarea
                      value={profile.preference_notes ?? ""}
                      onChange={(e) => setProfile({ ...profile, preference_notes: e.target.value || null })}
                      placeholder="会話の話題、施術の好み、次回への引き継ぎなど"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
                    {saving ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Save size={15} className="mr-1.5" />}
                    好みを保存
                  </Button>
                </CardContent>
              </Card>

              {/* 来店履歴（全件） */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History size={16} className="text-primary" />来店履歴
                    <span className="text-xs font-normal text-muted-foreground">
                      完了{completedVisits.length}件／全{visits.length}件
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {visitsLoading ? (
                    <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>
                  ) : visits.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">来店履歴がありません</p>
                  ) : (
                    <div className="divide-y">
                      {visits.map((v) => {
                        const badge = STATUS_BADGE[v.status] ?? { label: v.status, cls: "bg-gray-100 text-gray-600" };
                        return (
                          <div key={v.id} className="py-2.5 flex items-start gap-3">
                            <div className="w-20 shrink-0">
                              <p className="text-sm font-semibold tabular-nums">
                                {format(new Date(`${v.reservation_date}T00:00:00`), "yy/M/d", { locale: ja })}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {format(new Date(`${v.reservation_date}T00:00:00`), "(E)", { locale: ja })} {v.start_time}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm break-words">
                                {v.course_name ?? "コース未設定"}
                                {v.cast_name && <span className="text-muted-foreground"> 担当：{v.cast_name}</span>}
                              </p>
                              <p className="text-xs text-muted-foreground break-words">
                                {v.nomination_type ? `${v.nomination_type}` : ""}
                                {v.options && v.options.length > 0 ? `${v.nomination_type ? " ・ " : ""}${v.options.join("、")}` : ""}
                              </p>
                              {v.notes && <p className="text-[11px] text-muted-foreground break-words whitespace-pre-wrap">📝 {v.notes}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold tabular-nums">¥{(v.price ?? 0).toLocaleString()}</p>
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
