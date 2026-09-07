import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, addDays, isSameMonth, isToday, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight, Trash2, LayoutGrid, CalendarDays, Check, WandSparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/useStore";
import { runQueuedEstamaAutomation } from "@/lib/estamaAutomation";
import { calculateMonthlyRoomOccupancy } from "@/lib/roomOccupancy";

interface Shift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  status: string;
  approval_status: string;
  approval_comment: string | null;
  estama_registered: boolean;
  estama_human_confirmed: boolean;
  estama_confirmed_at: string | null;
  estama_confirmed_by: string | null;
  esran_registered: boolean;
  casts: { name: string };
}

interface Cast {
  id: string;
  name: string;
  is_estama_dummy: boolean;
}

interface DummyShift {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  estama_registered: boolean;
  casts: { name: string };
}

type DummyShiftPattern = Record<number, [string, string]>;

const ROOMS = ["インルーム", "ラスルーム"];
const DUMMY_SHIFT_PATTERNS_BY_NAME: Record<string, DummyShiftPattern> = {
  蒼井かずは: { 1: ["12:00", "20:00"], 3: ["14:00", "22:00"], 6: ["12:00", "23:00"] },
  華咲れみ: { 0: ["12:00", "20:00"], 2: ["13:00", "21:00"], 4: ["15:00", "23:00"] },
};
const DEFAULT_DUMMY_SHIFT_PATTERNS: DummyShiftPattern[] = [
  { 1: ["12:00", "20:00"], 3: ["14:00", "22:00"], 6: ["12:00", "23:00"] },
  { 0: ["12:00", "20:00"], 2: ["13:00", "21:00"], 4: ["15:00", "23:00"] },
  { 1: ["13:00", "21:00"], 4: ["12:00", "20:00"], 5: ["15:00", "23:00"] },
];
const DUMMY_PALETTE = [
  { chip: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  { chip: "bg-fuchsia-100 dark:bg-fuchsia-900/30", text: "text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-500" },
  { chip: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
];

// ルームごとの色分け（承認済みシフトに適用。pending=amber / rejected=rose はそのまま）
const ROOM_PALETTE = [
  { chip: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { chip: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { chip: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  { chip: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  { chip: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
  { chip: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
];

const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });

const roomColor = (room: string | null) => {
  if (!room) return null;
  const idx = ROOMS.indexOf(room);
  if (idx >= 0) return ROOM_PALETTE[idx % ROOM_PALETTE.length];
  let h = 0;
  for (const ch of room) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ROOM_PALETTE[h % ROOM_PALETTE.length];
};

export default function MonthlyShift() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [dummyShifts, setDummyShifts] = useState<DummyShift[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "dummy">("calendar");
  const [showDialog, setShowDialog] = useState(false);
  const [showDummyCastDialog, setShowDummyCastDialog] = useState(false);
  const [dummyCastSelection, setDummyCastSelection] = useState<string[]>([]);
  const [savingDummyCasts, setSavingDummyCasts] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDummyId, setEditingDummyId] = useState<string | null>(null);
  const [formKind, setFormKind] = useState<"regular" | "dummy">("regular");
  const [saving, setSaving] = useState(false);
  const [generatingDummy, setGeneratingDummy] = useState(false);
  const [form, setForm] = useState({
    cast_id: "",
    shift_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "12:00",
    end_time: "21:00",
    room: "",
    estama_registered: false,
    estama_human_confirmed: false,
    esran_registered: false,
  });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEndDate, setBulkEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pendingAction, setPendingAction] = useState<{id: string; status: "approved" | "rejected"; room?: string | null} | null>(null);
  const [actionComment, setActionComment] = useState("");

  const openAdd = (preset?: Partial<typeof form>, kind: "regular" | "dummy" = viewMode === "dummy" ? "dummy" : "regular") => {
    setEditingId(null);
    setEditingDummyId(null);
    setFormKind(kind);
    setBulkMode(false);
    const startDate = preset?.shift_date ?? format(new Date(), "yyyy-MM-dd");
    setBulkEndDate(startDate);
    setForm({
      cast_id: "",
      shift_date: startDate,
      start_time: "12:00",
      end_time: "21:00",
      room: "",
      estama_registered: false,
      estama_human_confirmed: false,
      esran_registered: false,
      ...preset,
    });
    setShowDialog(true);
  };

  const openEdit = (shift: Shift) => {
    setEditingId(shift.id);
    setEditingDummyId(null);
    setFormKind("regular");
    setForm({
      cast_id: shift.cast_id,
      shift_date: shift.shift_date,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      room: shift.room || "",
      estama_registered: shift.estama_registered ?? false,
      estama_human_confirmed: shift.estama_human_confirmed ?? false,
      esran_registered: shift.esran_registered ?? false,
    });
    setShowDialog(true);
  };

  const openDummyEdit = (shift: DummyShift) => {
    setEditingId(null);
    setEditingDummyId(shift.id);
    setFormKind("dummy");
    setBulkMode(false);
    setForm({
      cast_id: shift.cast_id,
      shift_date: shift.shift_date,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      room: "",
      estama_registered: shift.estama_registered,
      estama_human_confirmed: false,
      esran_registered: false,
    });
    setShowDialog(true);
  };

  const { user, loading: authLoading } = useAuth();
  const { storeId } = useStore();
  const navigate = useNavigate();

  const triggerEstamaSync = () => {
    void runQueuedEstamaAutomation(storeId).catch((error) => console.warn("Estama shift sync queued", error));
  };

  const fetchMonthlyShifts = useCallback(async () => {
    setLoading(true);
    const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
    const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
    const [shiftResult, dummyShiftResult] = await Promise.all([
      supabase
        .from("shifts")
        .select("*, casts(name)")
        .eq("store_id", storeId)
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date"),
      supabase
        .from("estama_dummy_shifts")
        .select("*, casts(name)")
        .eq("store_id", storeId)
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date")
        .order("start_time"),
    ]);
    if (shiftResult.error) console.error(shiftResult.error);
    if (dummyShiftResult.error) console.error(dummyShiftResult.error);
    setShifts((shiftResult.data || []) as Shift[]);
    setDummyShifts((dummyShiftResult.data || []) as DummyShift[]);
    setLoading(false);
  }, [selectedMonth, storeId]);

  const fetchCasts = useCallback(async () => {
    const { data, error } = await supabase
      .from("casts")
      .select("id, name, is_estama_dummy")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name");
    if (error) {
      console.error(error);
      return;
    }
    setCasts(data || []);
  }, [storeId]);

  const openDummyCastSelector = () => {
    setDummyCastSelection(casts.filter(cast => cast.is_estama_dummy).map(cast => cast.id));
    setShowDummyCastDialog(true);
  };

  const handleSaveDummyCasts = async () => {
    setSavingDummyCasts(true);
    const selected = new Set(dummyCastSelection);
    const changedCasts = casts.filter(cast => cast.is_estama_dummy !== selected.has(cast.id));

    const results = await Promise.all(
      changedCasts.map(cast =>
        supabase
          .from("casts")
          .update({ is_estama_dummy: selected.has(cast.id) })
          .eq("id", cast.id)
          .eq("store_id", storeId),
      ),
    );
    const failed = results.find(result => result.error);
    setSavingDummyCasts(false);

    if (failed?.error) {
      console.error(failed.error);
      toast.error("対象セラピストの保存に失敗しました");
      return;
    }

    await fetchCasts();
    setShowDummyCastDialog(false);
    toast.success(`ダミーシフト対象を${dummyCastSelection.length}名に更新しました`);
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchMonthlyShifts();
    fetchCasts();

    const channel = supabase
      .channel("monthly-shift-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `store_id=eq.${storeId}` }, () => {
        fetchMonthlyShifts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "estama_dummy_shifts", filter: `store_id=eq.${storeId}` }, () => {
        fetchMonthlyShifts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "casts", filter: `store_id=eq.${storeId}` }, () => {
        fetchCasts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, storeId, fetchMonthlyShifts, fetchCasts]);

  const handleSave = async () => {
    if (!form.cast_id) { toast.error("セラピストを選択してください"); return; }
    setSaving(true);

    if (formKind === "dummy") {
      const payload = {
        cast_id: form.cast_id,
        store_id: storeId,
        shift_date: form.shift_date,
        start_time: form.start_time,
        end_time: form.end_time,
        estama_registered: false,
      };
      const { error } = editingDummyId
        ? await supabase.from("estama_dummy_shifts").update(payload).eq("id", editingDummyId)
        : await supabase.from("estama_dummy_shifts").insert([payload]);
      setSaving(false);
      if (error) { toast.error("ダミーシフトの保存に失敗しました"); return; }
      toast.success(editingDummyId ? "ダミーシフトを更新しました" : "ダミーシフトを追加しました");
      setShowDialog(false);
      setEditingDummyId(null);
      fetchMonthlyShifts();
      triggerEstamaSync();
      return;
    }

    if (!editingId && bulkMode) {
      // 連続追加: 開始日〜終了日の全日程をまとめてINSERT
      const start = parseISO(form.shift_date);
      const end = parseISO(bulkEndDate);
      if (end < start) { toast.error("終了日は開始日以降にしてください"); setSaving(false); return; }
      const dates = eachDayOfInterval({ start, end });
      const rows = dates.map(d => ({
        cast_id: form.cast_id,
        store_id: storeId,
        shift_date: format(d, "yyyy-MM-dd"),
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room || null,
        estama_registered: false,
        estama_human_confirmed: false,
        esran_registered: form.esran_registered,
        approval_status: "approved",
      }));
      const { error } = await supabase.from("shifts").insert(rows);
      setSaving(false);
      if (error) { toast.error("保存に失敗しました"); return; }
      toast.success(`${dates.length}日分のシフトを追加しました`);
      setShowDialog(false);
      fetchMonthlyShifts();
      triggerEstamaSync();
      return;
    }

    const currentShift = editingId ? shifts.find(shift => shift.id === editingId) : null;
    const syncFieldsChanged = !currentShift
      || currentShift.cast_id !== form.cast_id
      || currentShift.shift_date !== form.shift_date
      || currentShift.start_time.slice(0, 5) !== form.start_time
      || currentShift.end_time.slice(0, 5) !== form.end_time
      || currentShift.approval_status !== "approved";

    const payload = {
      cast_id: form.cast_id,
      shift_date: form.shift_date,
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room || null,
      estama_registered: syncFieldsChanged ? false : currentShift?.estama_registered ?? false,
      estama_human_confirmed: syncFieldsChanged ? false : form.estama_human_confirmed,
      esran_registered: form.esran_registered,
      approval_status: "approved",
    };
    const { error } = editingId
      ? await supabase.from("shifts").update(payload).eq("id", editingId)
      : await supabase.from("shifts").insert([{ ...payload, store_id: storeId }]);
    setSaving(false);
    if (error) { toast.error("保存に失敗しました"); return; }
    toast.success(editingId ? "シフトを更新しました" : "シフトを追加しました");
    setShowDialog(false);
    setEditingId(null);
    fetchMonthlyShifts();
    triggerEstamaSync();
  };

  const handleGenerateDummyShifts = async () => {
    const dummyCastsForGeneration = casts.filter(cast => cast.is_estama_dummy);
    if (!dummyCastsForGeneration.length) {
      toast.error("ダミーシフト対象セラピストを選択してください");
      return;
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const monthDays = eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) });
    const rows = dummyCastsForGeneration.flatMap((cast, index) => {
      const pattern = DUMMY_SHIFT_PATTERNS_BY_NAME[cast.name]
        ?? DEFAULT_DUMMY_SHIFT_PATTERNS[index % DEFAULT_DUMMY_SHIFT_PATTERNS.length];
      return monthDays.flatMap((day) => {
        const shiftDate = format(day, "yyyy-MM-dd");
        const times = pattern[getDay(day)];
        if (!times || shiftDate < today) return [];
        return [{
          store_id: storeId,
          cast_id: cast.id,
          shift_date: shiftDate,
          start_time: times[0],
          end_time: times[1],
          estama_registered: false,
        }];
      });
    });
    const existing = new Set(dummyShifts.map(shift => `${shift.cast_id}:${shift.shift_date}`));
    const missingRows = rows.filter(row => !existing.has(`${row.cast_id}:${row.shift_date}`));
    if (!missingRows.length) {
      toast.info("この月のダミーシフトは作成済みです");
      return;
    }

    setGeneratingDummy(true);
    const { error } = await supabase
      .from("estama_dummy_shifts")
      .upsert(missingRows, { onConflict: "cast_id,shift_date", ignoreDuplicates: true });
    setGeneratingDummy(false);
    if (error) { toast.error("ダミーシフトの自動作成に失敗しました"); return; }
    toast.success(`${missingRows.length}件のダミーシフトを自動作成しました`);
    fetchMonthlyShifts();
    triggerEstamaSync();
  };

  const handleDelete = async (id: string, kind: "regular" | "dummy" = "regular") => {
    if (kind === "dummy") {
      await supabase.from("estama_dummy_shifts").delete().eq("id", id);
      setDummyShifts(prev => prev.filter(s => s.id !== id));
    } else {
      await supabase.from("shifts").delete().eq("id", id);
      setShifts(prev => prev.filter(s => s.id !== id));
    }
    triggerEstamaSync();
  };

  const updateStatus = async (id: string, approval_status: "approved" | "rejected", room?: string | null, comment?: string) => {
    const patch: { approval_status: string; room?: string | null; approval_comment?: string | null; estama_registered: boolean; estama_human_confirmed: boolean } = {
      approval_status,
      estama_registered: false,
      estama_human_confirmed: false,
    };
    if (room !== undefined) patch.room = room;
    patch.approval_comment = comment || null;
    const { error } = await supabase.from("shifts").update(patch).eq("id", id);
    if (error) { toast.error("更新に失敗しました"); return; }
    toast.success(approval_status === "approved" ? "承認しました" : "却下しました");
    setShifts(prev => prev.map(s => (s.id === id ? {
      ...s,
      approval_status,
      approval_comment: comment || null,
      estama_registered: false,
      estama_human_confirmed: false,
      ...(room !== undefined ? { room } : {}),
    } : s)));
    triggerEstamaSync();
  };

  const assignRoom = async (id: string, room: string) => {
    const { error } = await supabase.from("shifts").update({ room }).eq("id", id);
    if (error) { toast.error("ルームの更新に失敗しました"); return; }
    setShifts(prev => prev.map(s => (s.id === id ? { ...s, room } : s)));
  };

  const prevMonth = () => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  const nextMonth = () => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));

  // 承認待ちの申請
  const pendingShifts = shifts
    .filter(s => s.approval_status === "pending")
    .sort((a, b) => (a.shift_date < b.shift_date ? -1 : a.shift_date > b.shift_date ? 1 : a.start_time.localeCompare(b.start_time)));

  const regularCasts = casts.filter(c => !c.is_estama_dummy);
  const dummyCasts = casts.filter(c => c.is_estama_dummy);

  const roomOccupancy = useMemo(
    () => calculateMonthlyRoomOccupancy(shifts, selectedMonth, ROOMS),
    [shifts, selectedMonth],
  );
  const occupiedHours = roomOccupancy.occupiedMinutes / 60;
  const capacityHours = roomOccupancy.capacityMinutes / 60;

  // カレンダーグリッド用: 月初の週の日曜から始まる6週×7日
  const calendarStart = startOfWeek(startOfMonth(selectedMonth), { weekStartsOn: 0 });
  const calendarDays = Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i));

  // 凡例用: この月で使われているルーム
  const usedRooms = [...new Set(shifts.filter(s => s.room).map(s => s.room!))].sort(
    (a, b) => (ROOMS.indexOf(a) === -1 ? 99 : ROOMS.indexOf(a)) - (ROOMS.indexOf(b) === -1 ? 99 : ROOMS.indexOf(b)),
  );

  // 日付→その日の全シフト
  const dayShiftMap = new Map<string, Shift[]>();
  shifts.forEach(s => {
    if (!dayShiftMap.has(s.shift_date)) dayShiftMap.set(s.shift_date, []);
    dayShiftMap.get(s.shift_date)!.push(s);
  });

  const dummyDayShiftMap = new Map<string, DummyShift[]>();
  dummyShifts.forEach(shift => {
    if (!dummyDayShiftMap.has(shift.shift_date)) dummyDayShiftMap.set(shift.shift_date, []);
    dummyDayShiftMap.get(shift.shift_date)!.push(shift);
  });

  const isEditing = Boolean(editingId || editingDummyId);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px] px-2 md:px-6 pb-2 md:pb-6 overflow-x-auto">
        {/* ヘッダー */}
        <div className="mb-4">
          {/* 1行目: タイトル + 月ナビ + シフト追加 */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-lg font-bold mr-1">月別シフト</h1>
            {/* 月ナビ（まとまったグループ） */}
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={prevMonth} className="h-8 w-8 p-0"><ChevronLeft size={16} /></Button>
              <span className="text-sm font-medium w-[80px] text-center">
                {format(selectedMonth, "yyyy年M月", { locale: ja })}
              </span>
              <Button size="sm" variant="outline" onClick={nextMonth} className="h-8 w-8 p-0"><ChevronRight size={16} /></Button>
            </div>
            <Button onClick={() => openAdd()} size="sm" className="ml-auto shrink-0">
              <Plus size={14} className="mr-1" />{viewMode === "dummy" ? "ダミーシフト追加" : "シフト追加"}
            </Button>
          </div>
          {/* 2行目: ビュー切り替え + ルーム凡例 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border overflow-hidden w-fit">
              <button
                onClick={() => setViewMode("calendar")}
                className={cn("px-3 py-1.5 text-xs flex items-center gap-1", viewMode === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <LayoutGrid size={13} />カレンダー
              </button>
              <button
                onClick={() => setViewMode("dummy")}
                className={cn("px-3 py-1.5 text-xs flex items-center gap-1 border-l", viewMode === "dummy" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <CalendarDays size={13} />ダミー用
              </button>
            </div>
            {viewMode === "calendar" && usedRooms.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {usedRooms.map(r => (
                  <span key={r} className="flex items-center gap-1">
                    <span className={cn("w-2.5 h-2.5 rounded-full", roomColor(r)?.dot)} />
                    {r}
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/30" />
                  ルーム未設定
                </span>
              </div>
            )}
            {viewMode === "calendar" && (
              <div className="w-full rounded-md border bg-card px-3 py-2 shadow-sm sm:ml-auto sm:w-auto sm:min-w-[240px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium">月間ルーム稼働率</span>
                  <span className="text-lg font-bold tabular-nums">
                    {numberFormatter.format(roomOccupancy.percentage)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${roomOccupancy.percentage}%` }}
                    role="progressbar"
                    aria-label="月間ルーム稼働率"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Number(roomOccupancy.percentage.toFixed(1))}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {numberFormatter.format(occupiedHours)}時間 / {numberFormatter.format(capacityHours)}時間
                  （11:00〜翌2:00・{ROOMS.length}室・{roomOccupancy.daysInMonth}日）
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ===== 承認待ちのシフト申請 ===== */}
        {pendingShifts.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/10 overflow-hidden">
            <div className="px-3 py-2 bg-amber-100/70 dark:bg-amber-900/20 text-sm font-semibold text-amber-800 dark:text-amber-300">
              承認待ちのシフト申請（{pendingShifts.length}件）
            </div>
            <div className="divide-y divide-amber-200/70 dark:divide-amber-900/30">
              {pendingShifts.map(s => (
                <div key={s.id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium min-w-[60px]">{s.casts?.name}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(s.shift_date), "M/d(E)", { locale: ja })}
                  </span>
                  <span className="text-muted-foreground">
                    {s.start_time.slice(0, 5)}〜{s.end_time.slice(0, 5)}
                  </span>
                  <Select value={s.room ?? ""} onValueChange={v => assignRoom(s.id, v)}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="ルーム選択" /></SelectTrigger>
                    <SelectContent>
                      {ROOMS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="ml-auto flex gap-1.5">
                    <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => { setPendingAction({id: s.id, status: "approved", room: s.room ?? ROOMS[0]}); setActionComment(""); }}>
                      承認
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-rose-600 border-rose-300 hover:bg-rose-50"
                      onClick={() => { setPendingAction({id: s.id, status: "rejected"}); setActionComment(""); }}>
                      却下
                    </Button>
                  </div>
                  {s.approval_status === "rejected" && s.approval_comment && (
                    <p className="text-xs text-rose-600 mt-0.5 w-full">{s.approval_comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-12">読み込み中...</div>
        ) : (
          <>
            {/* ===== カレンダービュー ===== */}
            <div className={viewMode === "calendar" ? "" : "hidden"}>
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-7 border-b">
              {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    "text-center text-xs font-semibold py-1.5",
                    i === 0 && "text-red-500",
                    i === 6 && "text-blue-500"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
            {/* 日付グリッド */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const inMonth = isSameMonth(day, selectedMonth);
                const today = isToday(day);
                const dow = getDay(day);
                const dayShifts = dayShiftMap.get(dateStr) || [];
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "min-h-[80px] md:min-h-[100px] border-r border-b p-1 cursor-pointer hover:bg-muted/30 transition-colors",
                      !inMonth && "bg-muted/10",
                      dow === 0 && inMonth && "bg-red-50/30 dark:bg-red-950/10",
                      dow === 6 && inMonth && "bg-blue-50/30 dark:bg-blue-950/10"
                    )}
                    onClick={() => {
                      if (!inMonth) return;
                      openAdd({ shift_date: dateStr });
                    }}
                  >
                    <div className={cn(
                      "text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full",
                      today && "bg-primary text-primary-foreground",
                      !inMonth && "text-muted-foreground/40",
                      dow === 0 && inMonth && !today && "text-red-500",
                      dow === 6 && inMonth && !today && "text-blue-500"
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayShifts.slice(0, 4).map(s => (
                        <div
                          key={s.id}
                          className={cn(
                            "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight cursor-pointer relative",
                            s.approval_status === "pending" && "bg-amber-100 dark:bg-amber-900/30",
                            s.approval_status === "rejected" && "bg-rose-100 dark:bg-rose-900/20 line-through opacity-60",
                            s.approval_status === "approved" && (roomColor(s.room)?.chip ?? "bg-primary/10")
                          )}
                          onClick={e => { e.stopPropagation(); openEdit(s); }}
                          title="クリックで編集"
                        >
                          {s.estama_human_confirmed && (
                            <span className="absolute -top-1 -left-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm" title="エスたま公開表示を確認済み" aria-label="エスたま公開表示を確認済み"><Check className="h-2.5 w-2.5 stroke-[3]" /></span>
                          )}
                          {s.esran_registered && (
                            <span className="absolute -top-0.5 left-2 w-2 h-2 bg-blue-500 rounded-full z-10" title="エスラン登録済み" />
                          )}
                          {s.approval_status === "pending" && (
                            <span className="text-amber-600 shrink-0" title="承認待ち">●</span>
                          )}
                          <span className={cn(
                            "font-medium truncate max-w-[50px] md:max-w-none",
                            s.approval_status === "rejected"
                              ? "text-rose-600"
                              : s.approval_status === "approved"
                                ? roomColor(s.room)?.text ?? "text-primary"
                                : "text-primary"
                          )}>
                            {s.casts.name}
                          </span>
                          <span className="text-muted-foreground hidden md:inline shrink-0">
                            {s.start_time.slice(0,5)}〜{s.end_time.slice(0,5)}
                          </span>
                        </div>
                      ))}
                      {dayShifts.length > 4 && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          +{dayShifts.length - 4}人
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

            {/* ===== ダミー用ビュー ===== */}
            <div className={viewMode === "dummy" ? "" : "hidden"}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0">
                  <p className="text-xs text-muted-foreground">
                    エスたま専用の予定です。通常シフトと店舗HPには表示されません。
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {dummyCasts.map((cast, index) => (
                      <span key={cast.id} className="flex items-center gap-1">
                        <span className={cn("h-2.5 w-2.5 rounded-full", DUMMY_PALETTE[index % DUMMY_PALETTE.length]?.dot)} />
                        {cast.name}
                      </span>
                    ))}
                    {dummyCasts.length === 0 && <span>対象セラピスト未選択</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={openDummyCastSelector}>
                    <Users size={14} className="mr-1" />対象セラピスト選択
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateDummyShifts}
                    disabled={generatingDummy || dummyCasts.length === 0}
                  >
                    <WandSparkles size={14} className="mr-1" />
                    {generatingDummy ? "作成中..." : "ダミーシフト自動作成"}
                  </Button>
                </div>
              </div>
              {dummyCasts.length === 0 ? (
                <div className="rounded-lg border py-12 text-center">
                  <p className="text-sm text-muted-foreground">ダミーシフト対象セラピストが未選択です。</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={openDummyCastSelector}>
                    <Users size={14} className="mr-1" />対象セラピストを選択
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <div className="min-w-[700px]">
                    <div className="grid grid-cols-7 border-b bg-muted/40">
                      {["日", "月", "火", "水", "木", "金", "土"].map((label, index) => (
                        <div
                          key={label}
                          className={cn(
                            "py-1.5 text-center text-xs font-semibold",
                            index === 0 && "text-red-500",
                            index === 6 && "text-blue-500",
                          )}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {calendarDays.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const inMonth = isSameMonth(day, selectedMonth);
                        const today = isToday(day);
                        const dow = getDay(day);
                        const dayDummyShifts = dummyDayShiftMap.get(dateStr) || [];
                        return (
                          <div
                            key={dateStr}
                            className={cn(
                              "min-h-[112px] border-r border-b p-1 transition-colors",
                              inMonth ? "cursor-pointer hover:bg-muted/30" : "bg-muted/10",
                              dow === 0 && inMonth && "bg-red-50/30 dark:bg-red-950/10",
                              dow === 6 && inMonth && "bg-blue-50/30 dark:bg-blue-950/10",
                            )}
                            onClick={() => {
                              if (inMonth) openAdd({ shift_date: dateStr }, "dummy");
                            }}
                          >
                            <div className={cn(
                              "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                              today && "bg-primary text-primary-foreground",
                              !inMonth && "text-muted-foreground/40",
                              dow === 0 && inMonth && !today && "text-red-500",
                              dow === 6 && inMonth && !today && "text-blue-500",
                            )}>
                              {format(day, "d")}
                            </div>
                            <div className="space-y-1">
                              {dayDummyShifts.map((shift) => {
                                const foundCastIndex = dummyCasts.findIndex(cast => cast.id === shift.cast_id);
                                const castIndex = foundCastIndex >= 0 ? foundCastIndex : 0;
                                const palette = DUMMY_PALETTE[castIndex % DUMMY_PALETTE.length] || DUMMY_PALETTE[0];
                                return (
                                  <button
                                    key={shift.id}
                                    type="button"
                                    className={cn(
                                      "relative block w-full rounded px-1 py-1 text-left text-[10px] leading-tight",
                                      palette.chip,
                                      palette.text,
                                    )}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openDummyEdit(shift);
                                    }}
                                    title={`${shift.casts.name} ${shift.start_time.slice(0, 5)}〜${shift.end_time.slice(0, 5)}${shift.estama_registered ? "（エスたま同期済み）" : ""}`}
                                  >
                                    {shift.estama_registered && (
                                      <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white">
                                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                                      </span>
                                    )}
                                    <span className="block truncate pr-3 font-semibold">{shift.casts.name}</span>
                                    <span className="block opacity-80">
                                      {shift.start_time.slice(0, 5)}〜{shift.end_time.slice(0, 5)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) { setEditingId(null); setEditingDummyId(null); setBulkMode(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formKind === "dummy"
                ? (editingDummyId ? "ダミーシフト編集" : "ダミーシフト入力")
                : (editingId ? "シフト編集" : "シフト入力")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* 連続追加トグル（新規追加時のみ） */}
            {formKind === "regular" && !editingId && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    if (!bulkMode) setBulkEndDate(form.shift_date);
                  }}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    bulkMode ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                    bulkMode && "translate-x-5"
                  )} />
                </div>
                <span className="text-sm font-medium">連続追加（出稼ぎ）</span>
                {bulkMode && form.shift_date && bulkEndDate >= form.shift_date && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {eachDayOfInterval({ start: parseISO(form.shift_date), end: parseISO(bulkEndDate) }).length}日間
                  </span>
                )}
              </label>
            )}
            <div>
              <Label>セラピスト</Label>
              <Select value={form.cast_id} onValueChange={v => setForm({ ...form, cast_id: v })}>
                <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                <SelectContent>
                  {(formKind === "dummy" ? dummyCasts : regularCasts).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bulkMode ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>開始日</Label>
                  <Input type="date" value={form.shift_date} onChange={e => {
                    setForm({ ...form, shift_date: e.target.value });
                    if (bulkEndDate < e.target.value) setBulkEndDate(e.target.value);
                  }} />
                </div>
                <div>
                  <Label>終了日</Label>
                  <Input type="date" value={bulkEndDate} min={form.shift_date} onChange={e => setBulkEndDate(e.target.value)} />
                </div>
              </div>
            ) : (
              <div>
                <Label>日付</Label>
                <Input type="date" value={form.shift_date} onChange={e => setForm({ ...form, shift_date: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>開始時間</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <Label>終了時間</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            {formKind === "dummy" ? (
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                この予定はエスたまだけに同期され、通常の出勤カレンダーや店舗HPには表示されません。
              </div>
            ) : (
              <>
                <div>
                  <Label>ルーム</Label>
                  <Select value={form.room} onValueChange={v => setForm({ ...form, room: v })}>
                    <SelectTrigger><SelectValue placeholder="ルームを選択" /></SelectTrigger>
                    <SelectContent>
                      {ROOMS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {editingId ? <div>
                  <Label>エスたま公開表示の最終確認</Label>
                  <div className="mt-1 space-y-2 rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">自動同期</span>
                      <span>{form.estama_registered ? "完了" : "未完了"}</span>
                    </div>
                    <Button
                      type="button"
                      variant={form.estama_human_confirmed ? "destructive" : "outline"}
                      className="w-full"
                      onClick={() => setForm({ ...form, estama_human_confirmed: !form.estama_human_confirmed })}
                    >
                      {form.estama_human_confirmed ? (
                        <><Check className="mr-1 h-4 w-4 stroke-[3]" />確認済み（赤チェック）</>
                      ) : (
                        "公開ページを確認済みにする"
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      エスたまの公開ページに出勤が表示されていることを人が確認してから押してください。
                    </p>
                  </div>
                </div> : (
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    エスたまへの自動同期後、シフトを再度開いて公開表示を最終確認できます。
                  </div>
                )}
                <div>
                  <Label>エスランに登録</Label>
                  <Select
                    value={form.esran_registered ? "registered" : "unregistered"}
                    onValueChange={v => setForm({ ...form, esran_registered: v === "registered" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unregistered">未登録</SelectItem>
                      <SelectItem value="registered">登録済み</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
              {isEditing && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (editingDummyId) handleDelete(editingDummyId, "dummy");
                    else if (editingId) handleDelete(editingId, "regular");
                    setShowDialog(false);
                    setEditingId(null);
                    setEditingDummyId(null);
                  }}
                >
                  <Trash2 size={14} className="mr-1" />削除
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={() => { setShowDialog(false); setEditingId(null); setEditingDummyId(null); }}>キャンセル</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDummyCastDialog} onOpenChange={setShowDummyCastDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ダミーシフト対象セラピスト</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-sm text-muted-foreground">
              自動作成・手動追加の対象にするセラピストを選択してください。
            </p>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {casts.map(cast => {
                const selected = dummyCastSelection.includes(cast.id);
                return (
                  <button
                    key={cast.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                    onClick={() => setDummyCastSelection(prev =>
                      prev.includes(cast.id) ? prev.filter(id => id !== cast.id) : [...prev, cast.id],
                    )}
                  >
                    <span className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}>
                      {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </span>
                    <span className="font-medium">{cast.name}</span>
                    {cast.is_estama_dummy && (
                      <span className="ml-auto text-[10px] text-muted-foreground">現在の対象</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{dummyCastSelection.length}名選択中</span>
              {dummyCastSelection.length > 0 && (
                <button type="button" className="underline" onClick={() => setDummyCastSelection([])}>選択解除</button>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowDummyCastDialog(false)}>キャンセル</Button>
              <Button className="flex-1" onClick={handleSaveDummyCasts} disabled={savingDummyCasts}>
                {savingDummyCasts ? "保存中..." : "対象を保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingAction} onOpenChange={o => { if (!o) setPendingAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pendingAction?.status === "approved" ? "シフトを承認しますか？" : "シフトを却下しますか？"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea
              placeholder="コメント（任意）"
              value={actionComment}
              onChange={e => setActionComment(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPendingAction(null)}>キャンセル</Button>
              <Button
                className={`flex-1 ${pendingAction?.status === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-rose-600 hover:bg-rose-700"}`}
                onClick={() => {
                  if (pendingAction) {
                    updateStatus(pendingAction.id, pendingAction.status, pendingAction.room, actionComment);
                    setPendingAction(null);
                  }
                }}
              >
                {pendingAction?.status === "approved" ? "承認する" : "却下する"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
