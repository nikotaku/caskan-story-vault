import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BarChart3, Plus, Loader2, Trash2, MessageCircle, Phone, HelpCircle } from "lucide-react";

/**
 * 問い合わせ集計：LINE bot・管理画面から記録した問い合わせ（電話/LINE/その他）と、
 * WEB予約（公開フォーム経由）とエステ魂のGmailデイリーレポートを
 * 月別・日別に集計する。表示はログイン店舗のデータのみ（RLSで自動分離）。
 */

interface InquiryRow {
  id: string;
  channel: "phone" | "line" | "other";
  memo: string | null;
  source: "line" | "manual";
  inquired_at: string;
}

interface ExternalDailyReport {
  report_date: string;
  page_views: number;
  inquiry_count: number;
}

interface HpDailyReport {
  date: string;
  page_views: number;
}

const CHANNEL_LABEL: Record<string, string> = { phone: "電話", line: "LINE", other: "その他" };

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const JST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const toJstDateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
};

const jstDateKeyMonthsAgo = (months: number) => {
  const nowJst = new Date(Date.now() + JST_OFFSET_MS);
  const targetMonth = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(nowJst.getUTCDate(), lastDay);
  return `${targetMonth.getUTCFullYear()}-${String(targetMonth.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const formatDateKeyShort = (dateKey: string) => {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
};

interface Counts { phone: number; line: number; other: number; web: number; estama: number; estamaViews: number; hpViews: number; }
const emptyCounts = (): Counts => ({ phone: 0, line: 0, other: 0, web: 0, estama: 0, estamaViews: 0, hpViews: 0 });
const total = (c: Counts) => c.phone + c.line + c.other + c.web + c.estama;

export default function InquiryStats() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [webDates, setWebDates] = useState<string[]>([]);
  const [externalReports, setExternalReports] = useState<ExternalDailyReport[]>([]);
  const [hpReports, setHpReports] = useState<HpDailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => toJstDateKey(new Date()).slice(0, 7));
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: toJstDateKey(new Date()),
    channel: "phone",
    memo: "",
  });

  const { user, loading: authLoading } = useAuth();
  const { store: adminStore, storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);
  useEffect(() => { document.title = "問い合わせ集計"; }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const fromDateKey = jstDateKeyMonthsAgo(12);
    const fromIso = new Date(`${fromDateKey}T00:00:00+09:00`).toISOString();

    try {
      const [inqRes, webRes, reportRes, hpRes] = await Promise.all([
        supabase
          .from("inquiries")
          .select("id, channel, memo, source, inquired_at")
          .eq("store_id", storeId)
          .gte("inquired_at", fromIso)
          .order("inquired_at", { ascending: false }),
        supabase
          .from("reservations")
          .select("created_at")
          .eq("store_id", storeId)
          .is("created_by", null)
          .gte("created_at", fromIso),
        supabase
          .from("external_daily_reports")
          .select("report_date, page_views, inquiry_count")
          .eq("store_id", storeId)
          .eq("provider", "estama")
          .gte("report_date", fromDateKey),
        supabase
          .from("hp_analytics_daily")
          .select("date, page_views")
          .eq("store_id", storeId)
          .gte("date", fromDateKey),
      ]);

      const queryErrors = [inqRes.error, webRes.error, reportRes.error, hpRes.error].filter(Boolean);
      if (queryErrors.length > 0) {
        console.error("問い合わせ集計データの取得に失敗しました", queryErrors);
        throw new Error("問い合わせ集計データの取得に失敗しました");
      }

      setInquiries((inqRes.data ?? []).map((row) => ({
        ...row,
        channel: row.channel as InquiryRow["channel"],
        source: row.source as InquiryRow["source"],
      })));
      setWebDates((webRes.data ?? []).map((r) => r.created_at));
      setExternalReports(reportRes.data ?? []);
      setHpReports(hpRes.data ?? []);
    } catch (error) {
      console.error(error);
      setInquiries([]);
      setWebDates([]);
      setExternalReports([]);
      setHpReports([]);
      toast.error("問い合わせ集計データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { if (user && !storeLoading) fetchData(); }, [user, storeLoading, fetchData]);

  // 月別集計（直近12ヶ月・降順）
  const monthly = useMemo(() => {
    const map = new Map<string, Counts>();
    const add = (key: string, ch: keyof Counts) => {
      if (!map.has(key)) map.set(key, emptyCounts());
      map.get(key)![ch]++;
    };
    const addAmount = (key: string, ch: keyof Counts, amount: number) => {
      if (!map.has(key)) map.set(key, emptyCounts());
      map.get(key)![ch] += amount;
    };
    inquiries.forEach((i) => add(toJstDateKey(i.inquired_at).slice(0, 7), i.channel));
    webDates.forEach((d) => add(toJstDateKey(d).slice(0, 7), "web"));
    externalReports.forEach((report) => {
      const key = report.report_date.slice(0, 7);
      addAmount(key, "estama", report.inquiry_count);
      addAmount(key, "estamaViews", report.page_views);
    });
    hpReports.forEach((report) => addAmount(report.date.slice(0, 7), "hpViews", report.page_views));
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [inquiries, webDates, externalReports, hpReports]);

  // 選択月の日別集計（昇順）
  const daily = useMemo(() => {
    const map = new Map<string, Counts>();
    const add = (key: string, ch: keyof Counts) => {
      if (key.slice(0, 7) !== selectedMonth) return;
      if (!map.has(key)) map.set(key, emptyCounts());
      map.get(key)![ch]++;
    };
    const addAmount = (key: string, ch: keyof Counts, amount: number) => {
      if (key.slice(0, 7) !== selectedMonth) return;
      if (!map.has(key)) map.set(key, emptyCounts());
      map.get(key)![ch] += amount;
    };
    inquiries.forEach((i) => add(toJstDateKey(i.inquired_at), i.channel));
    webDates.forEach((d) => add(toJstDateKey(d), "web"));
    externalReports.forEach((report) => {
      addAmount(report.report_date, "estama", report.inquiry_count);
      addAmount(report.report_date, "estamaViews", report.page_views);
    });
    hpReports.forEach((report) => addAmount(report.date, "hpViews", report.page_views));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [inquiries, webDates, externalReports, hpReports, selectedMonth]);

  // 選択月の記録一覧（手動・LINE入力分のみ。削除可能）
  const monthEntries = useMemo(
    () => inquiries.filter((i) => toJstDateKey(i.inquired_at).slice(0, 7) === selectedMonth),
    [inquiries, selectedMonth],
  );

  const handleAdd = async () => {
    setSaving(true);
    const { error } = await supabase.from("inquiries").insert({
      store_id: storeId,
      channel: form.channel,
      memo: form.memo || null,
      source: "manual",
      inquired_at: new Date(`${form.date}T12:00:00+09:00`).toISOString(),
    });
    setSaving(false);
    if (error) { console.error(error); toast.error("追加に失敗しました"); return; }
    toast.success("問い合わせを記録しました");
    setShowAdd(false);
    setForm({ ...form, memo: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    const { error } = await supabase.from("inquiries").delete().eq("id", id).eq("store_id", storeId);
    if (error) { toast.error("削除に失敗しました"); return; }
    setInquiries((prev) => prev.filter((i) => i.id !== id));
  };

  const CH_ICON = { phone: Phone, line: MessageCircle, other: HelpCircle } as const;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" />
              問い合わせ集計
              {adminStore?.name && (
                <span className="text-sm font-normal text-muted-foreground">（{adminStore.name}）</span>
              )}
            </h1>
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1" />手動で記録
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            電話・LINE・その他はLINE botまたは手動入力。WEB予約は予約フォーム、エステ魂予約と媒体アクセスはGmailのデイリーレポート、HPアクセスは公開サイトから自動集計します。
          </p>

          {loading ? (
            <div className="text-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : (
            <>
              {/* 月別 */}
              <div className="rounded-xl border bg-card overflow-hidden mb-6">
                <div className="px-4 py-2.5 border-b text-sm font-semibold">月別（直近12ヶ月）</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2">月</th>
                        <th className="text-right px-3 py-2">電話</th>
                        <th className="text-right px-3 py-2">LINE</th>
                        <th className="text-right px-3 py-2">その他</th>
                        <th className="text-right px-3 py-2">WEB予約</th>
                        <th className="text-right px-3 py-2">エステ魂予約</th>
                        <th className="text-right px-3 py-2">媒体アクセス</th>
                        <th className="text-right px-3 py-2">HPアクセス</th>
                        <th className="text-right px-4 py-2 font-bold">合計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">データがありません</td></tr>
                      )}
                      {monthly.map(([m, c]) => (
                        <tr
                          key={m}
                          onClick={() => setSelectedMonth(m)}
                          className={`border-t cursor-pointer hover:bg-muted/40 ${selectedMonth === m ? "bg-primary/5" : ""}`}
                        >
                          <td className="px-4 py-2 font-medium">{m.replace("-", "年")}月{selectedMonth === m && <span className="ml-1.5 text-[10px] text-primary">▼日別表示中</span>}</td>
                          <td className="text-right px-3 py-2">{c.phone}</td>
                          <td className="text-right px-3 py-2">{c.line}</td>
                          <td className="text-right px-3 py-2">{c.other}</td>
                          <td className="text-right px-3 py-2">{c.web}</td>
                          <td className="text-right px-3 py-2">{c.estama}</td>
                          <td className="text-right px-3 py-2 text-muted-foreground">{c.estamaViews.toLocaleString("ja-JP")}</td>
                          <td className="text-right px-3 py-2 text-muted-foreground">{c.hpViews.toLocaleString("ja-JP")}</td>
                          <td className="text-right px-4 py-2 font-bold">{total(c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 日別 */}
              <div className="rounded-xl border bg-card overflow-hidden mb-6">
                <div className="px-4 py-2.5 border-b text-sm font-semibold">
                  {selectedMonth.replace("-", "年")}月の日別内訳
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2">日付</th>
                        <th className="text-right px-3 py-2">電話</th>
                        <th className="text-right px-3 py-2">LINE</th>
                        <th className="text-right px-3 py-2">その他</th>
                        <th className="text-right px-3 py-2">WEB予約</th>
                        <th className="text-right px-3 py-2">エステ魂予約</th>
                        <th className="text-right px-3 py-2">媒体アクセス</th>
                        <th className="text-right px-3 py-2">HPアクセス</th>
                        <th className="text-right px-4 py-2 font-bold">合計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.length === 0 && (
                        <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">この月のデータがありません</td></tr>
                      )}
                      {daily.map(([d, c]) => (
                        <tr key={d} className="border-t">
                          <td className="px-4 py-2">{formatDateKeyShort(d)}</td>
                          <td className="text-right px-3 py-2">{c.phone}</td>
                          <td className="text-right px-3 py-2">{c.line}</td>
                          <td className="text-right px-3 py-2">{c.other}</td>
                          <td className="text-right px-3 py-2">{c.web}</td>
                          <td className="text-right px-3 py-2">{c.estama}</td>
                          <td className="text-right px-3 py-2 text-muted-foreground">{c.estamaViews.toLocaleString("ja-JP")}</td>
                          <td className="text-right px-3 py-2 text-muted-foreground">{c.hpViews.toLocaleString("ja-JP")}</td>
                          <td className="text-right px-4 py-2 font-bold">{total(c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 記録一覧（削除用） */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b text-sm font-semibold">
                  {selectedMonth.replace("-", "年")}月の記録一覧（電話・LINE・その他）
                </div>
                {monthEntries.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">記録がありません</p>
                ) : (
                  <div className="divide-y">
                    {monthEntries.map((i) => {
                      const Icon = CH_ICON[i.channel];
                      return (
                        <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <Icon size={15} className="text-primary shrink-0" />
                          <span className="w-24 shrink-0 text-muted-foreground">{JST_DATE_TIME_FORMATTER.format(new Date(i.inquired_at))}</span>
                          <span className="w-14 shrink-0 font-medium">{CHANNEL_LABEL[i.channel]}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${i.source === "line" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {i.source === "line" ? "LINE入力" : "手動"}
                          </span>
                          <span className="flex-1 truncate text-muted-foreground">{i.memo}</span>
                          <button onClick={() => handleDelete(i.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* 手動記録ダイアログ */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>問い合わせを手動で記録</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>日付</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>チャネル</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">電話</SelectItem>
                  <SelectItem value="line">LINE</SelectItem>
                  <SelectItem value="other">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>メモ（任意）</Label>
              <Textarea rows={2} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="新規のお客様 など" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Plus size={14} className="mr-1" />}
                記録する
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
