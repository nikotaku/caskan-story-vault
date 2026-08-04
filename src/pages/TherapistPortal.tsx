import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, DollarSign, Receipt, Plane, CalendarPlus, LogOut, ChevronLeft, ChevronRight, Send, Calendar, Edit, Banknote, ClipboardCheck, DoorOpen, ExternalLink, ChevronDown, ChevronUp, Users, Search, Heart, PencilLine, Check, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import backRatesImage from "@/assets/back-rates-table.jpg";
import { format, startOfMonth, endOfMonth, isSameDay, addDays } from "date-fns";
import { toExtTime } from "@/lib/timeFormat";
import { getCastBookingUrl, getCustomDomainBaseUrl } from "@/lib/bookingUrl";
import { ja } from "date-fns/locale";


interface Cast {
  id: string;
  name: string;
  photo: string | null;
}

interface Settlement {
  id: string;
  reservation_date: string;
  start_time: string;
  duration: number;
  course_name: string;
  customer_price: number;
  therapist_back: number;
  status: string;
}

interface TransportExpense {
  id: string;
  expense_date: string;
  amount: number;
  route: string | null;
  notes: string | null;
  status: string;
}

interface ShiftRow {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  notes: string | null;
  approval_status: string;
  approval_comment: string | null;
}

interface Room {
  id: string;
  name: string;
  address: string | null;
  entry_flow: string | null;
  key_info: string | null;
  key_number: string | null;
  entry_photos: string[] | null;
}

type View = "menu" | "settlement" | "transport" | "shift" | "entry" | "customers" | "upcoming";

interface UpcomingReservation {
  id: string;
  reservation_date: string;
  start_time: string;
  duration: number;
  course_name: string;
  room: string | null;
  options: string[] | null;
  nomination_type: string | null;
  customer_name: string;
  status: string;
}

interface TherapistCustomer {
  customer_id: string;
  name: string;
  phone: string;
  visit_count: number | null;
  total_spent: number | null;
  last_visited: string | null;
  tags: string[] | null;
  notes: string | null;
  preferred_pressure: string | null;
  concern_areas: string[] | null;
  conversation_level: string | null;
  ng_items: string | null;
  preference_notes: string | null;
  my_visit_count: number;
  my_last_visit: string | null;
  my_visit_dates: string[] | null;
}

const now = new Date();

// 官能小説風・ニッチな投稿ネタ（参考例）。そのままコピペ可。
const POST_IDEAS: { title: string; body: string }[] = [
  {
    title: "指先のいたずら",
    body: "今日のあなたは、いつもより少し疲れた背中をしていたね。\nオイルをたっぷり手のひらで温めて、ゆっくり…ゆっくり。\n「ここ、好きでしょ？」って耳元で囁いたら、ピクッと反応したの、私だけの秘密にしておくね。\n続きは…私の部屋で待ってる♡",
  },
  {
    title: "甘い密室の時間",
    body: "鍵を閉めた瞬間から、ここはふたりだけの世界。\n照明を少し落として、香りに包まれながら、肌と肌の距離がゆっくり近づいていくの。\n呼吸が重なるたびに、あなたの力が抜けていくのがわかる。\nそんな無防備な顔、もっと見せて？",
  },
  {
    title: "焦らすのが好きなの",
    body: "わざとね、すぐには触れないの。\n指先がふれるかふれないか、その距離で、あなたが「早く」って目で訴えるまで。\nお願いされたら…ちゃんと応えてあげる。\n今夜は、たっぷり焦らされる覚悟をして会いに来てね♡",
  },
  {
    title: "耳元の囁き",
    body: "施術中、ふいに耳元で名前を呼ばれたら、ドキッとする？\n私はあなたの小さな反応ぜんぶ見てるよ。\n力が入った肩も、思わず漏れた吐息も。\n言葉にできない気持ちは、手のひらで全部受け止めてあげる。",
  },
  {
    title: "とろける90分",
    body: "最初はリラックス。だんだん、境界線が溶けていくの。\n「気持ちいい」が「もっと」に変わる瞬間が、私はいちばん好き。\n終わる頃にはとろとろになって、もう帰りたくないって言わせちゃうかも。\n今日は何時に会える？",
  },
  {
    title: "あなた限定のわがまま",
    body: "他の人には内緒のお願い、私にだけしてくれる？\nどんな小さなわがままも、今日は全部叶えてあげたい気分なの。\n恥ずかしがらなくていいよ、ふたりだけの秘密だから。\n指名してくれたら、特別なご褒美用意して待ってるね♡",
  },
];

export default function TherapistPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [cast, setCast] = useState<Cast | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("menu");
  const [showBackRates, setShowBackRates] = useState(false);
  const [guideSite, setGuideSite] = useState<"o2" | "x" | "esutama" | "ranking" | null>(null);
  const [linkSite, setLinkSite] = useState<"o2" | "x" | "esutama" | "ranking" | null>(null);
  const [linkForm, setLinkForm] = useState({ login_id: "", password: "" });
  const [linkSaving, setLinkSaving] = useState(false);

  // Upcoming reservations（事前予約）
  const [upcoming, setUpcoming] = useState<UpcomingReservation[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  // 本日の予約タイムライン（メニュー上部）
  const [menuTodayRes, setMenuTodayRes] = useState<UpcomingReservation[]>([]);
  const [menuTodayLoading, setMenuTodayLoading] = useState(true);
  // 今日以降の全予約（シフトの日付タップで内訳表示）
  const [menuAllUpcoming, setMenuAllUpcoming] = useState<UpcomingReservation[]>([]);
  const [expandedShiftDate, setExpandedShiftDate] = useState<string | null>(null);

  // Settlement
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Shifts
  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  // Menu top: current month shifts (always loaded)
  const [menuShiftRows, setMenuShiftRows] = useState<ShiftRow[]>([]);
  const [menuShiftLoading, setMenuShiftLoading] = useState(false);
  const [shiftExpanded, setShiftExpanded] = useState(false);

  // Rooms
  const [rooms, setRooms] = useState<Room[]>([]);

  // Clearance notification

  // Customers (顧客カルテ)
  const [therapistCustomers, setTherapistCustomers] = useState<TherapistCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [notesEditing, setNotesEditing] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  // 専用予約ページリンク
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [bookingBaseUrl, setBookingBaseUrl] = useState("");
  // 投稿ネタ
  const [copiedIdeaIdx, setCopiedIdeaIdx] = useState<number | null>(null);
  const [ideasOpen, setIdeasOpen] = useState(false);

  // Transport
  const [expenses, setExpenses] = useState<TransportExpense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [transportForm, setTransportForm] = useState({
    date: format(now, "yyyy-MM-dd"),
    amount: "",
    route: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { navigate("/"); return; }
    supabase.rpc("get_cast_by_access_token", { p_token: token }).then(async ({ data, error }) => {
      if (error || !data) {
        toast.error("無効なアクセスリンクです");
        navigate("/");
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { toast.error("無効なアクセスリンクです"); navigate("/"); return; }
      const castRow = row as Cast;

      // 所属店舗を先に特定し、その店舗の独自ドメインを予約リンクに使う。
      // casts→stores の埋め込み取得に依存させず、2段階で確実に解決する。
      let resolvedBookingBaseUrl = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
      const { data: castStoreData } = await supabase
        .from("casts")
        .select("store_id")
        .eq("id", castRow.id)
        .maybeSingle();

      if (castStoreData?.store_id) {
        const { data: storeData } = await supabase
          .from("stores")
          .select("custom_domain")
          .eq("id", castStoreData.store_id)
          .maybeSingle();
        const customBaseUrl = getCustomDomainBaseUrl(storeData?.custom_domain);
        if (customBaseUrl) resolvedBookingBaseUrl = customBaseUrl;
      }

      setBookingBaseUrl(resolvedBookingBaseUrl);
      setCast(castRow);
      setLoading(false);
      // Load current month shifts for menu top display
      setMenuShiftLoading(true);
      supabase.rpc("get_therapist_shifts", {
        p_token: token,
        p_year: now.getFullYear(),
        p_month: now.getMonth() + 1,
      }).then(({ data }) => {
        setMenuShiftRows((data || []) as ShiftRow[]);
        setMenuShiftLoading(false);
      });

      // 本日の予約タイムライン（営業日基準：深夜6時までは前日の営業日扱い）
      const bizBase = now.getHours() < 6 ? addDays(now, -1) : now;
      const bizToday = format(bizBase, "yyyy-MM-dd");
      const bizNext = format(addDays(bizBase, 1), "yyyy-MM-dd");
      supabase.rpc("get_therapist_upcoming_reservations" as any, { p_token: token }).then(({ data }) => {
        setMenuAllUpcoming((data || []) as UpcomingReservation[]);
        const rows = ((data || []) as UpcomingReservation[]).filter((r) =>
          (r.reservation_date === bizToday && r.start_time >= "06:00") ||
          (r.reservation_date === bizNext && r.start_time < "06:00")
        );
        rows.sort((a, b) => {
          const ext = (r: UpcomingReservation) => {
            const [h, m] = r.start_time.split(":").map(Number);
            return (h < 6 ? h + 24 : h) * 60 + m;
          };
          return ext(a) - ext(b);
        });
        setMenuTodayRes(rows);
        setMenuTodayLoading(false);
      });
    });
  }, [token, navigate]);

  useEffect(() => {
    if (view === "settlement" && cast) fetchSettlements();
    if (view === "transport" && cast) fetchExpenses();
    if (view === "shift" && cast) fetchShifts();
    if (view === "customers" && cast && therapistCustomers.length === 0) fetchCustomers();
    if (view === "upcoming" && cast) fetchUpcoming();
  }, [view, year, month, cast]);

  useEffect(() => {
    supabase.from("rooms").select("id, name, address, entry_flow, key_info, key_number, entry_photos").eq("is_active", true).order("name")
      .then(({ data }) => { if (data) setRooms(data as Room[]); });
  }, []);

  // シフトのステータス変更をリアルタイム反映
  useEffect(() => {
    if (view !== "shift" || !cast) return;
    const channel = supabase
      .channel(`therapist-shifts-${cast.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `cast_id=eq.${cast.id}` },
        () => fetchShifts()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [view, cast, year, month]);

  const fetchShifts = async () => {
    setShiftsLoading(true);
    const { data, error } = await supabase.rpc("get_therapist_shifts", {
      p_token: token, p_year: year, p_month: month,
    });
    if (error) toast.error("シフトの取得に失敗しました");
    else setShiftRows((data || []) as ShiftRow[]);
    setShiftsLoading(false);
  };

  const fetchUpcoming = async () => {
    setUpcomingLoading(true);
    const { data, error } = await supabase.rpc("get_therapist_upcoming_reservations" as any, { p_token: token });
    if (error) toast.error("予約の取得に失敗しました");
    else setUpcoming((data || []) as UpcomingReservation[]);
    setUpcomingLoading(false);
  };

  const fetchSettlements = async () => {
    setSettlementLoading(true);
    const { data, error } = await supabase.rpc("get_therapist_monthly_settlements", {
      p_token: token, p_year: year, p_month: month,
    });
    if (error) toast.error("データの取得に失敗しました");
    else setSettlements((data || []) as Settlement[]);
    setSettlementLoading(false);
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    const { data, error } = await supabase.rpc("get_therapist_customers", { p_token: token });
    if (error) toast.error("顧客データの取得に失敗しました");
    else setTherapistCustomers((data || []) as TherapistCustomer[]);
    setCustomersLoading(false);
  };

  const fetchExpenses = async () => {
    setExpensesLoading(true);
    const { data, error } = await supabase.rpc("get_therapist_transport_expenses", {
      p_token: token, p_year: year, p_month: month,
    });
    if (error) toast.error("データの取得に失敗しました");
    else setExpenses((data || []) as TransportExpense[]);
    setExpensesLoading(false);
  };

  const handleSaveNotes = async (customerId: string) => {
    setNotesSaving(true);
    const { error } = await supabase.rpc("update_therapist_customer_notes" as any, {
      p_token: token,
      p_customer_id: customerId,
      p_notes: notesValue,
    });
    setNotesSaving(false);
    if (error) { toast.error("メモの保存に失敗しました"); return; }
    setTherapistCustomers(prev =>
      prev.map(c => c.customer_id === customerId ? { ...c, preference_notes: notesValue || null } : c)
    );
    setNotesEditing(null);
    toast.success("メモを保存しました");
  };

  const handleTransportSubmit = async () => {
    if (!transportForm.amount || Number(transportForm.amount) <= 0) {
      toast.error("金額を入力してください"); return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_therapist_transport_expense", {
      p_token: token,
      p_date: transportForm.date,
      p_amount: Number(transportForm.amount),
      p_route: transportForm.route || null,
      p_notes: transportForm.notes || null,
    });
    setSubmitting(false);
    if (error) { toast.error("申請に失敗しました: " + error.message); return; }
    toast.success("交通費を申請しました");
    setTransportForm({ date: format(now, "yyyy-MM-dd"), amount: "", route: "", notes: "" });
    fetchExpenses();
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!cast) return null;

  const totalPrice = settlements.reduce((s, r) => s + r.customer_price, 0);
  const totalBack = settlements.reduce((s, r) => s + r.therapist_back, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthLabel = `${year}年${month}月`;

  const statusLabel: Record<string, string> = {
    confirmed: "確定", completed: "完了", pending: "確認中", sms_waiting: "確認中",
  };
  const expenseStatusLabel: Record<string, string> = {
    pending: "申請中", approved: "承認済", rejected: "却下",
  };
  const expenseStatusColor: Record<string, string> = {
    pending: "text-amber-600", approved: "text-green-600", rejected: "text-rose-600",
  };
  const shiftStatusLabel: Record<string, string> = {
    pending: "承認待ち", approved: "確定", rejected: "却下",
  };
  const shiftStatusBadge: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };

  const menuItems = [
    { title: "シフト提出", description: "希望シフトをカレンダーから提出", icon: CalendarPlus, action: () => navigate(`/therapist/${token}/shift`) },
    { title: "シフト確認", description: "確定したシフトと出勤ルームを確認", icon: Calendar, action: () => setView("shift") },
    { title: "事前予約", description: "今日以降に入っている予約を確認", icon: CalendarPlus, action: () => setView("upcoming") },
    { title: "投稿管理", description: "O2・エスたまの魂への投稿", icon: Edit, action: () => navigate(`/therapist/${token}/posts`) },
    { title: "バック表", description: "コース別・オプション別のバック率を確認", icon: Receipt, action: () => setShowBackRates(true) },
    { title: "交通費申請", description: "交通費の申請・申請履歴を確認", icon: Plane, action: () => setView("transport") },
    { title: "退勤フォーム", description: "売上入力・清掃チェック・フィードバック", icon: LogOut, action: () => navigate(`/therapist/${token}/checkout`) },
    { title: "顧客カルテ", description: "担当したお客様の好み・来店履歴を確認", icon: Users, action: () => setView("customers") },
    { title: "入室方法", description: "各ルームへの入室手順・鍵の場所を確認", icon: DoorOpen, action: () => setView("entry") },
    { title: "振り込み申請", description: "報酬の振り込み申請フォーム", icon: ExternalLink, action: () => window.open("https://yoom.fun/5eee42a7-b4ff-49a8-8373-606c66495142/forms/shared/Cu2K735X9qaSAdMs45x6Bw", "_blank") },
  ];

  const REGISTER_URLS: Record<"o2" | "x" | "esutama" | "ranking", string> = {
    o2: "https://m-sns.net/cast-register/",
    x: "https://x.com/i/flow/signup",
    esutama: "https://s-tama.jp/cast/register",
    ranking: "https://mensesthe-ranking.com/cast-register/",
  };
  const SITE_LABEL: Record<"o2" | "x" | "esutama" | "ranking", string> = {
    o2: "O2（ゼロツー）",
    x: "X（旧Twitter）",
    esutama: "エスたまの魂",
    ranking: "メンズエステランキング",
  };

  const openLink = (site: "o2" | "x" | "esutama" | "ranking") => {
    setLinkSite(site);
    setLinkForm({ login_id: "", password: "" });
  };

  const saveLink = async () => {
    if (!cast || !linkSite) return;
    if (!linkForm.login_id || !linkForm.password) { toast.error("IDとパスワードを入力してください"); return; }
    setLinkSaving(true);
    try {
      const { error } = await supabase
        .from("cast_site_credentials")
        .upsert({ cast_id: cast.id, site: linkSite, login_id: linkForm.login_id, password: linkForm.password }, { onConflict: "cast_id,site" });
      if (error) throw error;
      toast.success(`${SITE_LABEL[linkSite]}のログイン情報を登録しました`);
      setLinkSite(null);
    } catch (e) {
      console.error(e);
      toast.error("登録に失敗しました");
    } finally {
      setLinkSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          {view !== "menu" && (
            <button onClick={() => setView("menu")} className="text-primary flex items-center gap-1 text-sm mr-1">
              <ChevronLeft size={18} />戻る
            </button>
          )}
          {cast.photo && (
            <img src={cast.photo} alt={cast.name} className="h-9 w-9 rounded-full object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight truncate">{cast.name}様</p>
            <p className="text-xs text-muted-foreground">
              {view === "menu" ? "セラピストポータル" : view === "settlement" ? "精算・売上確認" : view === "shift" ? "シフト確認" : view === "entry" ? "入室方法" : view === "customers" ? "顧客カルテ" : view === "upcoming" ? "事前予約" : "交通費申請"}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">

        {/* ── MENU ── */}
        {view === "menu" && (
          <div className="space-y-4">

          {/* 本日の出勤ルーム（女の子が今日どのルームか一目で分かるように） */}
          {(() => {
            const todayStr = format(now, "yyyy-MM-dd");
            const todayShift = menuShiftRows.find(
              (s) => s.shift_date === todayStr && s.approval_status !== "rejected" && s.room
            );
            if (!todayShift || !todayShift.room) return null;
            const roomInfo = rooms.find((r) => r.name === todayShift.room);
            const area = roomInfo?.address || null;
            return (
              <div className="rounded-xl border-2 border-primary/40 bg-primary/5 overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                  <DoorOpen size={16} className="text-primary" />
                  <span className="font-bold text-sm">本日（{format(now, "M/d", { locale: ja })}）の出勤</span>
                </div>
                <div className="px-4 pb-3">
                  <p className="text-xl font-bold text-primary leading-tight">
                    {todayShift.room}
                    {area && <span className="text-sm font-medium text-foreground ml-1">（{area}）</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {toExtTime(todayShift.start_time)}〜{toExtTime(todayShift.end_time)}
                  </p>
                  <button
                    onClick={() => setView("entry")}
                    className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-primary"
                  >
                    入室方法を見る <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 本日の予約タイムライン（ポータルの最上部・メイン） */}
          <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 bg-primary/5">
              <Calendar size={16} className="text-primary" />
              <span className="font-bold text-sm">本日の予約</span>
              {!menuTodayLoading && (
                <span className="text-xs text-muted-foreground">（{menuTodayRes.length}件）</span>
              )}
            </div>
            {menuTodayLoading ? (
              <div className="py-5 text-center"><Loader2 size={16} className="animate-spin text-primary mx-auto" /></div>
            ) : menuTodayRes.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-5">本日の予約はまだありません</p>
            ) : (
              <div className="divide-y">
                {menuTodayRes.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex gap-3 items-start">
                    <span className="text-sm font-bold tabular-nums text-primary w-12 shrink-0 pt-0.5">
                      {toExtTime(r.start_time)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {r.customer_name} 様
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{r.duration}分</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.course_name}
                        {r.nomination_type ? ` · ${r.nomination_type}` : ""}
                        {r.room ? ` · ${r.room}` : ""}
                      </p>
                      {r.options && r.options.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">➕ {r.options.join("、")}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current month shift widget */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center justify-between bg-muted/30"
              onClick={() => setShiftExpanded(v => !v)}
            >
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-primary" />
                <span className="font-semibold text-sm">
                  {format(now, "M月", { locale: ja })}のシフト
                </span>
                {!menuShiftLoading && (
                  <span className="text-xs text-muted-foreground">
                    （{menuShiftRows.filter(s => s.approval_status !== "rejected").length}件確定）
                  </span>
                )}
              </div>
              {shiftExpanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
            </button>

            {/* Always show upcoming shifts (next 5 days preview); expand for full list */}
            {menuShiftLoading ? (
              <div className="py-4 text-center"><Loader2 size={16} className="animate-spin text-primary mx-auto" /></div>
            ) : menuShiftRows.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-4">{format(now, "M月", { locale: ja })}のシフトはまだありません</p>
            ) : (
              <div className="divide-y">
                {(shiftExpanded ? menuShiftRows : menuShiftRows.filter(s => s.approval_status !== "rejected").slice(0, 5)).map((s) => {
                  const isToday = isSameDay(new Date(s.shift_date), now);
                  const dateStr = format(new Date(s.shift_date), "yyyy-MM-dd");
                  const isOpen = expandedShiftDate === dateStr;
                  // その営業日の予約（深夜またぎ：翌日の06時前を含む）
                  const nextStr = format(addDays(new Date(s.shift_date), 1), "yyyy-MM-dd");
                  const dayResv = menuAllUpcoming
                    .filter((r) =>
                      (r.reservation_date === dateStr && r.start_time >= "06:00") ||
                      (r.reservation_date === nextStr && r.start_time < "06:00"))
                    .sort((a, b) => {
                      const ext = (r: UpcomingReservation) => {
                        const [h, m] = r.start_time.split(":").map(Number);
                        return (h < 6 ? h + 24 : h) * 60 + m;
                      };
                      return ext(a) - ext(b);
                    });
                  return (
                    <div key={s.id}>
                      <button
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${isToday ? "bg-primary/5" : ""} ${isOpen ? "bg-muted/40" : "hover:bg-muted/20"}`}
                        onClick={() => setExpandedShiftDate(isOpen ? null : dateStr)}
                      >
                        <div className="text-xs whitespace-nowrap w-14">
                          <p className={`font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                            {format(new Date(s.shift_date), "M/d", { locale: ja })}
                            {isToday && <span className="ml-1 text-[10px]">今日</span>}
                          </p>
                          <p className="text-muted-foreground">{format(new Date(s.shift_date), "(E)", { locale: ja })}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${s.approval_status === "rejected" ? "line-through text-muted-foreground" : "font-medium"}`}>
                            {s.start_time.slice(0, 5)}〜 {s.end_time.slice(0, 5)}
                          </p>
                          <p className="text-xs">
                            {s.room && s.approval_status === "approved" && <span className="text-primary">{s.room}</span>}
                            {dayResv.length > 0 && (
                              <span className="text-muted-foreground">{s.room && s.approval_status === "approved" ? " ・ " : ""}予約{dayResv.length}件</span>
                            )}
                          </p>
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${shiftStatusBadge[s.approval_status] ?? "bg-muted text-muted-foreground"}`}>
                          {shiftStatusLabel[s.approval_status] ?? s.approval_status}
                        </span>
                        <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 pt-1 bg-muted/20">
                          {dayResv.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2 text-center">この日の予約はまだありません</p>
                          ) : (
                            <div className="space-y-1.5">
                              {dayResv.map((r) => (
                                <div key={r.id} className="rounded-lg bg-card border px-3 py-2 flex gap-2">
                                  <span className="text-sm font-bold text-primary tabular-nums shrink-0">{toExtTime(r.start_time)}〜</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {r.customer_name} 様
                                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">{r.duration}分</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {r.course_name}
                                      {r.nomination_type ? ` ・ ${r.nomination_type}` : ""}
                                      {r.room ? ` ・ ${r.room}` : ""}
                                    </p>
                                    {r.options && r.options.length > 0 && (
                                      <p className="text-xs text-muted-foreground truncate">➕ {r.options.join("、")}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!shiftExpanded && menuShiftRows.filter(s => s.approval_status !== "rejected").length > 5 && (
                  <button
                    className="w-full py-2 text-xs text-primary text-center hover:bg-muted/30 transition-colors"
                    onClick={() => setShiftExpanded(true)}
                  >
                    残り{menuShiftRows.filter(s => s.approval_status !== "rejected").length - 5}件をすべて表示
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  onClick={item.action}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left w-full"
                >
                  <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* あなた専用の予約ページ */}
          {(() => {
            const bookingUrl = getCastBookingUrl(bookingBaseUrl, cast.id);
            return (
              <div className="rounded-xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2 border-b border-pink-100">
                  <Heart size={15} className="text-rose-400 fill-rose-300" />
                  <p className="font-semibold text-sm text-rose-500">あなた専用の予約ページ</p>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    このリンクをSNSのプロフィールやお客様へのメッセージに貼ると、あなた宛ての予約リクエストが直接届きます💕
                  </p>
                  <code className="block bg-white/80 border border-pink-100 px-3 py-2 rounded-lg text-xs font-mono break-all text-rose-500">
                    {bookingUrl}
                  </code>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-rose-400 hover:bg-rose-500"
                      onClick={() => {
                        navigator.clipboard.writeText(bookingUrl).then(() => {
                          setBookingLinkCopied(true);
                          toast.success("リンクをコピーしました");
                          setTimeout(() => setBookingLinkCopied(false), 2000);
                        });
                      }}
                    >
                      {bookingLinkCopied ? <Check size={15} className="mr-1.5" /> : <Copy size={15} className="mr-1.5" />}
                      {bookingLinkCopied ? "コピーしました" : "リンクをコピー"}
                    </Button>
                    <Button variant="outline" className="border-pink-200" onClick={() => window.open(bookingUrl, "_blank")}>
                      <ExternalLink size={15} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 投稿ネタ（官能小説風・参考例） */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center justify-between bg-muted/30"
              onClick={() => setIdeasOpen((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Edit size={15} className="text-primary" />
                <span className="font-semibold text-sm">投稿ネタ（コピペOK・参考例）</span>
              </div>
              {ideasOpen ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
            </button>
            {ideasOpen && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  官能小説風の投稿例です。そのままコピペOK♡ 名前や状況を少し変えるとより自然になります。
                </p>
                {POST_IDEAS.map((idea, idx) => (
                  <div key={idx} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-bold text-foreground">{idea.title}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${idea.title}\n\n${idea.body}`).then(() => {
                            setCopiedIdeaIdx(idx);
                            toast.success("コピーしました");
                            setTimeout(() => setCopiedIdeaIdx((c) => (c === idx ? null : c)), 2000);
                          });
                        }}
                        className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                      >
                        {copiedIdeaIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                        {copiedIdeaIdx === idx ? "コピー済" : "コピー"}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{idea.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 外部サイト連携（O2・X） */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
              <ExternalLink size={15} className="text-primary" />
              <p className="font-semibold text-sm">外部サイト登録・連携</p>
            </div>
            <div className="p-4 space-y-4">
              {(["o2", "x", "esutama", "ranking"] as const).map((site) => (
                <div key={site}>
                  <p className="text-sm font-medium mb-2">{SITE_LABEL[site]}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setGuideSite(site)}>
                      <FileText size={15} className="mr-1.5" />登録URLはこちら
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => openLink(site)}>
                      <Send size={15} className="mr-1.5" />既に登録済みで連携
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                「登録URLはこちら」で新規登録方法を確認、「連携」でログイン情報を登録すると自動投稿が使えます。
              </p>
            </div>
          </div>
          </div>
        )}

        {/* ── SHIFT ── */}
        {view === "shift" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground p-1">
                <ChevronLeft size={20} />
              </button>
              <span className="font-bold text-base">{monthLabel}</span>
              <button onClick={nextMonth} className="text-muted-foreground hover:text-foreground p-1">
                <ChevronLeft size={20} className="rotate-180" />
              </button>
            </div>

            {shiftsLoading ? (
              <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : shiftRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">{monthLabel}のシフトはありません</div>
            ) : (
              <div className="rounded-xl border overflow-hidden divide-y">
                {shiftRows.map((s) => (
                  <div key={s.id} className="px-3 py-3 flex items-center gap-3">
                    <div className="text-xs text-muted-foreground whitespace-nowrap w-16">
                      <p className="font-semibold text-foreground">
                        {format(new Date(s.shift_date), "M/d", { locale: ja })}
                      </p>
                      <p>{format(new Date(s.shift_date), "(E)", { locale: ja })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${s.approval_status === "rejected" ? "line-through text-muted-foreground" : ""}`}>
                          {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                        </p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${shiftStatusBadge[s.approval_status] ?? "bg-muted text-muted-foreground"}`}>
                          {shiftStatusLabel[s.approval_status] ?? s.approval_status}
                        </span>
                      </div>
                      {s.room && s.approval_status === "approved" && (
                        <p className="text-xs text-primary font-medium mt-0.5">
                          ルーム：{s.room}
                        </p>
                      )}
                      {s.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.notes}</p>
                      )}
                      {s.approval_comment && (
                        <p className={`text-xs mt-0.5 ${s.approval_status === 'rejected' ? 'text-rose-600' : 'text-muted-foreground'}`}>
                          💬 {s.approval_comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── UPCOMING RESERVATIONS（事前予約） ── */}
        {view === "upcoming" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              今日以降に入っている確定予約の一覧です。深夜（24時以降）の予約は翌日の日付で表示されます。
            </p>
            {upcomingLoading ? (
              <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">今後の予約はまだありません</div>
            ) : (
              (() => {
                const byDate = new Map<string, UpcomingReservation[]>();
                for (const r of upcoming) {
                  if (!byDate.has(r.reservation_date)) byDate.set(r.reservation_date, []);
                  byDate.get(r.reservation_date)!.push(r);
                }
                return (
                  <div className="space-y-3">
                    {[...byDate.entries()].map(([date, rows]) => {
                      const isToday = isSameDay(new Date(date), now);
                      return (
                        <div key={date} className="rounded-xl border bg-card overflow-hidden">
                          <div className={`px-4 py-2 text-sm font-bold flex items-center gap-2 ${isToday ? "bg-primary/10 text-primary" : "bg-muted/40"}`}>
                            {format(new Date(date), "M月d日(E)", { locale: ja })}
                            {isToday && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">今日</span>}
                            <span className="ml-auto text-xs font-normal text-muted-foreground">{rows.length}件</span>
                          </div>
                          <div className="divide-y">
                            {rows.map((r) => (
                              <div key={r.id} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold tabular-nums">{r.start_time}〜</span>
                                  <span className="text-sm font-medium truncate">{r.course_name}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">{r.duration}分</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                  <span>{r.customer_name} 様</span>
                                  {r.nomination_type && <span>{r.nomination_type}</span>}
                                  {r.room && <span className="text-primary">🏠 {r.room}</span>}
                                </div>
                                {r.options && r.options.length > 0 && (
                                  <p className="mt-1 text-xs text-muted-foreground">➕ {r.options.join("、")}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ── SETTLEMENT ── */}
        {view === "settlement" && (
          <div className="space-y-4">
            {/* Month selector */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground p-1">
                <ChevronLeft size={20} />
              </button>
              <span className="font-bold text-base">{monthLabel}</span>
              <button
                onClick={nextMonth}
                className="text-muted-foreground hover:text-foreground p-1"
                disabled={year === now.getFullYear() && month === now.getMonth() + 1}
              >
                <ChevronLeft size={20} className="rotate-180" />
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">件数</p>
                <p className="text-xl font-bold mt-0.5">{settlements.length}<span className="text-sm font-normal ml-0.5">件</span></p>
              </div>
              <div className="rounded-xl border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">売上合計</p>
                <p className="text-lg font-bold mt-0.5 text-primary">¥{totalPrice.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">バック合計</p>
                <p className="text-lg font-bold mt-0.5 text-green-600">¥{totalBack.toLocaleString()}</p>
              </div>
            </div>

            {/* Reservation list */}
            {settlementLoading ? (
              <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">{monthLabel}の予約はありません</div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 text-xs font-semibold text-muted-foreground bg-muted/40 px-3 py-2">
                  <span>日時</span><span className="ml-3">コース</span><span className="text-right pr-2">売上</span><span className="text-right">バック</span>
                </div>
                <div className="divide-y">
                  {settlements.map((r) => (
                    <div key={r.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-0 px-3 py-2.5 items-center">
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        <p>{format(new Date(r.reservation_date), "M/d(E)", { locale: ja })}</p>
                        <p>{r.start_time}</p>
                      </div>
                      <div className="ml-3 min-w-0">
                        <p className="text-sm font-medium truncate">{r.course_name}</p>
                        <p className="text-xs text-muted-foreground">{r.duration}分 · {statusLabel[r.status] ?? r.status}</p>
                      </div>
                      <p className="text-sm font-semibold text-right pr-2">¥{r.customer_price.toLocaleString()}</p>
                      <p className="text-sm font-semibold text-right text-green-600">¥{r.therapist_back.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRANSPORT EXPENSE ── */}
        {view === "transport" && (
          <div className="space-y-5">
            {/* Month selector */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="text-muted-foreground hover:text-foreground p-1">
                <ChevronLeft size={20} />
              </button>
              <span className="font-bold text-base">{monthLabel}</span>
              <button
                onClick={nextMonth}
                className="text-muted-foreground hover:text-foreground p-1"
                disabled={year === now.getFullYear() && month === now.getMonth() + 1}
              >
                <ChevronLeft size={20} className="rotate-180" />
              </button>
            </div>

            {/* Submit form */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <p className="font-semibold text-sm">新規申請</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">日付</Label>
                  <Input
                    type="date"
                    value={transportForm.date}
                    onChange={e => setTransportForm(f => ({ ...f, date: e.target.value }))}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">金額（円）</Label>
                  <Input
                    type="number"
                    placeholder="1500"
                    value={transportForm.amount}
                    onChange={e => setTransportForm(f => ({ ...f, amount: e.target.value }))}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">経路</Label>
                <Input
                  placeholder="例：自宅駅 → 仙台駅"
                  value={transportForm.route}
                  onChange={e => setTransportForm(f => ({ ...f, route: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">備考</Label>
                <Textarea
                  placeholder="任意"
                  value={transportForm.notes}
                  onChange={e => setTransportForm(f => ({ ...f, notes: e.target.value }))}
                  className="mt-1 text-sm resize-none"
                  rows={2}
                />
              </div>
              <Button onClick={handleTransportSubmit} disabled={submitting} className="w-full h-9">
                <Send size={14} className="mr-2" />
                {submitting ? "申請中..." : "申請する"}
              </Button>
            </div>

            {/* History */}
            <div>
              <p className="font-semibold text-sm mb-2">{monthLabel}の申請履歴</p>
              {expensesLoading ? (
                <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>
              ) : expenses.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">{monthLabel}の申請はありません</p>
              ) : (
                <div className="rounded-xl border overflow-hidden divide-y">
                  {expenses.map(e => (
                    <div key={e.id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">¥{e.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(e.expense_date), "M/d(E)", { locale: ja })}
                          {e.route && ` · ${e.route}`}
                        </p>
                        {e.notes && <p className="text-xs text-muted-foreground truncate">{e.notes}</p>}
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${expenseStatusColor[e.status] ?? ""}`}>
                        {expenseStatusLabel[e.status] ?? e.status}
                      </span>
                    </div>
                  ))}
                  <div className="px-3 py-2 bg-muted/30 flex justify-between text-sm font-semibold">
                    <span>合計</span>
                    <span>¥{totalExpenses.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── CUSTOMERS（顧客カルテ） ── */}
        {view === "customers" && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="お客様の名前で検索"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {customersLoading ? (
              <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
            ) : therapistCustomers.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">担当したお客様がまだいません</p>
            ) : (
              <div className="space-y-2">
                {therapistCustomers
                  .filter((c) => !customerSearch.trim() || c.name?.toLowerCase().includes(customerSearch.trim().toLowerCase()))
                  .map((c) => {
                    const expanded = expandedCustomer === c.customer_id;
                    const hasPrefs = c.preferred_pressure || c.concern_areas?.length || c.conversation_level || c.ng_items;
                    return (
                      <div key={c.customer_id} className="rounded-xl border bg-card overflow-hidden">
                        <button
                          className="w-full px-4 py-3 flex items-center gap-3 text-left"
                          onClick={() => setExpandedCustomer(expanded ? null : c.customer_id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm flex items-center gap-1.5">
                              {c.name}様
                              {hasPrefs && <Heart size={11} className="text-rose-400 shrink-0" />}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              担当{c.my_visit_count}回
                              {c.my_last_visit && ` · 最終 ${format(new Date(c.my_last_visit), "M/d", { locale: ja })}`}
                              {c.visit_count != null && ` · 全${c.visit_count}回来店`}
                            </p>
                          </div>
                          {expanded ? <ChevronUp size={15} className="text-muted-foreground shrink-0" /> : <ChevronDown size={15} className="text-muted-foreground shrink-0" />}
                        </button>
                        {expanded && (
                          <div className="px-4 pb-4 pt-2 border-t space-y-2 text-sm">
                            {hasPrefs ? (
                              <>
                                {c.preferred_pressure && <p>圧の好み：<strong>{c.preferred_pressure}</strong></p>}
                                {c.concern_areas?.length ? <p>気になる部位：<strong>{c.concern_areas.join("・")}</strong></p> : null}
                                {c.conversation_level && <p>会話：<strong>{c.conversation_level}</strong></p>}
                                {c.ng_items && <p className="text-orange-600 font-medium">⚠️ NG：{c.ng_items}</p>}
                              </>
                            ) : (
                              <p className="text-muted-foreground text-xs">好み情報はまだ登録されていません</p>
                            )}
                            {c.notes && (
                              <p className="text-xs text-muted-foreground border-t pt-1.5">管理メモ：{c.notes}</p>
                            )}

                            {/* 接客した日（毎回の来店日） */}
                            {c.my_visit_dates?.length ? (
                              <div className="border-t pt-2">
                                <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                                  接客した日（{c.my_visit_count}回）
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {c.my_visit_dates.map((d) => (
                                    <span
                                      key={d}
                                      className="text-xs bg-muted rounded-md px-1.5 py-0.5 text-muted-foreground"
                                    >
                                      {format(new Date(d), "yyyy/M/d(E)", { locale: ja })}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {/* セラピストメモ（編集可） */}
                            <div className="border-t pt-2">
                              <p className="text-xs font-semibold text-muted-foreground mb-1.5">自分メモ</p>
                              {notesEditing === c.customer_id ? (
                                <div className="space-y-1.5">
                                  <textarea
                                    value={notesValue}
                                    onChange={(e) => setNotesValue(e.target.value)}
                                    placeholder="施術の感想・次回への引き継ぎなど"
                                    rows={3}
                                    className="w-full rounded-md border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => handleSaveNotes(c.customer_id)}
                                      disabled={notesSaving}
                                      className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60"
                                    >
                                      {notesSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                      保存
                                    </button>
                                    <button
                                      onClick={() => setNotesEditing(null)}
                                      className="h-7 w-7 flex items-center justify-center rounded-md border text-muted-foreground hover:text-foreground"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <p className="flex-1 text-xs text-muted-foreground whitespace-pre-wrap">
                                    {c.preference_notes || <span className="italic">メモなし</span>}
                                  </p>
                                  <button
                                    onClick={() => {
                                      setNotesEditing(c.customer_id);
                                      setNotesValue(c.preference_notes ?? "");
                                    }}
                                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                  >
                                    <PencilLine size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── ENTRY ── */}
        {view === "entry" && (
          <div className="space-y-4">
            {rooms.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">入室方法の情報がありません</p>
            ) : (
              rooms.map(room => (
                <div key={room.id} className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b">
                    <p className="font-bold text-base">{room.name}</p>
                  </div>
                  <div className="px-4 py-4 space-y-4">
                    {room.key_number && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">暗証番号</p>
                        <p className="text-2xl font-mono font-bold tracking-widest text-primary">{room.key_number}</p>
                      </div>
                    )}
                    {room.entry_flow && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">入室手順</p>
                        <p className="text-sm whitespace-pre-wrap">{room.entry_flow}</p>
                      </div>
                    )}
                    {room.key_info && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">鍵の場所・補足</p>
                        <p className="text-sm whitespace-pre-wrap">{room.key_info}</p>
                      </div>
                    )}
                    {room.entry_photos && room.entry_photos.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">写真</p>
                        <div className="grid grid-cols-2 gap-2">
                          {room.entry_photos.map((url, i) => (
                            <img key={i} src={url} alt={`入室方法 ${i+1}`} className="w-full rounded-lg object-cover aspect-square" />
                          ))}
                        </div>
                      </div>
                    )}
                    {!room.key_number && !room.entry_flow && !room.key_info && (!room.entry_photos || room.entry_photos.length === 0) && (
                      <p className="text-sm text-muted-foreground">入室方法の情報が登録されていません</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Back rates dialog */}
      <Dialog open={showBackRates} onOpenChange={setShowBackRates}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>バック表</DialogTitle></DialogHeader>
          <img src={backRatesImage} alt="バック表" className="w-full h-auto mt-2" />
        </DialogContent>
      </Dialog>

      {/* 登録ガイド（PDF）ポップアップ */}
      <Dialog open={!!guideSite} onOpenChange={(o) => !o && setGuideSite(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{guideSite ? `${SITE_LABEL[guideSite]} 登録方法` : ""}</DialogTitle>
          </DialogHeader>
          {guideSite === "o2" ? (
            <iframe src="/o2-register-guide.pdf" title="O2登録ガイド" className="w-full h-[70vh] rounded border" />
          ) : (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {guideSite === "esutama" && "エスたまの魂の新規登録は公式サイトから行えます。"}
                {guideSite === "x" && "X（旧Twitter）の新規登録は公式サイトから行えます。"}
                {guideSite === "ranking" && "メンズエステランキングの新規登録は公式サイトから行えます。"}
              </p>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <a href={guideSite ? REGISTER_URLS[guideSite] : "#"} target="_blank" rel="noopener noreferrer">
              <Button>
                <ExternalLink size={15} className="mr-1.5" />登録ページを開く
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* 連携（ログイン情報登録）ダイアログ */}
      <Dialog open={!!linkSite} onOpenChange={(o) => !o && setLinkSite(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{linkSite ? `${SITE_LABEL[linkSite]} と連携` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-xs text-muted-foreground">
              登録済みのアカウントのログイン情報を入力してください。投稿時に自動でログインして投稿します。
            </p>
            <div>
              <Label className="text-xs">ログインID</Label>
              <Input value={linkForm.login_id} onChange={(e) => setLinkForm({ ...linkForm, login_id: e.target.value })} placeholder="ID" />
            </div>
            <div>
              <Label className="text-xs">パスワード</Label>
              <Input type="password" value={linkForm.password} onChange={(e) => setLinkForm({ ...linkForm, password: e.target.value })} placeholder="password" />
            </div>
            <Button className="w-full" onClick={saveLink} disabled={linkSaving}>
              {linkSaving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Send size={14} className="mr-1.5" />}
              連携する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
