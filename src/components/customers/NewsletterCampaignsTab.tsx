import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Mail, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminStore } from "@/hooks/useAdminStore";
import { isValidEmail } from "@/lib/email";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CampaignStatus = "draft" | "sending" | "sent" | "partial" | "failed";

interface Campaign {
  id: string;
  title: string;
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: CampaignStatus;
  created_at: string;
  sent_at: string | null;
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "下書き",
  sending: "送信中",
  sent: "送信完了",
  partial: "一部失敗",
  failed: "送信失敗",
};

const STATUS_CLASS_NAMES: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sending: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NewsletterCampaignsTab() {
  const { storeId, loading: storeLoading } = useAdminStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [eligibleRecipients, setEligibleRecipients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [pendingSend, setPendingSend] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ title: "", subject: "", bodyText: "" });

  const fetchData = useCallback(async () => {
    if (storeLoading || !storeId) return;
    setLoading(true);
    try {
      const [campaignResult, recipientResult] = await Promise.all([
        supabase
          .from("newsletter_campaigns")
          .select("id, title, subject, recipient_count, sent_count, failed_count, status, created_at, sent_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("customers")
          .select("id, email")
          .eq("store_id", storeId)
          .eq("newsletter_opt_in", true)
          .or("is_banned.is.null,is_banned.eq.false")
          .not("email", "is", null)
          .limit(2_000),
      ]);
      if (campaignResult.error) throw campaignResult.error;
      if (recipientResult.error) throw recipientResult.error;

      setCampaigns((campaignResult.data || []) as Campaign[]);
      const uniqueEmails = new Set(
        (recipientResult.data || [])
          .map((customer) => String(customer.email || "").trim().toLowerCase())
          .filter(isValidEmail),
      );
      setEligibleRecipients(uniqueEmails.size);
    } catch (error) {
      console.error("Failed to load newsletter data", error);
      toast.error("メルマガ情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [storeId, storeLoading]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const canSave = useMemo(() => (
    form.title.trim().length > 0
    && form.subject.trim().length > 0
    && form.bodyText.trim().length > 0
  ), [form]);

  const saveDraft = async () => {
    if (!canSave || saving) return;
    if (form.title.trim().length > 100 || form.subject.trim().length > 200 || form.bodyText.trim().length > 20_000) {
      toast.error("タイトル・件名・本文の文字数上限を確認してください");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("newsletter_campaigns").insert({
        store_id: storeId,
        title: form.title.trim(),
        subject: form.subject.trim(),
        body_text: form.bodyText.trim(),
      });
      if (error) throw error;
      setForm({ title: "", subject: "", bodyText: "" });
      toast.success("メルマガを下書きとして保存しました");
      await fetchData();
    } catch (error) {
      console.error("Failed to save newsletter draft", error);
      toast.error("下書きの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const sendCampaign = async () => {
    if (!pendingSend || sendingId) return;
    const campaign = pendingSend;
    setPendingSend(null);
    setSendingId(campaign.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { campaignId: campaign.id },
      });
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "メール送信サービスが送信を完了できませんでした。");
      }
      toast.success(`${data.sentCount.toLocaleString()}件へメルマガを送信しました`);
      await fetchData();
    } catch (error) {
      console.error("Failed to send newsletter", error);
      toast.error(error instanceof Error ? error.message : "メルマガの送信に失敗しました");
      await fetchData();
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">配信対象</p><p className="text-xl font-bold tabular-nums">{loading ? "—" : `${eligibleRecipients.toLocaleString()}件`}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-700" /></div>
            <div><p className="text-xs text-muted-foreground">送信済み配信</p><p className="text-xl font-bold tabular-nums">{loading ? "—" : `${campaigns.filter((campaign) => campaign.status === "sent").length}件`}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5"><Clock3 className="h-5 w-5 text-amber-700" /></div>
            <div><p className="text-xs text-muted-foreground">送信待ち下書き</p><p className="text-xl font-bold tabular-nums">{loading ? "—" : `${campaigns.filter((campaign) => campaign.status === "draft").length}件`}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />メルマガを作成</CardTitle>
          <CardDescription>配信同意済みで、連絡停止・利用禁止ではない有効メールアドレスだけを対象にします。下書き保存後、対象件数を確認してから送信します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="newsletter-title">管理用タイトル</Label><Input id="newsletter-title" value={form.title} maxLength={100} placeholder="例：9月限定キャンペーン" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="newsletter-subject">メール件名</Label><Input id="newsletter-subject" value={form.subject} maxLength={200} placeholder="例：【期間限定】お得なお知らせ" onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="newsletter-body">本文</Label><Textarea id="newsletter-body" value={form.bodyText} maxLength={20_000} rows={10} placeholder="お客様へお届けする本文を入力してください。改行はそのままメールに反映されます。" onChange={(event) => setForm((current) => ({ ...current, bodyText: event.target.value }))} /><p className="text-right text-xs text-muted-foreground">{form.bodyText.length.toLocaleString()} / 20,000</p></div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />送信前に必ず対象件数と内容を確認してください。下書き状態ではメールは送られません。</span><Button onClick={saveDraft} disabled={!canSave || saving || !storeId}>{saving ? "保存中…" : "下書きに保存"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">配信履歴</CardTitle><CardDescription>配信の送信結果はここに記録されます。</CardDescription></CardHeader>
        <CardContent>
          {loading ? <p className="py-6 text-center text-sm text-muted-foreground">読み込み中...</p> : campaigns.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">まだメルマガは作成されていません。</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="px-2 py-3 font-medium">タイトル</th><th className="px-2 py-3 font-medium">状態</th><th className="px-2 py-3 font-medium text-right">対象</th><th className="px-2 py-3 font-medium text-right">送信 / 失敗</th><th className="px-2 py-3 font-medium">作成 / 送信日時</th><th className="px-2 py-3 font-medium text-right">操作</th></tr></thead>
                <tbody>{campaigns.map((campaign) => <tr key={campaign.id} className="border-b last:border-0"><td className="max-w-[220px] px-2 py-3"><p className="truncate font-medium">{campaign.title}</p><p className="truncate text-xs text-muted-foreground">{campaign.subject}</p></td><td className="px-2 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS_NAMES[campaign.status]}`}>{STATUS_LABELS[campaign.status]}</span></td><td className="px-2 py-3 text-right tabular-nums">{campaign.status === "draft" ? `${eligibleRecipients.toLocaleString()}件（予定）` : `${campaign.recipient_count.toLocaleString()}件`}</td><td className="px-2 py-3 text-right tabular-nums">{campaign.status === "draft" ? "—" : `${campaign.sent_count.toLocaleString()} / ${campaign.failed_count.toLocaleString()}`}</td><td className="px-2 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(campaign.created_at)}<br />{campaign.sent_at ? `送信：${formatDateTime(campaign.sent_at)}` : "未送信"}</td><td className="px-2 py-3 text-right">{campaign.status === "draft" && <Button size="sm" onClick={() => setPendingSend(campaign)} disabled={sendingId === campaign.id || eligibleRecipients === 0}><Send className="mr-1 h-3.5 w-3.5" />送信</Button>}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(pendingSend)} onOpenChange={(open) => { if (!open && !sendingId) setPendingSend(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このメルマガを送信しますか？</AlertDialogTitle>
            <AlertDialogDescription>「{pendingSend?.subject}」を、現在の配信対象 {eligibleRecipients.toLocaleString()} 件へ送信します。送信後は同じ下書きを再送できません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void sendCampaign(); }}>送信を確定する</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
