import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, Phone, Crown, Clock, Lightbulb, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCustomerRank, FOLLOWUP_METHODS } from "@/lib/customerRank";
import { getCustomerInsights } from "@/lib/customerInsights";
import type { ProfileData } from "./CustomerPreferencesTab";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  visit_count: number | null;
  total_spent: number | null;
  last_visited: string | null;
  last_cast_id: string | null;
  tags: string[] | null;
  notes: string | null;
  is_banned: boolean | null;
}

interface Followup {
  id: string;
  customer_id: string;
  followup_date: string;
  method: string | null;
  content: string | null;
  next_action_date: string | null;
  completed_at: string | null;
}

interface VisitRow {
  reservation_date: string;
  course_name: string;
  price: number;
  cast_id?: string | null;
  cast_name?: string | null;
  status: string;
}

interface CrmMetric {
  customer_id: string;
  median_visit_interval_days: number | null;
  future_booking_date: string | null;
  cancellation_rate: number | null;
  favorite_course: string | null;
  latest_followup_date: string | null;
  next_action_date: string | null;
  identity_conflict: boolean | null;
}

type SortKey = "lastVisited" | "visits" | "spent" | "average" | "priority";

type Filter = "all" | "inactive30" | "inactive60" | "vip" | "nextAction";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "inactive30", label: "30日以上来店なし" },
  { key: "inactive60", label: "60日以上来店なし" },
  { key: "vip", label: "VIP" },
  { key: "nextAction", label: "次回アクションあり" },
];

const SALES_SORTS: { key: SortKey; label: string }[] = [
  { key: "lastVisited", label: "最終来店日（新しい順）" },
  { key: "priority", label: "フォロー優先度（高い順）" },
  { key: "visits", label: "来店回数（多い順）" },
  { key: "spent", label: "累計利用額（高い順）" },
  { key: "average", label: "平均利用額（高い順）" },
];

async function fetchEveryCustomer(storeId: string): Promise<CustomerRow[]> {
  const result: CustomerRow[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, visit_count, total_spent, last_visited, last_cast_id, tags, notes, is_banned")
      .eq("store_id", storeId)
      .order("last_visited", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const page = (data || []) as CustomerRow[];
    result.push(...page);
    if (page.length < 1_000) break;
  }
  return result;
}

async function fetchMetrics(customerIds: string[]): Promise<CrmMetric[]> {
  const requests: Promise<CrmMetric[]>[] = [];
  for (let from = 0; from < customerIds.length; from += 200) {
    const ids = customerIds.slice(from, from + 200);
    requests.push((async () => {
      const { data, error } = await supabase.rpc("get_customer_crm_metrics", { p_customer_ids: ids });
      if (error) throw error;
      return (data || []) as unknown as CrmMetric[];
    })());
  }
  return (await Promise.all(requests)).flat();
}

async function fetchEveryProfile(storeId: string): Promise<(ProfileData & { customer_id: string })[]> {
  const result: (ProfileData & { customer_id: string })[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("customer_id, preferred_pressure, concern_areas, conversation_level, ng_items, preference_notes")
      .eq("store_id", storeId)
      .order("customer_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const page = (data || []) as (ProfileData & { customer_id: string })[];
    result.push(...page);
    if (page.length < 1_000) break;
  }
  return result;
}

async function fetchEveryFollowup(storeId: string): Promise<Followup[]> {
  const result: Followup[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("customer_followups")
      .select("id, customer_id, followup_date, method, content, next_action_date, completed_at")
      .eq("store_id", storeId)
      .order("followup_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const page = (data || []) as Followup[];
    result.push(...page);
    if (page.length < 1_000) break;
  }
  return result;
}

export function CustomerSalesTab() {
  const { storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileData>>(new Map());
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [castNames, setCastNames] = useState<Map<string, string>>(new Map());
  const [metrics, setMetrics] = useState<Map<string, CrmMetric>>(new Map());
  const [metricsUnavailable, setMetricsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastVisited");

  // Karte dialog
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [fuForm, setFuForm] = useState({ followup_date: format(new Date(), "yyyy-MM-dd"), method: "電話", content: "", next_action_date: "" });
  const [saving, setSaving] = useState(false);
  const visitRequestId = useRef(0);

  const fetchData = useCallback(async () => {
    if (storeLoading) return;
    setLoading(true);
    try {
      const customerRows = await fetchEveryCustomer(storeId);
      let metricFetchFailed = false;
      const [metricRows, profileRows, followupRows, castRes] = await Promise.all([
        fetchMetrics(customerRows.map((customer) => customer.id)).catch((error) => {
          console.warn("CRM metrics unavailable; suppressing outreach suggestions", error);
          metricFetchFailed = true;
          return [] as CrmMetric[];
        }),
        fetchEveryProfile(storeId),
        fetchEveryFollowup(storeId),
        supabase.from("casts").select("id, name").eq("store_id", storeId),
      ]);
      if (castRes.error) throw castRes.error;
      setCustomers(customerRows);
      const pmap = new Map<string, ProfileData>();
      for (const profile of profileRows) pmap.set(profile.customer_id, profile);
      setProfiles(pmap);
      setFollowups(followupRows);
      setCastNames(new Map((castRes.data || []).map((c) => [c.id, c.name])));
      setMetrics(new Map(metricRows.map((metric) => [metric.customer_id, metric])));
      setMetricsUnavailable(metricFetchFailed);
    } catch (e) {
      console.error(e);
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [storeId, storeLoading]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const latestFollowup = useMemo(() => {
    const map = new Map<string, Followup>();
    for (const f of followups) {
      const current = map.get(f.customer_id);
      if (
        !current
        || f.followup_date > current.followup_date
        || (f.followup_date === current.followup_date && f.id > current.id)
      ) {
        map.set(f.customer_id, f);
      }
    }
    return map;
  }, [followups]);

  const pendingAction = useMemo(() => {
    const map = new Map<string, Followup>();
    for (const followup of followups) {
      if (!followup.next_action_date || followup.completed_at) continue;
      const current = map.get(followup.customer_id);
      if (!current || followup.next_action_date < (current.next_action_date ?? "9999-12-31")) {
        map.set(followup.customer_id, followup);
      }
    }
    return map;
  }, [followups]);

  const duplicatePhones = useMemo(() => {
    const counts = new Map<string, number>();
    for (const customer of customers) {
      const phone = customer.phone.replace(/\D/g, "");
      if (phone) counts.set(phone, (counts.get(phone) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([phone]) => phone),
    );
  }, [customers]);

  const insights = useMemo(() => {
    const result = new Map<string, ReturnType<typeof getCustomerInsights>>();
    const referenceDate = new Date();
    for (const customer of customers) {
      const metric = metrics.get(customer.id);
      const followup = latestFollowup.get(customer.id);
      const action = pendingAction.get(customer.id);
      result.set(customer.id, getCustomerInsights({
        ...customer,
        last_therapist: customer.last_cast_id ? castNames.get(customer.last_cast_id) : null,
        favorite_course: metric?.favorite_course,
        median_visit_interval_days: metric?.median_visit_interval_days,
        future_booking_date: metric?.future_booking_date,
        cancellation_rate: metric?.cancellation_rate,
        latest_followup_date: followup?.followup_date ?? metric?.latest_followup_date,
        next_action_date: action?.next_action_date ?? metric?.next_action_date,
        identity_conflict: metric?.identity_conflict === true
          || duplicatePhones.has(customer.phone.replace(/\D/g, "")),
        data_unavailable: metricsUnavailable || !metric,
      }, referenceDate));
    }
    return result;
  }, [customers, metrics, latestFollowup, pendingAction, castNames, duplicatePhones, metricsUnavailable]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digitQuery = q.replace(/\D/g, "");
    let list = customers;
    if (q) {
      list = list.filter(
        (c) => c.name?.toLowerCase().includes(q)
          || (digitQuery.length > 0 && c.phone?.replace(/\D/g, "").includes(digitQuery)),
      );
    }
    switch (filter) {
      case "inactive30":
        list = list.filter((c) => (insights.get(c.id)?.daysSinceLastVisit ?? Infinity) >= 30 && c.last_visited);
        break;
      case "inactive60":
        list = list.filter((c) => (insights.get(c.id)?.daysSinceLastVisit ?? Infinity) >= 60 && c.last_visited);
        break;
      case "vip":
        list = list.filter((c) => getCustomerRank(c).label === "VIP");
        break;
      case "nextAction":
        list = list.filter((c) => pendingAction.has(c.id));
        break;
    }
    return [...list].sort((a, b) => {
      const aInsight = insights.get(a.id);
      const bInsight = insights.get(b.id);
      switch (sortKey) {
        case "visits":
          return (b.visit_count ?? 0) - (a.visit_count ?? 0);
        case "spent":
          return (b.total_spent ?? 0) - (a.total_spent ?? 0);
        case "average":
          return (bInsight?.averageSpend ?? -1) - (aInsight?.averageSpend ?? -1);
        case "priority":
          return (bInsight?.salesPriorityScore ?? -1) - (aInsight?.salesPriorityScore ?? -1);
        default:
          return (b.last_visited ?? "").localeCompare(a.last_visited ?? "") || a.id.localeCompare(b.id);
      }
    });
  }, [customers, search, filter, pendingAction, insights, sortKey]);

  const openKarte = async (c: CustomerRow) => {
    const requestId = ++visitRequestId.current;
    setSelected(c);
    setFuForm({ followup_date: format(new Date(), "yyyy-MM-dd"), method: "電話", content: "", next_action_date: "" });
    setVisitsLoading(true);
    const { data, error } = await supabase.rpc("get_customer_reservations", {
      p_customer_id: c.id,
    });
    if (requestId !== visitRequestId.current) return;
    if (error) toast.error("来店履歴の取得に失敗しました");
    setVisits(((data || []) as unknown as VisitRow[]).filter((visit) => visit.status !== "cancelled").slice(0, 10));
    setVisitsLoading(false);
  };

  const handleAddFollowup = async () => {
    if (!selected || !fuForm.content.trim()) {
      toast.error("内容を入力してください");
      return;
    }
    if (fuForm.followup_date > format(new Date(), "yyyy-MM-dd")) {
      toast.error("フォロー日には未来日を指定できません");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("customer_followups")
        .insert({
          customer_id: selected.id,
          store_id: storeId,
          followup_date: fuForm.followup_date,
          method: fuForm.method,
          content: fuForm.content.trim(),
          next_action_date: fuForm.next_action_date || null,
          completed_at: null,
          created_by: userData.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      setFollowups((prev) => [data as Followup, ...prev]);
      setFuForm({ followup_date: format(new Date(), "yyyy-MM-dd"), method: "電話", content: "", next_action_date: "" });
      toast.success("フォロー履歴を追加しました");
    } catch (e) {
      console.error(e);
      toast.error("追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteFollowup = async (followupId: string) => {
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("customer_followups")
      .update({ completed_at: completedAt })
      .eq("id", followupId)
      .eq("store_id", storeId);
    if (error) {
      toast.error("アクション完了の更新に失敗しました");
      return;
    }
    setFollowups((current) => current.map((followup) => (
      followup.id === followupId ? { ...followup, completed_at: completedAt } : followup
    )));
    toast.success("次回アクションを完了にしました");
  };

  const toggleVip = async () => {
    if (!selected) return;
    const tags = selected.tags ?? [];
    const next = tags.includes("VIP") ? tags.filter((t) => t !== "VIP") : [...tags, "VIP"];
    const { error } = await supabase
      .from("customers")
      .update({ tags: next })
      .eq("id", selected.id)
      .eq("store_id", storeId);
    if (error) {
      toast.error("更新に失敗しました");
      return;
    }
    const updated = { ...selected, tags: next };
    setSelected(updated);
    setCustomers((prev) => prev.map((c) => (c.id === selected.id ? updated : c)));
  };

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>;
  }

  const selectedProfile = selected ? profiles.get(selected.id) : null;
  const selectedFollowups = selected ? followups.filter((f) => f.customer_id === selected.id) : [];
  const selectedInsight = selected ? insights.get(selected.id) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="名前・電話番号で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-full border transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted/50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
          <SelectTrigger className="h-9 w-full sm:w-[210px] text-xs" aria-label="営業一覧の並び順">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SALES_SORTS.map((option) => (
              <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {metricsUnavailable && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          予約・CRM指標を取得できないため、誤連絡防止のためフォロー提案を停止しています。再読み込みしてください。
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="sticky left-0 z-20 bg-muted px-3 py-2 font-medium">名前</th>
              <th className="px-3 py-2 font-medium">ランク</th>
              <th className="px-3 py-2 font-medium">優先度</th>
              <th className="px-3 py-2 font-medium text-right">来店回数</th>
              <th className="px-3 py-2 font-medium text-right">累計利用額</th>
              <th className="px-3 py-2 font-medium">最終来店</th>
              <th className="px-3 py-2 font-medium text-right">経過日数</th>
              <th className="px-3 py-2 font-medium">前回担当</th>
              <th className="px-3 py-2 font-medium">最終フォロー</th>
              <th className="px-3 py-2 font-medium">次回アクション</th>
              <th className="px-3 py-2 font-medium">おすすめ対応</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((c) => {
              const rank = getCustomerRank(c);
              const insight = insights.get(c.id);
              const days = insight?.daysSinceLastVisit ?? null;
              const fu = latestFollowup.get(c.id);
              const action = pendingAction.get(c.id);
              return (
                <tr key={c.id} className="group cursor-pointer hover:bg-muted/40" onClick={() => openKarte(c)}>
                  <td className="sticky left-0 z-[5] bg-background px-3 py-2 font-medium whitespace-nowrap group-hover:bg-muted">
                    {c.name}
                    {c.is_banned && <span className="ml-1.5 text-[10px] text-red-600 font-bold">⛔出禁</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", rank.className)}>
                      {rank.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      insight?.salesPriority === "要確認" || insight?.salesPriority === "高"
                        ? "bg-rose-100 text-rose-700"
                        : insight?.salesPriority === "中"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-muted text-muted-foreground",
                    )}>
                      {insight?.salesPriority ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{c.visit_count ?? 0}回</td>
                  <td className="px-3 py-2 text-right">¥{(c.total_spent ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {c.last_visited ? format(new Date(c.last_visited), "yyyy/M/d", { locale: ja }) : "—"}
                  </td>
                  <td className={cn(
                    "px-3 py-2 text-right whitespace-nowrap font-medium",
                    days == null ? "text-muted-foreground" : days >= 60 ? "text-rose-600" : days >= 30 ? "text-amber-600" : "text-green-600",
                  )}>
                    {days != null ? `${days}日` : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.last_cast_id ? castNames.get(c.last_cast_id) ?? "—" : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {fu ? `${format(new Date(fu.followup_date), "M/d")} ${fu.method ?? ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {action?.next_action_date ? (
                      <span className="text-primary font-medium">{format(new Date(action.next_action_date), "M/d")}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 min-w-[220px] text-xs">
                    {insight?.approachTitle ?? "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">該当する顧客がいません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 顧客カルテダイアログ */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            visitRequestId.current += 1;
            setSelected(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {selected.name} さんのカルテ
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", getCustomerRank(selected).className)}>
                    {getCustomerRank(selected).label}
                  </span>
                  {selected.is_banned && <span className="text-xs text-red-600 font-bold">⛔出入り禁止</span>}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* 基本情報 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-[11px] text-muted-foreground">来店回数</p>
                    <p className="font-bold">{selected.visit_count ?? 0}回</p>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-[11px] text-muted-foreground">累計利用額</p>
                    <p className="font-bold">¥{(selected.total_spent ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-[11px] text-muted-foreground">最終来店</p>
                    <p className="font-bold">{selected.last_visited ? format(new Date(selected.last_visited), "M/d") : "—"}</p>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-[11px] text-muted-foreground">経過日数</p>
                    <p className="font-bold">
                      {selectedInsight?.daysSinceLastVisit ?? "—"}
                      {selectedInsight?.daysSinceLastVisit != null && "日"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone size={13} />{selected.phone}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={toggleVip}
                  >
                    <Crown size={12} className="mr-1 text-purple-500" />
                    {(selected.tags ?? []).includes("VIP") ? "VIP解除" : "VIPにする"}
                  </Button>
                </div>

                {selectedInsight && (
                  <div className="rounded-lg border border-primary/30 p-3 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Lightbulb size={15} className="text-amber-500" />
                      <p className="text-sm font-semibold">{selectedInsight.approachTitle}</p>
                      <span className="ml-auto text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">
                        優先度：{selectedInsight.salesPriority}
                      </span>
                    </div>
                    <p className="text-sm">{selectedInsight.staffAction}</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                      {selectedInsight.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                    {selectedInsight.messageDraft && (
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">連絡文面案</p>
                        <p className="text-xs whitespace-pre-wrap">{selectedInsight.messageDraft}</p>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => navigate(`/database/customers/${selected.id}`)}
                      >
                        <ExternalLink size={12} className="mr-1" />詳細カルテ
                      </Button>
                    </div>
                  </div>
                )}

                {/* 好み */}
                <div className="rounded-lg border p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">好み（電話ヒアリング）</p>
                  {selectedProfile ? (
                    <div className="text-sm space-y-1">
                      {selectedProfile.preferred_pressure && <p>圧：{selectedProfile.preferred_pressure}</p>}
                      {selectedProfile.concern_areas?.length ? <p>気になる部位：{selectedProfile.concern_areas.join("・")}</p> : null}
                      {selectedProfile.conversation_level && <p>会話：{selectedProfile.conversation_level}</p>}
                      {selectedProfile.ng_items && <p className="text-orange-600">NG：{selectedProfile.ng_items}</p>}
                      {selectedProfile.preference_notes && <p className="text-muted-foreground">{selectedProfile.preference_notes}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">未登録（「好み」タブから登録できます）</p>
                  )}
                  {selected.notes && (
                    <p className="text-xs text-muted-foreground pt-1 border-t mt-2">顧客メモ：{selected.notes}</p>
                  )}
                </div>

                {/* 来店履歴 */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Clock size={11} />来店履歴（直近10件）
                  </p>
                  {visitsLoading ? (
                    <div className="py-4 text-center"><Loader2 size={14} className="animate-spin text-primary mx-auto" /></div>
                  ) : visits.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">来店履歴がありません</p>
                  ) : (
                    <div className="rounded-lg border divide-y">
                      {visits.map((v, i) => (
                        <div key={i} className="px-3 py-2 flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {format(new Date(v.reservation_date), "yyyy/M/d(E)", { locale: ja })} {v.course_name}
                            {(v.cast_name || v.cast_id) && (
                              <span className="ml-1">／{v.cast_name ?? (v.cast_id ? castNames.get(v.cast_id) : "")}</span>
                            )}
                          </span>
                          <span className="font-medium">¥{v.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* フォロー履歴 */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">営業フォロー履歴</p>
                  <div className="rounded-lg border p-3 space-y-2.5 mb-2 bg-muted/20">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[11px]">日付</Label>
                        <Input
                          type="date"
                          value={fuForm.followup_date}
                          onChange={(e) => setFuForm({ ...fuForm, followup_date: e.target.value })}
                          className="mt-0.5 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">手段</Label>
                        <Select value={fuForm.method} onValueChange={(v) => setFuForm({ ...fuForm, method: v })}>
                          <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FOLLOWUP_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px]">次回アクション日</Label>
                        <Input
                          type="date"
                          value={fuForm.next_action_date}
                          onChange={(e) => setFuForm({ ...fuForm, next_action_date: e.target.value })}
                          className="mt-0.5 h-8 text-xs"
                        />
                      </div>
                    </div>
                    <Textarea
                      placeholder="例：誕生月クーポンの案内を送信。来週再連絡予定。"
                      value={fuForm.content}
                      onChange={(e) => setFuForm({ ...fuForm, content: e.target.value })}
                      rows={2}
                      className="text-sm"
                    />
                    <Button size="sm" onClick={handleAddFollowup} disabled={saving} className="w-full h-8">
                      {saving && <Loader2 size={12} className="mr-1.5 animate-spin" />}
                      フォロー履歴を追加
                    </Button>
                  </div>
                  {selectedFollowups.length > 0 && (
                    <div className="rounded-lg border divide-y">
                      {selectedFollowups.map((f) => (
                        <div key={f.id} className="px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{format(new Date(f.followup_date), "yyyy/M/d")}</span>
                            {f.method && <span className="bg-muted px-1.5 py-0.5 rounded">{f.method}</span>}
                            {f.next_action_date && (
                              <span className={f.completed_at ? "text-muted-foreground line-through" : "text-primary"}>
                                次回: {format(new Date(f.next_action_date), "M/d")}
                              </span>
                            )}
                            {f.next_action_date && !f.completed_at && (
                              <button
                                type="button"
                                className="ml-auto text-[11px] text-green-700 hover:underline"
                                onClick={() => handleCompleteFollowup(f.id)}
                              >
                                完了にする
                              </button>
                            )}
                          </div>
                          {f.content && <p className="mt-0.5">{f.content}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
