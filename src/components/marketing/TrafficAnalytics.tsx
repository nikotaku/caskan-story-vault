import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Copy, ExternalLink, Link2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TrafficRow {
  date: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  landing_path: string;
  visits: number;
}

interface TrafficAnalyticsProps {
  store: {
    id: string;
    name: string;
    custom_domain?: string | null;
  } | null;
}

const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40";

function localDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultBaseUrl(customDomain?: string | null) {
  return customDomain ? `https://${customDomain}/` : "https://zenryokuesthe.com/";
}

export function TrafficAnalytics({ store }: TrafficAnalyticsProps) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<TrafficRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl(store?.custom_domain));
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    setBaseUrl(defaultBaseUrl(store?.custom_domain));
  }, [store?.id, store?.custom_domain]);

  const fetchTraffic = useCallback(async () => {
    if (!store?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("hp_analytics_traffic")
      .select("date,source,medium,campaign,content,landing_path,visits")
      .eq("store_id", store.id)
      .gte("date", localDate(days - 1))
      .order("date", { ascending: false })
      .order("visits", { ascending: false })
      .limit(1000);
    setLoading(false);
    if (error) {
      console.error(error);
      toast.error("流入元データの取得に失敗しました");
      return;
    }
    setRows((data ?? []) as TrafficRow[]);
  }, [days, store?.id]);

  useEffect(() => { fetchTraffic(); }, [fetchTraffic]);

  const taggedUrl = useMemo(() => {
    try {
      const url = new URL(baseUrl);
      const dimensions = {
        utm_source: source.trim(),
        utm_medium: medium.trim(),
        utm_campaign: campaign.trim(),
        utm_content: content.trim(),
      };
      Object.entries(dimensions).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      });
      return url.toString();
    } catch {
      return "";
    }
  }, [baseUrl, source, medium, campaign, content]);

  const summary = useMemo(() => {
    const bySource = new Map<string, number>();
    const campaigns = new Set<string>();
    let total = 0;
    rows.forEach((row) => {
      total += row.visits;
      bySource.set(row.source, (bySource.get(row.source) ?? 0) + row.visits);
      if (row.campaign) campaigns.add(row.campaign);
    });
    const topSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total, campaigns: campaigns.size, topSource };
  }, [rows]);

  const copyTaggedUrl = async () => {
    if (!taggedUrl) {
      toast.error("正しいリンク先URLを入力してください");
      return;
    }
    try {
      await navigator.clipboard.writeText(taggedUrl);
      toast.success("タグ付きURLをコピーしました");
    } catch {
      toast.error("コピーできませんでした");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-2">
          <Link2 size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <h2 className="font-bold">流入計測用リンクを作る</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              SNS・広告・バナーごとにタグを変えて設置すると、どの導線から来店サイトへ流入したか判別できます。
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium">リンク先URL</span>
            <input className={inputClass} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://zenryokuesthe.com/campaigns" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">流入元（utm_source）</span>
            <input className={inputClass} value={source} onChange={(event) => setSource(event.target.value)} placeholder="instagram / estama / line" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">媒体種別（utm_medium）</span>
            <input className={inputClass} value={medium} onChange={(event) => setMedium(event.target.value)} placeholder="social / banner / qr" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">キャンペーン名（utm_campaign）</span>
            <input className={inputClass} value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="summer_2026" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">設置場所（utm_content）</span>
            <input className={inputClass} value={content} onChange={(event) => setContent(event.target.value)} placeholder="profile / top_banner / flyer_a" />
          </label>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">生成されたURL</p>
          <p className="break-all font-mono text-xs">{taggedUrl || "URLを確認してください"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={copyTaggedUrl}><Copy size={14} className="mr-1.5" />コピー</Button>
            {taggedUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={taggedUrl} target="_blank" rel="noreferrer">確認<ExternalLink size={13} className="ml-1.5" /></a>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <BarChart3 size={18} className="mt-0.5 text-primary" />
            <div>
              <h2 className="font-bold">流入元分析</h2>
              <p className="mt-1 text-xs text-muted-foreground">{store?.name ?? "現在の店舗"}の新規セッションを集計します。</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[7, 30, 90].map((value) => (
              <button key={value} onClick={() => setDays(value)} className={`rounded-md px-2.5 py-1.5 text-xs ${days === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {value}日
              </button>
            ))}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={fetchTraffic} aria-label="再読み込み">
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] text-muted-foreground">流入セッション</p><p className="mt-1 text-xl font-bold">{summary.total}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] text-muted-foreground">最多流入元</p><p className="mt-1 truncate text-sm font-bold">{summary.topSource?.[0] ?? "-"}</p><p className="text-[11px] text-muted-foreground">{summary.topSource ? `${summary.topSource[1]}件` : "データなし"}</p></div>
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] text-muted-foreground">キャンペーン数</p><p className="mt-1 text-xl font-bold">{summary.campaigns}</p></div>
        </div>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            まだ流入データがありません。上で作ったタグ付きURLを導線に設置すると、次回アクセスから記録されます。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead><tr className="border-b bg-muted/60">
                <th className="px-3 py-2.5 text-left">日付</th><th className="px-3 py-2.5 text-left">流入元</th><th className="px-3 py-2.5 text-left">媒体種別</th><th className="px-3 py-2.5 text-left">キャンペーン</th><th className="px-3 py-2.5 text-left">設置場所</th><th className="px-3 py-2.5 text-left">入口ページ</th><th className="px-3 py-2.5 text-right">件数</th>
              </tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={`${row.date}-${row.source}-${row.medium}-${row.campaign}-${row.content}-${row.landing_path}`} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="whitespace-nowrap px-3 py-2.5">{row.date}</td>
                  <td className="px-3 py-2.5 font-medium">{row.source}</td>
                  <td className="px-3 py-2.5">{row.medium || "-"}</td>
                  <td className="px-3 py-2.5">{row.campaign || "-"}</td>
                  <td className="px-3 py-2.5">{row.content || "-"}</td>
                  <td className="max-w-48 truncate px-3 py-2.5 font-mono">{row.landing_path || "/"}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{row.visits}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">UTMタグがないアクセスも、外部サイトの参照元または「direct」として記録されます。</p>
      </section>
    </div>
  );
}
