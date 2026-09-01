import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const ENKA_STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";
const LEGACY_STORE_ID = "00000000-0000-0000-0000-000000000001";
const STORE_NAME = "艶華";
const STORE_SLUG = "tsuyaka";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const OPERATING_START_MINUTE = 11 * 60;
const OPERATING_END_MINUTE = (24 + 2) * 60;
const PAGE_SIZE = 1_000;

const corsHeaders = {
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type ReservationRow = {
  id: string;
  store_id: string;
  cast_id: string | null;
  reservation_date: string;
  start_time: string;
  duration: number | null;
  price: number | null;
  payment_fee: number | null;
  status: string;
  nomination_type: string | null;
  options: string[] | null;
  customer_phone: string | null;
  updated_at?: string | null;
};

type CastRow = {
  id: string;
  name: string;
  is_active: boolean;
  is_visible: boolean;
  is_estama_dummy: boolean;
  updated_at: string | null;
};

type ShiftRow = {
  id: string;
  cast_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  status: string | null;
  approval_status: string | null;
  updated_at: string | null;
};

type CastPostRow = {
  id: string;
  cast_id: string;
  posted_at: string | null;
  o2_status: string | null;
  hp_status: string | null;
  esutama_status: string | null;
};

type CastDiaryRow = {
  id: string;
  cast_id: string;
  posted_at: string | null;
};

type InquiryRow = { id: string; inquired_at: string };
type WebInquiryRow = { id: string; created_at: string };
type ExternalReportRow = { id: string; report_date: string; inquiry_count: number | null };
type ClearanceRow = { id: string; date: string; therapist_back: number | null };
type AdvertisingRow = {
  id: string;
  date: string;
  cost: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
};
type NewsletterRow = { id: string; sent_at: string | null; status: string | null };
type RoomRow = { id: string; name: string };
type ShopSettingsRow = { business_day_start: string | null };

type KpiEntry = {
  externalId: string;
  businessDate: string;
  metricKey: string;
  personExternalId: string | null;
  value: number;
};

type MutableEntry = Omit<KpiEntry, "externalId">;
type Interval = [number, number];

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function parseKeySet(raw: string | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.values(parsed).filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    return [] as string[];
  }
}

function publishableKeys() {
  return [
    ...parseKeySet(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")),
    Deno.env.get("SUPABASE_ANON_KEY"),
  ].filter((value): value is string => Boolean(value));
}

function adminKey() {
  const modern = parseKeySet(Deno.env.get("SUPABASE_SECRET_KEYS"))[0];
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return modern || legacy || "";
}

function addMonths(date: string, amount: number) {
  const [year, month] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + amount, 1));
  return result.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
}

function daysInMonth(monthStart: string) {
  const end = addMonths(monthStart, 1);
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${monthStart}T00:00:00Z`)) / 86_400_000);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function clockMinute(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function reservationBusinessDate(reservation: ReservationRow, businessDayStartMinute: number) {
  const startMinute = clockMinute(reservation.start_time);
  return startMinute !== null && startMinute < businessDayStartMinute
    ? addDays(reservation.reservation_date, -1)
    : reservation.reservation_date;
}

function jstDate(timestamp: string) {
  return new Date(Date.parse(timestamp) + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function normalizePhone(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function parseOperationalMinute(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 47 || minute < 0 || minute > 59) return null;
  if (hour < 6) hour += 24;
  return hour * 60 + minute;
}

function clippedInterval(startTime: string, endTime: string): Interval | null {
  const start = parseOperationalMinute(startTime);
  let end = parseOperationalMinute(endTime);
  if (start === null || end === null || start === end) return null;
  if (end < start) end += 24 * 60;
  const clippedStart = Math.max(start, OPERATING_START_MINUTE);
  const clippedEnd = Math.min(end, OPERATING_END_MINUTE);
  return clippedEnd > clippedStart ? [clippedStart, clippedEnd] : null;
}

function mergedMinutes(intervals: Interval[]) {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [[sorted[0][0], sorted[0][1]]];
  for (const [start, end] of sorted.slice(1)) {
    const latest = merged[merged.length - 1];
    if (start <= latest[1]) latest[1] = Math.max(latest[1], end);
    else merged.push([start, end]);
  }
  return merged.reduce((total, [start, end]) => total + end - start, 0);
}

function isNominated(value: string | null) {
  const normalized = value?.trim() ?? "";
  return Boolean(normalized) && !["none", "フリー", "指名なし"].includes(normalized);
}

function qualifyShift(shift: ShiftRow) {
  return shift.approval_status === "approved" && shift.status !== "cancelled";
}

async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ;) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    if (!page.length) break;
    rows.push(...page);
    from += page.length;
  }
  return rows;
}

async function fetchReservationHistory(
  supabase: ReturnType<typeof createClient>,
  queryEnd: string,
) {
  return fetchAllPages<ReservationRow>((from, to) => supabase
      .from("reservations")
      .select("id,store_id,cast_id,reservation_date,start_time,duration,price,payment_fee,status,nomination_type,options,customer_phone")
      .in("store_id", [ENKA_STORE_ID, LEGACY_STORE_ID])
      .eq("status", "completed")
      .lt("reservation_date", queryEnd)
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: ReservationRow[] | null; error: unknown }>);
}

function buildEntries(args: {
  periodStart: string;
  periodEnd: string;
  businessDayStartMinute: number;
  reservations: ReservationRow[];
  history: ReservationRow[];
  casts: CastRow[];
  shifts: ShiftRow[];
  roomNames: string[];
  posts: CastPostRow[];
  diaries: CastDiaryRow[];
  inquiries: InquiryRow[];
  webInquiries: WebInquiryRow[];
  externalReports: ExternalReportRow[];
  clearances: ClearanceRow[];
  advertising: AdvertisingRow[];
  newsletters: NewsletterRow[];
}) {
  const values = new Map<string, MutableEntry>();
  const add = (metricKey: string, businessDate: string, value: number, personExternalId: string | null = null) => {
    if (!Number.isFinite(value) || value < 0) return;
    // 個人別データは月合計だけを公開し、日別の勤務・売上パターンは返さない。
    const entryDate = personExternalId ? args.periodStart : businessDate;
    const key = `${entryDate}:${personExternalId ?? "store"}:${metricKey}`;
    const current = values.get(key);
    if (current) current.value += value;
    else values.set(key, { businessDate: entryDate, metricKey, personExternalId, value });
  };

  const storeZeroMetrics = [
    "sales",
    "therapist_payouts",
    "completed_visits",
    "new_customers",
    "repeat_customers",
    "inquiries",
    "confirmed_bookings",
    "cancellations",
    "room_used_minutes",
    "room_available_minutes",
    "email_sends",
    "ad_spend",
    "banner_impressions",
    "banner_clicks",
    "banner_bookings",
  ];
  storeZeroMetrics.forEach((metric) => add(metric, args.periodStart, 0));

  const personZeroMetrics = [
    "therapist_sales",
    "therapist_completed_visits",
    "nominated_visits",
    "work_minutes",
    "treatment_minutes",
    "shift_days",
    "photo_diary_posts",
    "therapist_02_posts",
    "option_visits",
  ];
  args.casts.forEach((cast) => personZeroMetrics.forEach((metric) => add(metric, args.periodStart, 0, cast.id)));

  const publicCastIds = new Set(args.casts.map((cast) => cast.id));
  const earliestByPhone = new Map<string, string>();
  const sortedHistory = [...args.history].sort((a, b) =>
    reservationBusinessDate(a, args.businessDayStartMinute).localeCompare(
      reservationBusinessDate(b, args.businessDayStartMinute),
    ) || a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id),
  );
  for (const reservation of sortedHistory) {
    const phone = normalizePhone(reservation.customer_phone);
    if (!phone || earliestByPhone.has(phone)) continue;
    earliestByPhone.set(phone, reservation.id);
  }

  let unclassifiedVisits = 0;
  for (const reservation of args.reservations) {
    const date = reservationBusinessDate(reservation, args.businessDayStartMinute);
    if (date < args.periodStart || date >= args.periodEnd) continue;
    const revenue = (reservation.price ?? 0) + (reservation.payment_fee ?? 0);
    if (reservation.status === "completed") {
      add("sales", date, revenue);
      add("completed_visits", date, 1);
      add("confirmed_bookings", date, 1);

      const phone = normalizePhone(reservation.customer_phone);
      if (!phone) unclassifiedVisits += 1;
      else if (earliestByPhone.get(phone) === reservation.id) add("new_customers", date, 1);
      else add("repeat_customers", date, 1);

      if (reservation.cast_id && publicCastIds.has(reservation.cast_id)) {
        add("therapist_sales", date, revenue, reservation.cast_id);
        add("therapist_completed_visits", date, 1, reservation.cast_id);
        add("treatment_minutes", date, reservation.duration ?? 0, reservation.cast_id);
        if (isNominated(reservation.nomination_type)) add("nominated_visits", date, 1, reservation.cast_id);
        if ((reservation.options ?? []).length > 0) add("option_visits", date, 1, reservation.cast_id);
      }
    } else if (reservation.status === "confirmed") {
      add("confirmed_bookings", date, 1);
    } else if (reservation.status === "cancelled") {
      add("cancellations", date, 1);
    }
  }

  const personIntervals = new Map<string, Interval[]>();
  const roomIntervals = new Map<string, Interval[]>();
  const shiftDays = new Map<string, Set<string>>();
  const activeRooms = new Set(args.roomNames);
  for (const shift of args.shifts.filter(qualifyShift)) {
    const interval = clippedInterval(shift.start_time, shift.end_time);
    if (publicCastIds.has(shift.cast_id)) {
      const days = shiftDays.get(shift.cast_id) ?? new Set<string>();
      days.add(shift.shift_date);
      shiftDays.set(shift.cast_id, days);
      if (interval) {
        const personKey = `${shift.cast_id}:${shift.shift_date}`;
        personIntervals.set(personKey, [...(personIntervals.get(personKey) ?? []), interval]);
      }
    }
    if (interval && shift.room && activeRooms.has(shift.room)) {
      const roomKey = `${shift.shift_date}:${shift.room}`;
      roomIntervals.set(roomKey, [...(roomIntervals.get(roomKey) ?? []), interval]);
    }
  }
  for (const [key, intervals] of personIntervals) {
    const [castId, date] = key.split(":");
    add("work_minutes", date, mergedMinutes(intervals), castId);
  }
  for (const [castId, dates] of shiftDays) {
    for (const date of dates) add("shift_days", date, 1, castId);
  }
  for (const [key, intervals] of roomIntervals) {
    const date = key.slice(0, 10);
    const valueKey = `${date}:store:room_used_minutes`;
    const current = values.get(valueKey);
    const minutes = mergedMinutes(intervals);
    if (current) current.value += minutes;
    else add("room_used_minutes", date, minutes);
  }
  const capacityPerDay = activeRooms.size * (OPERATING_END_MINUTE - OPERATING_START_MINUTE);
  for (let day = 0; day < daysInMonth(args.periodStart); day += 1) {
    const date = new Date(Date.parse(`${args.periodStart}T00:00:00Z`) + day * 86_400_000).toISOString().slice(0, 10);
    add("room_available_minutes", date, capacityPerDay);
  }

  for (const post of args.posts) {
    if (!post.posted_at || !publicCastIds.has(post.cast_id)) continue;
    const date = jstDate(post.posted_at);
    if (post.o2_status === "posted") add("therapist_02_posts", date, 1, post.cast_id);
  }
  for (const diary of args.diaries) {
    if (diary.posted_at && publicCastIds.has(diary.cast_id)) {
      add("photo_diary_posts", jstDate(diary.posted_at), 1, diary.cast_id);
    }
  }
  for (const inquiry of args.inquiries) add("inquiries", jstDate(inquiry.inquired_at), 1);
  for (const inquiry of args.webInquiries) add("inquiries", jstDate(inquiry.created_at), 1);
  for (const report of args.externalReports) add("inquiries", report.report_date, report.inquiry_count ?? 0);
  for (const clearance of args.clearances) add("therapist_payouts", clearance.date, clearance.therapist_back ?? 0);
  for (const row of args.advertising) {
    add("ad_spend", row.date, row.cost ?? 0);
    add("banner_impressions", row.date, row.impressions ?? 0);
    add("banner_clicks", row.date, row.clicks ?? 0);
    add("banner_bookings", row.date, row.conversions ?? 0);
  }
  for (const campaign of args.newsletters) {
    if (campaign.sent_at && campaign.status === "sent") add("email_sends", jstDate(campaign.sent_at), 1);
  }

  const entries = [...values.values()]
    .filter((entry) => entry.businessDate >= args.periodStart && entry.businessDate < args.periodEnd)
    .map((entry): KpiEntry => ({
      ...entry,
      value: Math.max(0, Math.round(entry.value * 100) / 100),
      externalId: `${args.periodStart}:${entry.businessDate}:${entry.personExternalId ?? "store"}:${entry.metricKey}`,
    }))
    .sort((a, b) => a.externalId.localeCompare(b.externalId));

  return { entries, unclassifiedVisits, shiftDays };
}

function planningBasis(history: ReservationRow[], periodStart: string, businessDayStartMinute: number) {
  const byMonth = new Map<string, { sales: number; visits: number; prices: number[] }>();
  for (const reservation of history) {
    const date = reservationBusinessDate(reservation, businessDayStartMinute);
    if (reservation.store_id !== ENKA_STORE_ID || date >= periodStart) continue;
    const key = monthKey(date);
    const current = byMonth.get(key) ?? { sales: 0, visits: 0, prices: [] };
    const price = (reservation.price ?? 0) + (reservation.payment_fee ?? 0);
    current.sales += price;
    current.visits += 1;
    current.prices.push(price);
    byMonth.set(key, current);
  }
  const latestMonth = [...byMonth.keys()].sort().at(-1);
  if (!latestMonth) return null;
  const row = byMonth.get(latestMonth)!;
  const prices = [...row.prices].sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  return {
    periodStart: `${latestMonth}-01`,
    sales: row.sales,
    completedVisits: row.visits,
    averageTicket: row.visits > 0 ? Math.round(row.sales / row.visits) : null,
    medianTicket: Math.round(median),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);

  const apiKey = req.headers.get("apikey") ?? "";
  if (!apiKey || !publishableKeys().includes(apiKey)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? "";
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
    return jsonResponse({ error: "month must be YYYY-MM" }, 400);
  }
  const periodStart = `${month}-01`;
  const periodEnd = addMonths(periodStart, 1);
  const minPeriod = "2025-01-01";
  const maxPeriod = new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 7) + "-01";
  if (periodStart < minPeriod || periodStart > maxPeriod) {
    return jsonResponse({ error: "month_out_of_range" }, 400);
  }

  const requestId = crypto.randomUUID();
  try {
    const secret = adminKey();
    if (!secret) throw new Error("Supabase admin key is not configured");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const queryEnd = addDays(periodEnd, 1);
    const periodStartIso = `${periodStart}T00:00:00+09:00`;
    const periodEndIso = `${periodEnd}T00:00:00+09:00`;
    const [
      casts,
      reservations,
      shifts,
      rooms,
      posts,
      inquiries,
      webInquiries,
      externalReports,
      clearances,
      advertising,
      newsletters,
      shopSettingsResult,
      history,
    ] = await Promise.all([
      fetchAllPages<CastRow>((from, to) => supabase
        .from("casts")
        .select("id,name,is_active,is_visible,is_estama_dummy,updated_at")
        .eq("store_id", ENKA_STORE_ID)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: CastRow[] | null; error: unknown }>),
      fetchAllPages<ReservationRow>((from, to) => supabase
        .from("reservations")
        .select("id,store_id,cast_id,reservation_date,start_time,duration,price,payment_fee,status,nomination_type,options,customer_phone,updated_at")
        .eq("store_id", ENKA_STORE_ID)
        .gte("reservation_date", periodStart)
        .lt("reservation_date", queryEnd)
        .order("reservation_date")
        .order("start_time")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: ReservationRow[] | null; error: unknown }>),
      fetchAllPages<ShiftRow>((from, to) => supabase
        .from("shifts")
        .select("id,cast_id,shift_date,start_time,end_time,room,status,approval_status,updated_at")
        .eq("store_id", ENKA_STORE_ID)
        .gte("shift_date", periodStart)
        .lt("shift_date", periodEnd)
        .order("shift_date")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: ShiftRow[] | null; error: unknown }>),
      fetchAllPages<RoomRow>((from, to) => supabase
        .from("rooms")
        .select("id,name")
        .eq("store_id", ENKA_STORE_ID)
        .eq("is_active", true)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: RoomRow[] | null; error: unknown }>),
      fetchAllPages<CastPostRow>((from, to) => supabase
        .from("cast_posts")
        .select("id,cast_id,posted_at,o2_status,hp_status,esutama_status")
        .eq("store_id", ENKA_STORE_ID)
        .gte("posted_at", periodStartIso)
        .lt("posted_at", periodEndIso)
        .order("posted_at")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: CastPostRow[] | null; error: unknown }>),
      fetchAllPages<InquiryRow>((from, to) => supabase
        .from("inquiries")
        .select("id,inquired_at")
        .eq("store_id", ENKA_STORE_ID)
        .gte("inquired_at", periodStartIso)
        .lt("inquired_at", periodEndIso)
        .order("inquired_at")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: InquiryRow[] | null; error: unknown }>),
      fetchAllPages<WebInquiryRow>((from, to) => supabase
        .from("reservations")
        .select("id,created_at")
        .eq("store_id", ENKA_STORE_ID)
        .in("booking_origin", ["web_form", "cast_form"])
        .gte("created_at", periodStartIso)
        .lt("created_at", periodEndIso)
        .order("created_at")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: WebInquiryRow[] | null; error: unknown }>),
      fetchAllPages<ExternalReportRow>((from, to) => supabase
        .from("external_daily_reports")
        .select("id,report_date,inquiry_count")
        .eq("store_id", ENKA_STORE_ID)
        .eq("provider", "estama")
        .gte("report_date", periodStart)
        .lt("report_date", periodEnd)
        .order("report_date")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: ExternalReportRow[] | null; error: unknown }>),
      fetchAllPages<ClearanceRow>((from, to) => supabase
        .from("daily_clearances")
        .select("id,date,therapist_back")
        .eq("store_id", ENKA_STORE_ID)
        .gte("date", periodStart)
        .lt("date", periodEnd)
        .order("date")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: ClearanceRow[] | null; error: unknown }>),
      fetchAllPages<AdvertisingRow>((from, to) => supabase
        .from("advertising_costs")
        .select("id,date,cost,impressions,clicks,conversions")
        .eq("store_id", ENKA_STORE_ID)
        .gte("date", periodStart)
        .lt("date", periodEnd)
        .order("date")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: AdvertisingRow[] | null; error: unknown }>),
      fetchAllPages<NewsletterRow>((from, to) => supabase
        .from("newsletter_campaigns")
        .select("id,sent_at,status")
        .eq("store_id", ENKA_STORE_ID)
        .gte("sent_at", periodStartIso)
        .lt("sent_at", periodEndIso)
        .order("sent_at")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: NewsletterRow[] | null; error: unknown }>),
      supabase
        .from("shop_settings")
        .select("business_day_start")
        .eq("store_id", ENKA_STORE_ID)
        .limit(1),
      fetchReservationHistory(supabase, queryEnd),
    ]);
    if (shopSettingsResult.error) throw shopSettingsResult.error;
    const settings = (shopSettingsResult.data?.[0] ?? null) as ShopSettingsRow | null;
    const businessDayStartMinute = clockMinute(settings?.business_day_start ?? "10:00") ?? 10 * 60;
    const shiftedCastIds = new Set(shifts.filter(qualifyShift).map((shift) => shift.cast_id));
    const relevantCasts = casts.filter((cast) =>
      cast.is_active && cast.is_visible && !cast.is_estama_dummy && shiftedCastIds.has(cast.id),
    );
    const castIds = relevantCasts.map((cast) => cast.id);
    let diaries: CastDiaryRow[] = [];
    if (castIds.length) {
      diaries = await fetchAllPages<CastDiaryRow>((from, to) => supabase
        .from("cast_diaries")
        .select("id,cast_id,posted_at")
        .in("cast_id", castIds)
        .gte("posted_at", periodStartIso)
        .lt("posted_at", periodEndIso)
        .order("posted_at")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: CastDiaryRow[] | null; error: unknown }>);
    }

    const { entries, unclassifiedVisits, shiftDays } = buildEntries({
      periodStart,
      periodEnd,
      businessDayStartMinute,
      reservations,
      history,
      casts: relevantCasts,
      shifts,
      roomNames: rooms.map((room) => room.name),
      posts,
      diaries,
      inquiries,
      webInquiries,
      externalReports,
      clearances,
      advertising,
      newsletters,
    });

    const sourceDates = [
      ...casts.map((cast) => cast.updated_at),
      ...reservations.map((reservation) => reservation.updated_at ?? null),
      ...shifts.map((shift) => shift.updated_at),
    ].filter((value): value is string => Boolean(value)).sort();

    return jsonResponse({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceUpdatedAt: sourceDates.at(-1) ?? null,
      store: { externalId: ENKA_STORE_ID, name: STORE_NAME, slug: STORE_SLUG },
      period: { start: periodStart, end: periodEnd },
      planningBasis: planningBasis(history, periodStart, businessDayStartMinute),
      people: relevantCasts.map((cast) => ({
        externalId: cast.id,
        name: cast.name,
        active: cast.is_active,
        visible: cast.is_visible,
        shiftDays: shiftDays.get(cast.id)?.size ?? 0,
      })),
      entries,
      quality: {
        completedVisits: reservations.filter((reservation) => {
          const date = reservationBusinessDate(reservation, businessDayStartMinute);
          return reservation.status === "completed" && date >= periodStart && date < periodEnd;
        }).length,
        unclassifiedCustomerVisits: unclassifiedVisits,
      },
    }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("public-kpi-summary failed", { requestId, error });
    return jsonResponse({ error: "kpi_summary_failed", requestId }, 500);
  }
});
