import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/hooks/useStore";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Download, MinusCircle, Trash2 } from "lucide-react";
import { downloadReferralReceipt } from "@/lib/referralReceipt";
import { toast } from "sonner";

interface Row {
  castId: string;
  castName: string;
  ruleName: string;
  unitAmount: number; // 予約1本あたり
  count: number;      // 完了本数
  sales: number;      // 対象売上
  fee: number;        // 紹介費 = unitAmount * count
}

interface ReferralRewardOption {
  id: string;
  name: string;
}

interface Adjustment {
  id: string;
  ruleName: string;
  reason: string;
  amount: number;
}

const yen = (v: number) => `${v < 0 ? "−" : ""}¥${Math.abs(v).toLocaleString()}`;

export default function SalesReferralFees() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [rewardOptions, setRewardOptions] = useState<ReferralRewardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRule, setActiveRule] = useState("すべて");
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentRewardId, setAdjustmentRewardId] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { storeId } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      const [castsRes, rewardsRes, resvRes, adjustmentsRes] = await Promise.all([
        supabase.from("casts").select("id, name, real_name, referral_reward_id").eq("store_id", storeId).not("referral_reward_id", "is", null),
        supabase.from("referral_rewards").select("id, name, amount").eq("store_id", storeId),
        supabase
          .from("reservations")
          .select("cast_id, price, payment_fee, status, reservation_date")
          .eq("store_id", storeId)
          .gte("reservation_date", monthStart)
          .lte("reservation_date", monthEnd)
          .eq("status", "completed"),
        supabase
          .from("referral_fee_adjustments")
          .select("id, referral_reward_id, reason, amount, created_at")
          .eq("store_id", storeId)
          .eq("month_date", monthStart)
          .order("created_at", { ascending: true }),
      ]);

      const requestError = castsRes.error || rewardsRes.error || resvRes.error || adjustmentsRes.error;
      if (requestError) throw requestError;

      const rewardMap = new Map<string, { name: string; amount: number }>();
      for (const r of rewardsRes.data || []) rewardMap.set(r.id, { name: r.name, amount: r.amount ?? 0 });
      setRewardOptions((rewardsRes.data || []).map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, "ja")));

      setAdjustments((adjustmentsRes.data || [])
        .filter((a) => rewardMap.has(a.referral_reward_id))
        .map((a) => ({
          id: a.id,
          ruleName: rewardMap.get(a.referral_reward_id)!.name,
          reason: a.reason,
          amount: a.amount ?? 0,
        })));

      // 紹介ルールが紐づくキャストのみ対象
      const castInfo = new Map<string, { name: string; rule: { name: string; amount: number } }>();
      for (const c of castsRes.data || []) {
        if (!c.referral_reward_id) continue;
        const rule = rewardMap.get(c.referral_reward_id);
        if (!rule) continue;
        castInfo.set(c.id, { name: c.real_name ? `${c.name}/${c.real_name}` : c.name, rule });
      }

      // 完了予約を対象キャストで集計
      const agg = new Map<string, { count: number; sales: number }>();
      for (const r of resvRes.data || []) {
        if (!r.cast_id || !castInfo.has(r.cast_id)) continue;
        const cur = agg.get(r.cast_id) ?? { count: 0, sales: 0 };
        cur.count += 1;
        cur.sales += (r.price ?? 0) + (r.payment_fee ?? 0);
        agg.set(r.cast_id, cur);
      }

      const result: Row[] = [];
      for (const [castId, info] of castInfo) {
        const a = agg.get(castId) ?? { count: 0, sales: 0 };
        if (a.count === 0) continue; // 当月実績がある紹介キャストのみ表示
        result.push({
          castId,
          castName: info.name,
          ruleName: info.rule.name,
          unitAmount: info.rule.amount,
          count: a.count,
          sales: a.sales,
          fee: info.rule.amount * a.count,
        });
      }
      result.sort((x, y) => y.fee - x.fee);
      setRows(result);
    } catch (e) {
      console.error("Error fetching referral fees:", e);
      setRows([]);
      setAdjustments([]);
      toast.error("紹介費データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, storeId]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const ruleNames = Array.from(new Set([...rows.map((r) => r.ruleName), ...adjustments.map((a) => a.ruleName)])).sort();
  const tabs = ["すべて", ...ruleNames];
  const displayedRows = activeRule === "すべて" ? rows : rows.filter((r) => r.ruleName === activeRule);
  const displayedAdjustments = activeRule === "すべて" ? adjustments : adjustments.filter((a) => a.ruleName === activeRule);

  const grossFees = displayedRows.reduce((s, r) => s + r.fee, 0);
  const totalAdjustments = displayedAdjustments.reduce((s, a) => s + a.amount, 0);
  const totalFees = grossFees - totalAdjustments;
  const totalSales = displayedRows.reduce((s, r) => s + r.sales, 0);
  const totalCount = displayedRows.reduce((s, r) => s + r.count, 0);
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());
  const hasData = rows.length > 0 || adjustments.length > 0;

  const handleReceipt = () => {
    if (displayedRows.length === 0 && displayedAdjustments.length === 0) {
      toast.error("この月の対象データがありません");
      return;
    }
    downloadReferralReceipt({
      month: selectedMonth,
      ruleLabel: activeRule,
      rows: displayedRows.map((r) => ({
        castName: r.castName,
        ruleName: r.ruleName,
        unitAmount: r.unitAmount,
        count: r.count,
        fee: r.fee,
      })),
      adjustments: displayedAdjustments.map((a) => ({
        reason: a.reason,
        amount: a.amount,
      })),
    });
    toast.success("紹介費明細を作成しました");
  };

  const openAdjustmentDialog = () => {
    const activeReward = activeRule === "すべて"
      ? rewardOptions[0]
      : rewardOptions.find((r) => r.name === activeRule) ?? rewardOptions[0];
    setAdjustmentRewardId(activeReward?.id ?? "");
    setAdjustmentReason("");
    setAdjustmentAmount(0);
    setAdjustmentOpen(true);
  };

  const handleAddAdjustment = async () => {
    const reason = adjustmentReason.trim();
    if (!adjustmentRewardId) {
      toast.error("相殺するSBを選択してください");
      return;
    }
    if (!reason) {
      toast.error("マイナス項目の内容を入力してください");
      return;
    }
    if (!Number.isInteger(adjustmentAmount) || adjustmentAmount <= 0) {
      toast.error("金額は1円以上の整数で入力してください");
      return;
    }

    setSavingAdjustment(true);
    try {
      const { error } = await supabase.from("referral_fee_adjustments").insert({
        store_id: storeId,
        month_date: format(startOfMonth(selectedMonth), "yyyy-MM-dd"),
        referral_reward_id: adjustmentRewardId,
        reason,
        amount: adjustmentAmount,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setAdjustmentOpen(false);
      await fetchData();
      toast.success("マイナス項目を追加しました");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "マイナス項目の追加に失敗しました");
    } finally {
      setSavingAdjustment(false);
    }
  };

  const handleDeleteAdjustment = async (adjustment: Adjustment) => {
    if (!window.confirm(`「${adjustment.reason}」${yen(adjustment.amount)}を削除しますか？`)) return;
    const { error } = await supabase
      .from("referral_fee_adjustments")
      .delete()
      .eq("id", adjustment.id)
      .eq("store_id", storeId);
    if (error) {
      toast.error("マイナス項目の削除に失敗しました");
      return;
    }
    await fetchData();
    toast.success("マイナス項目を削除しました");
  };

  // 月やデータが変わったら選択タブが消えていた場合すべてに戻す
  useEffect(() => {
    if (activeRule !== "すべて" && !ruleNames.includes(activeRule)) setActiveRule("すべて");
  }, [rows, adjustments]); // eslint-disable-line

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">紹介費管理</h1>
              <p className="text-muted-foreground text-sm">セラピストを紹介してくれた会社への報酬。マイナス項目でSBと相殺できます。</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth((d) => subMonths(d, 1))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-semibold px-3 w-28 text-center">
                {format(selectedMonth, "yyyy年M月", { locale: ja })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth((d) => addMonths(d, 1))} disabled={isCurrentMonth}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          {/* 紹介元ルール別タブ ＋ 明細 */}
          {!loading && (
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                {hasData && tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveRule(t)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeRule === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={openAdjustmentDialog} disabled={rewardOptions.length === 0}>
                  <MinusCircle size={15} className="mr-1.5" />マイナス項目を追加
                </Button>
                {hasData && (
                  <Button variant="outline" onClick={handleReceipt}>
                    <Download size={15} className="mr-1.5" />明細
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">差引後の紹介費</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalFees < 0 ? "text-red-600" : "text-primary"}`}>{yen(totalFees)}</div>
                {totalAdjustments > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">紹介費 {yen(grossFees)} − 相殺 {yen(totalAdjustments)}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">対象売上</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{yen(totalSales)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">対象本数</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalCount}<span className="text-sm font-normal ml-1">本</span></div></CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : !hasData ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center text-muted-foreground text-sm">
                この月の対象データがありません。<br />
                <span className="text-xs">※「広告費」で紹介報酬ルールを作成し、キャスト管理で対象セラピストに紐付けると集計されます。</span>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2.5 font-semibold">セラピスト</th>
                        <th className="text-left px-4 py-2.5 font-semibold">紹介元ルール</th>
                        <th className="text-right px-4 py-2.5 font-semibold">完了本数</th>
                        <th className="text-right px-4 py-2.5 font-semibold">1本単価</th>
                        <th className="text-right px-4 py-2.5 font-semibold">対象売上</th>
                        <th className="text-right px-4 py-2.5 font-semibold">紹介費／相殺</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {displayedRows.map((r) => (
                        <tr key={r.castId} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{r.castName}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.ruleName}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{r.count}本</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{yen(r.unitAmount)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{yen(r.sales)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-primary">{yen(r.fee)}</td>
                        </tr>
                      ))}
                      {displayedAdjustments.map((a) => (
                        <tr key={`adjustment-${a.id}`} className="bg-red-50/60 hover:bg-red-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <MinusCircle size={14} className="text-red-600 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-red-700 break-words">{a.reason}</p>
                                <p className="text-[11px] text-muted-foreground">マイナス項目</p>
                              </div>
                              <button
                                type="button"
                                aria-label={`${a.reason}を削除`}
                                onClick={() => handleDeleteAdjustment(a)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-red-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{a.ruleName}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-red-600">−{yen(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-bold">
                        <td className="px-4 py-2.5 text-xs" colSpan={2}>合計</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs">{totalCount}本</td>
                        <td />
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs">{yen(totalSales)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${totalFees < 0 ? "text-red-600" : "text-primary"}`}>{yen(totalFees)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>マイナス項目を追加</DialogTitle>
            <DialogDescription>
              {format(selectedMonth, "yyyy年M月", { locale: ja })}のSB（紹介費）から入力額を相殺します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>相殺するSB</Label>
              <Select value={adjustmentRewardId} onValueChange={setAdjustmentRewardId}>
                <SelectTrigger><SelectValue placeholder="SBを選択" /></SelectTrigger>
                <SelectContent>
                  {rewardOptions.map((reward) => (
                    <SelectItem key={reward.id} value={reward.id}>{reward.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjustment-reason">項目名・理由</Label>
              <Input
                id="adjustment-reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="例：店落ち分の相殺"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjustment-amount">相殺金額</Label>
              <Input
                id="adjustment-amount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={adjustmentAmount || ""}
                onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">金額は正数で入力し、明細ではマイナス表示されます。</p>
            </div>
            <Button onClick={handleAddAdjustment} disabled={savingAdjustment} className="w-full">
              {savingAdjustment && <Loader2 size={15} className="mr-1.5 animate-spin" />}
              {savingAdjustment ? "追加中..." : "SBから相殺する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
