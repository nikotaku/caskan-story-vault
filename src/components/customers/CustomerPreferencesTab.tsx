import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminStore } from "@/hooks/useAdminStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, Heart } from "lucide-react";
import { PRESSURE_OPTIONS, AREA_OPTIONS, CONVERSATION_OPTIONS } from "@/lib/customerRank";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  visit_count: number | null;
  last_visited: string | null;
}

export interface ProfileData {
  preferred_pressure: string | null;
  concern_areas: string[] | null;
  conversation_level: string | null;
  ng_items: string | null;
  preference_notes: string | null;
}

const EMPTY_PROFILE: ProfileData = {
  preferred_pressure: null,
  concern_areas: null,
  conversation_level: null,
  ng_items: null,
  preference_notes: null,
};

async function fetchAllPreferenceCustomers(storeId: string): Promise<CustomerRow[]> {
  const result: CustomerRow[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, visit_count, last_visited")
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

async function fetchAllProfiles(storeId: string): Promise<(ProfileData & { customer_id: string })[]> {
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

export function CustomerPreferencesTab() {
  const { storeId, loading: storeLoading } = useAdminStore();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState<ProfileData>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (storeLoading) return;
    setLoading(true);
    try {
      const [customerRows, profileRows] = await Promise.all([
        fetchAllPreferenceCustomers(storeId),
        fetchAllProfiles(storeId),
      ]);
      setCustomers(customerRows);
      const map = new Map<string, ProfileData>();
      for (const profile of profileRows) {
        map.set(profile.customer_id, profile);
      }
      setProfiles(map);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digitQuery = q.replace(/\D/g, "");
    if (!q) return customers;
    return customers.filter(
      (c) => c.name?.toLowerCase().includes(q)
        || (digitQuery.length > 0 && c.phone?.replace(/\D/g, "").includes(digitQuery)),
    );
  }, [customers, search]);

  const openEdit = (c: CustomerRow) => {
    setEditing(c);
    setForm(profiles.get(c.id) ?? EMPTY_PROFILE);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("customer_profiles").upsert(
        {
          customer_id: editing.id,
          store_id: storeId,
          preferred_pressure: form.preferred_pressure,
          concern_areas: form.concern_areas,
          conversation_level: form.conversation_level,
          ng_items: form.ng_items,
          preference_notes: form.preference_notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" },
      );
      if (error) throw error;
      setProfiles((prev) => new Map(prev).set(editing.id, { ...form }));
      toast.success("好みを保存しました");
      setEditing(null);
    } catch (e) {
      console.error(e);
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const toggleArea = (area: string) => {
    const current = form.concern_areas ?? [];
    const next = current.includes(area) ? current.filter((a) => a !== area) : [...current, area];
    setForm({ ...form, concern_areas: next.length > 0 ? next : null });
  };

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="relative mb-3 shrink-0 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="名前・電話番号で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      <div className="flex-1 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="sticky left-0 z-20 bg-muted px-3 py-2 font-medium">名前</th>
              <th className="px-3 py-2 font-medium">電話番号</th>
              <th className="px-3 py-2 font-medium">圧の好み</th>
              <th className="px-3 py-2 font-medium">気になる部位</th>
              <th className="px-3 py-2 font-medium">会話</th>
              <th className="px-3 py-2 font-medium">NG・アレルギー</th>
              <th className="px-3 py-2 font-medium">メモ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((c) => {
              const p = profiles.get(c.id);
              return (
                <tr key={c.id} className="group cursor-pointer hover:bg-muted/40" onClick={() => openEdit(c)}>
                  <td className="sticky left-0 z-[5] bg-background px-3 py-2 font-medium whitespace-nowrap group-hover:bg-muted">
                    <span className="flex items-center gap-1.5">
                      {p && <Heart size={11} className="text-rose-400 shrink-0" />}
                      {c.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.phone}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p?.preferred_pressure ?? "—"}</td>
                  <td className="px-3 py-2">{p?.concern_areas?.join("・") ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p?.conversation_level ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate text-orange-600">{p?.ng_items ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground">{p?.preference_notes ?? "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">該当する顧客がいません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.name} さんの好み</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>圧の好み</Label>
              <Select
                value={form.preferred_pressure ?? "unset"}
                onValueChange={(v) => setForm({ ...form, preferred_pressure: v === "unset" ? null : v })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="未設定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">未設定</SelectItem>
                  {PRESSURE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>気になる部位</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {AREA_OPTIONS.map((area) => (
                  <label key={area} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(form.concern_areas ?? []).includes(area)}
                      onCheckedChange={() => toggleArea(area)}
                    />
                    {area}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>会話の好み</Label>
              <Select
                value={form.conversation_level ?? "unset"}
                onValueChange={(v) => setForm({ ...form, conversation_level: v === "unset" ? null : v })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="未設定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">未設定</SelectItem>
                  {CONVERSATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>NG・アレルギー</Label>
              <Input
                placeholder="例：アロマオイルNG、強圧NG"
                value={form.ng_items ?? ""}
                onChange={(e) => setForm({ ...form, ng_items: e.target.value || null })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>好みメモ</Label>
              <Textarea
                placeholder="例：足裏を長めに、BGM小さめが好き"
                value={form.preference_notes ?? ""}
                onChange={(e) => setForm({ ...form, preference_notes: e.target.value || null })}
                className="mt-1"
                rows={3}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
