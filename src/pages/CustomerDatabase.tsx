import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  NotionDatabaseView,
  type DatabaseSortOption,
} from "@/components/database/NotionDatabaseView";
import type { Property, DatabaseRecord } from "@/components/database/types";
import { toast } from "sonner";
import { isValidEmail } from "@/lib/email";
import { postToSheet } from "@/lib/sheetWebhook";
import { ImportModal } from "@/components/ImportModal";
import { FileUp, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleSheetPanel } from "@/components/GoogleSheetPanel";
import { mapCustomerRows, batchInsert } from "@/lib/importMappers";
import { CustomerPreferencesTab } from "@/components/customers/CustomerPreferencesTab";
import { CustomerSalesTab } from "@/components/customers/CustomerSalesTab";
import { getCustomerRank } from "@/lib/customerRank";
import { getCustomerInsights } from "@/lib/customerInsights";

const PAGE_SIZE = 1_000;
const METRICS_BATCH_SIZE = 200;

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visit_count: number | null;
  total_spent: number | null;
  last_visited: string | null;
  last_cast_id: string | null;
  tags: string[] | null;
  notes: string | null;
  is_banned: boolean | null;
}

interface CustomerCrmMetric {
  customer_id: string;
  median_visit_interval_days: number | null;
  future_booking_date: string | null;
  cancellation_rate: number | null;
  favorite_course: string | null;
  completed_visits_365d: number | null;
  spend_365d: number | null;
  latest_followup_date: string | null;
  next_action_date: string | null;
  identity_conflict: boolean | null;
}

const DEFAULT_PROPERTIES: Property[] = [
  { id: "name", name: "名前", type: "text", width: 140 },
  { id: "phone", name: "電話番号", type: "phone", width: 140, readOnly: true, allowOnCreate: true },
  {
    id: "phone_status",
    name: "電話番号確認",
    type: "select",
    width: 115,
    readOnly: true,
    options: [{ label: "重複要確認", color: "red" }],
  },
  { id: "last_visited", name: "最終来店日", type: "date", width: 115, readOnly: true },
  { id: "visit_count", name: "来店回数", type: "number", width: 95, readOnly: true },
  { id: "total_spent", name: "累計利用額", type: "number", width: 115, readOnly: true, format: "currency" },
  { id: "average_spend", name: "平均利用額", type: "number", width: 115, readOnly: true, format: "currency" },
  { id: "days_since_last_visit", name: "最終来店から", type: "number", width: 110, readOnly: true, format: "days" },
  {
    id: "sales_priority",
    name: "フォロー優先度",
    type: "select",
    width: 110,
    readOnly: true,
    options: [
      { label: "要確認", color: "red" },
      { label: "高", color: "orange" },
      { label: "中", color: "yellow" },
      { label: "低", color: "green" },
      { label: "保留", color: "gray" },
      { label: "営業不要", color: "blue" },
      { label: "連絡停止", color: "red" },
    ],
  },
  { id: "recommended_action", name: "おすすめ対応", type: "text", width: 240, readOnly: true },
  { id: "last_therapist", name: "前回セラピスト", type: "text", width: 130, readOnly: true },
  { id: "favorite_course", name: "よく使うコース", type: "text", width: 160, readOnly: true, hidden: true },
  { id: "predicted_next_visit", name: "予測来店日", type: "date", width: 115, readOnly: true, hidden: true },
  {
    id: "customer_rank",
    name: "顧客ランク",
    type: "select",
    width: 105,
    readOnly: true,
    hidden: true,
    options: [
      { label: "VIP", color: "purple" },
      { label: "常連", color: "blue" },
      { label: "リピーター", color: "green" },
      { label: "新規", color: "gray" },
    ],
  },
  { id: "crm_stage", name: "顧客ステージ", type: "text", width: 120, readOnly: true, hidden: true },
  {
    id: "tags",
    name: "タグ",
    type: "multi_select",
    width: 180,
    options: [
      { label: "VIP", color: "purple" },
      { label: "常連", color: "blue" },
      { label: "新規", color: "green" },
      { label: "要注意", color: "red" },
      { label: "営業NG", color: "red" },
      { label: "紹介", color: "orange" },
    ],
  },
  { id: "notes", name: "メモ", type: "text", width: 200 },
];

const SORT_OPTIONS: DatabaseSortOption[] = [
  { label: "最終来店日（新しい順）", field: "last_visited", dir: "desc" },
  { label: "最終来店日（古い順）", field: "last_visited", dir: "asc" },
  { label: "来店回数（多い順）", field: "visit_count", dir: "desc" },
  { label: "来店回数（少ない順）", field: "visit_count", dir: "asc" },
  { label: "累計利用額（高い順）", field: "total_spent", dir: "desc" },
  { label: "累計利用額（低い順）", field: "total_spent", dir: "asc" },
  { label: "平均利用額（高い順）", field: "average_spend", dir: "desc" },
  { label: "未訪問期間（長い順）", field: "days_since_last_visit", dir: "desc" },
  { label: "フォロー優先度（高い順）", field: "sales_priority_score", dir: "desc" },
];

const EDITABLE_FIELDS = new Set(["name", "email", "tags", "notes"]);

async function fetchAllCustomers(storeId: string): Promise<CustomerRow[]> {
  const rows: CustomerRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, visit_count, total_spent, last_visited, last_cast_id, tags, notes, is_banned")
      .eq("store_id", storeId)
      .order("last_visited", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as CustomerRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchCustomerMetrics(customerIds: string[]): Promise<CustomerCrmMetric[]> {
  const batches: string[][] = [];
  for (let i = 0; i < customerIds.length; i += METRICS_BATCH_SIZE) {
    batches.push(customerIds.slice(i, i + METRICS_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (ids) => {
      const { data, error } = await supabase.rpc("get_customer_crm_metrics", {
        p_customer_ids: ids,
      });
      if (error) throw error;
      return (data || []) as unknown as CustomerCrmMetric[];
    }),
  );
  return results.flat();
}

function mapToRecord(
  row: CustomerRow,
  metric: CustomerCrmMetric | undefined,
  castNames: Map<string, string>,
  referenceDate: Date,
  hasDuplicatePhone: boolean,
  metricsUnavailable: boolean,
): DatabaseRecord {
  const lastTherapist = row.last_cast_id ? castNames.get(row.last_cast_id) ?? null : null;
  const insight = getCustomerInsights(
    {
      ...row,
      last_therapist: lastTherapist,
      favorite_course: metric?.favorite_course,
      median_visit_interval_days: metric?.median_visit_interval_days,
      future_booking_date: metric?.future_booking_date,
      cancellation_rate: metric?.cancellation_rate,
      latest_followup_date: metric?.latest_followup_date,
      next_action_date: metric?.next_action_date,
      identity_conflict: hasDuplicatePhone || metric?.identity_conflict === true,
      data_unavailable: metricsUnavailable || !metric,
    },
    referenceDate,
  );

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    phone_status: hasDuplicatePhone ? "重複要確認" : null,
    email: row.email,
    visit_count: row.visit_count ?? 0,
    total_spent: row.total_spent ?? 0,
    last_visited: row.last_visited,
    average_spend: insight.averageSpend,
    days_since_last_visit: insight.daysSinceLastVisit,
    predicted_next_visit: insight.predictedNextVisitDate,
    customer_rank: getCustomerRank(row).label,
    crm_stage: insight.stage,
    sales_priority: insight.salesPriority,
    sales_priority_score: insight.salesPriorityScore,
    recommended_action: insight.approachTitle,
    last_therapist: lastTherapist,
    favorite_course: metric?.favorite_course ?? null,
    tags: row.tags,
    notes: row.notes,
    is_banned: row.is_banned,
  };
}

export default function CustomerDatabase() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [metricsUnavailable, setMetricsUnavailable] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = ["preferences", "sales", "sheet"].includes(tabParam || "") ? tabParam! : "db";

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const fetchCustomers = useCallback(async () => {
    if (!user || storeLoading) return;
    setLoading(true);
    try {
      const [customers, castResult] = await Promise.all([
        fetchAllCustomers(storeId),
        supabase.from("casts").select("id, name").eq("store_id", storeId).limit(2_000),
      ]);
      if (castResult.error) throw castResult.error;

      let metrics: CustomerCrmMetric[] = [];
      let metricFetchFailed = false;
      try {
        metrics = await fetchCustomerMetrics(customers.map((customer) => customer.id));
      } catch (metricError) {
        console.warn("CRM metric fetch failed; suppressing outreach suggestions", metricError);
        metricFetchFailed = true;
      }
      setMetricsUnavailable(metricFetchFailed);

      const metricMap = new Map(metrics.map((metric) => [metric.customer_id, metric]));
      const castNames = new Map((castResult.data || []).map((cast) => [cast.id, cast.name]));
      const phoneCounts = new Map<string, number>();
      for (const customer of customers) {
        const normalizedPhone = customer.phone.replace(/\D/g, "");
        if (normalizedPhone) phoneCounts.set(normalizedPhone, (phoneCounts.get(normalizedPhone) ?? 0) + 1);
      }
      const referenceDate = new Date();
      setRecords(customers.map((row) => {
        const normalizedPhone = row.phone.replace(/\D/g, "");
        return mapToRecord(
          row,
          metricMap.get(row.id),
          castNames,
          referenceDate,
          Boolean(normalizedPhone && (phoneCounts.get(normalizedPhone) ?? 0) > 1),
          metricFetchFailed,
        );
      }));
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("顧客データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [storeId, storeLoading, user]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const crmSummary = useMemo(() => ({
    total: records.length,
    priority: records.filter((record) => ["要確認", "高"].includes(String(record.sales_priority))).length,
    booked: records.filter((record) => record.crm_stage === "次回予約済み").length,
    stopped: records.filter((record) => record.sales_priority === "連絡停止").length,
  }), [records]);

  const handleAdd = async (data: Record<string, unknown>) => {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const notes = typeof data.notes === "string" ? data.notes : null;
    const email = typeof data.email === "string" ? data.email : null;
    const tags = Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === "string")
      : null;
    if (!name || !phone) {
      toast.error("名前と電話番号を入力してください");
      return;
    }
    if (email?.trim() && !isValidEmail(email)) {
      toast.error("メールアドレスの形式が正しくありません（例: example@email.com）");
      return;
    }
    try {
      const { error } = await supabase.from("customers").insert([{
        name,
        phone,
        notes,
        tags,
        email,
        store_id: storeId,
      }]);
      if (error) throw error;
      postToSheet("customer", {
        name,
        phone,
        email: email ?? "",
        tags: tags?.join(",") ?? "",
        notes: notes ?? "",
        created_at: new Date().toISOString(),
      });
      toast.success("追加しました");
      await fetchCustomers();
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error("追加に失敗しました");
      throw error;
    }
  };

  const handleUpdate = async (id: string, field: string, value: unknown) => {
    if (!EDITABLE_FIELDS.has(field)) {
      toast.error("この項目は来店履歴から自動計算されます");
      return;
    }
    if (field === "email" && typeof value === "string" && value.trim() && !isValidEmail(value)) {
      toast.error("メールアドレスの形式が正しくありません（例: example@email.com）");
      return;
    }
    try {
      const updateValue = field === "tags"
        ? (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null)
        : (typeof value === "string" ? value : null);
      const { error } = await supabase
        .from("customers")
        .update({ [field]: updateValue })
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw error;
      await fetchCustomers();
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("更新に失敗しました");
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw error;
      toast.success("削除しました");
      setRecords((prev) => prev.filter((record) => record.id !== id));
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("削除に失敗しました");
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 sm:p-6 flex flex-col" style={{ height: "100vh" }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">顧客一覧</h1>
            <p className="text-muted-foreground text-sm">初期表示は最終来店日の新しい順・列設定から表示項目を変更できます</p>
          </div>
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="shrink-0">
            <FileUp size={16} className="mr-2" /><span className="hidden sm:inline">CSV</span>インポート
          </Button>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setSearchParams(value === "db" ? {} : { tab: value }, { replace: true })}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mb-3 shrink-0 w-full sm:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="db">データベース</TabsTrigger>
            <TabsTrigger value="preferences">好み</TabsTrigger>
            <TabsTrigger value="sales">営業</TabsTrigger>
            <TabsTrigger value="sheet" className="gap-1.5">
              <Table2 size={13} />Googleスプレッドシート
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preferences" className="flex-1 overflow-hidden mt-0">
            <CustomerPreferencesTab />
          </TabsContent>
          <TabsContent value="sales" className="flex-1 overflow-hidden mt-0">
            <CustomerSalesTab />
          </TabsContent>
          <TabsContent value="sheet" className="mt-0">
            <GoogleSheetPanel
              source="customers"
              onImport={async (headers, rows) => {
                const mapped = mapCustomerRows(headers, rows).map((row) => ({ ...row, store_id: storeId }));
                const count = await batchInsert("customers", mapped);
                await fetchCustomers();
                return count;
              }}
            />
          </TabsContent>
          <TabsContent value="db" className="flex-1 overflow-hidden mt-0">
            <div className="h-full flex flex-col gap-3">
              {metricsUnavailable && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  予約・CRM指標を取得できないため、誤連絡防止のためフォロー提案を停止しています。再読み込みしてください。
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
                {[
                  ["全顧客", crmSummary.total],
                  ["フォロー候補（高以上）", crmSummary.priority],
                  ["次回予約済み", crmSummary.booked],
                  ["営業連絡停止", crmSummary.stopped],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border bg-card px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="font-bold tabular-nums">{loading ? "—" : `${value}件`}</p>
                  </div>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                <NotionDatabaseView
                  title="顧客"
                  storageKey="customers"
                  defaultProperties={DEFAULT_PROPERTIES}
                  records={records}
                  loading={loading}
                  defaultSort={{ field: "last_visited", dir: "desc" }}
                  sortOptions={SORT_OPTIONS}
                  onAddRecord={handleAdd}
                  onUpdateRecord={handleUpdate}
                  onDeleteRecord={handleDelete}
                  onOpenRecord={(record) => navigate(`/database/customers/${record.id}`)}
                  openRecordLabel="顧客カルテ・提案を開く"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <ImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="customers"
        storeId={storeId}
        onSuccess={fetchCustomers}
      />
    </div>
  );
}
