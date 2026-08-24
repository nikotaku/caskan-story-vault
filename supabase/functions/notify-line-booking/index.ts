import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_EMAIL = Deno.env.get("BOOKING_NOTIFY_EMAIL") || "saito.crow@gmail.com";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NotificationStatus = "not_attempted" | "sending" | "sent" | "failed" | "skipped";

interface NotifyRequest {
  reservation_id?: unknown;
  channels?: unknown;
}

type NotificationChannel = "line" | "email";

interface ReservationRecord {
  id: string;
  store_id: string;
  cast_id: string | null;
  created_by: string | null;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  start_time: string;
  duration: number;
  course_name: string;
  nomination_type: string | null;
  options: string[] | null;
  price: number;
  discount: number | null;
  discount_ids: string[] | null;
  payment_fee: number | null;
  payment_method: string | null;
  notes: string | null;
  referral_source: string | null;
  line_notification_status: NotificationStatus | null;
  email_notification_status: NotificationStatus | null;
  notification_attempt_count: number | null;
}

interface ChannelResult {
  ok: boolean;
  skipped?: boolean;
  errorCode?: string;
  providerRequestId?: string | null;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatBusinessDateTime(dateValue: string, timeValue: string) {
  const rawDate = dateValue.slice(0, 10);
  const [hour = 0, minute = 0] = timeValue.slice(0, 5).split(":").map(Number);
  const date = new Date(`${rawDate}T12:00:00Z`);
  let displayHour = hour;
  if (hour < 6) {
    date.setUTCDate(date.getUTCDate() - 1);
    displayHour += 24;
  }
  const weekday = new Intl.DateTimeFormat("ja-JP", {
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
  const dateText = `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日(${weekday})`;
  return {
    dateText,
    timeText: `${displayHour}:${String(minute).padStart(2, "0")}`,
  };
}

function normalizePaymentMethod(value: string | null) {
  return (value || "").replace(/\s+/g, "").toLowerCase();
}

function paymentMethodsMatch(settingMethod: string | null, reservationMethod: string | null) {
  const setting = normalizePaymentMethod(settingMethod);
  const reservation = normalizePaymentMethod(reservationMethod);
  if (reservation === "card") return /(card|カード|クレジット)/i.test(setting);
  if (reservation === "paypay") return /paypay/i.test(setting);
  if (reservation === "cash") return /(cash|現金)/i.test(setting);
  return setting === reservation;
}

function optionDisplayName(name: string) {
  if (name === "全力PKG1W") return "双艶 -そうえん-";
  if (name === "全力PKG2W") return "艶結 -えんむすび-";
  return name;
}

async function sendLine(
  message: string,
  token: string | null,
  groupId: string | null,
  retryKey: string,
): Promise<ChannelResult> {
  if (!token) return { ok: false, errorCode: "line_token_missing" };
  if (!groupId) return { ok: false, errorCode: "line_destination_missing" };

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Line-Retry-Key": retryKey,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: "text", text: message }],
      }),
    });

    const requestId = response.headers.get("x-line-request-id")
      || response.headers.get("x-line-accepted-request-id");
    if (response.ok) return { ok: true, providerRequestId: requestId };

    if (response.status === 409 && response.headers.get("x-line-accepted-request-id")) {
      return { ok: true, providerRequestId: requestId };
    }

    console.error("LINE booking notification failed", {
      status: response.status,
      requestId,
    });
    return { ok: false, errorCode: `line_http_${response.status}`, providerRequestId: requestId };
  } catch {
    console.error("LINE booking notification network error");
    return { ok: false, errorCode: "line_network_error" };
  }
}

async function sendEmail(
  subject: string,
  message: string,
  reservationId: string,
): Promise<ChannelResult> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { ok: true, skipped: true };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
        "Idempotency-Key": `web-booking/${reservationId}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "onboarding@resend.dev",
        to: [NOTIFY_EMAIL],
        subject,
        text: message,
      }),
    });

    const body = await response.json().catch(() => null) as { id?: string } | null;
    if (response.ok) return { ok: true, providerRequestId: body?.id ?? null };

    console.error("Email booking notification failed", { status: response.status });
    return { ok: false, errorCode: `email_http_${response.status}` };
  } catch {
    console.error("Email booking notification network error");
    return { ok: false, errorCode: "email_network_error" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("Supabase service credentials are not configured");
      return jsonResponse({ error: "Notification service unavailable" }, 503);
    }

    const payload = await req.json() as NotifyRequest;
    const reservationId = typeof payload.reservation_id === "string"
      ? payload.reservation_id.trim()
      : "";
    if (!UUID_PATTERN.test(reservationId)) {
      return jsonResponse({ error: "Invalid reservation_id" }, 400);
    }
    const requestedChannels: NotificationChannel[] = payload.channels === undefined
      ? ["line", "email"]
      : Array.isArray(payload.channels)
        ? payload.channels.filter((channel): channel is NotificationChannel => channel === "line" || channel === "email")
        : [];
    if (requestedChannels.length === 0) {
      return jsonResponse({ error: "Invalid channels" }, 400);
    }

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: reservationData, error: reservationError } = await sb
      .from("reservations")
      .select([
        "id", "store_id", "cast_id", "created_by", "customer_name", "customer_phone",
        "reservation_date", "start_time", "duration", "course_name",
        "nomination_type", "options", "price", "discount", "discount_ids",
        "payment_fee", "payment_method", "notes", "referral_source",
        "line_notification_status", "email_notification_status",
        "notification_attempt_count",
      ].join(","))
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationError) {
      console.error("Reservation lookup failed", { reservationId, code: reservationError.code });
      return jsonResponse({ error: "Reservation lookup failed" }, 500);
    }
    if (!reservationData) return jsonResponse({ error: "Reservation not found" }, 404);

    const reservation = reservationData as ReservationRecord;
    if (reservation.created_by !== null) {
      return jsonResponse({ error: "Reservation not found" }, 404);
    }

    const lineAlreadySent = reservation.line_notification_status === "sent";
    const emailAlreadySent = reservation.email_notification_status === "sent";
    const attemptLine = requestedChannels.includes("line") && !lineAlreadySent;
    const attemptEmail = requestedChannels.includes("email") && !emailAlreadySent;
    if (!attemptLine && !attemptEmail) {
      return jsonResponse({
        success: true,
        idempotent: true,
        line: reservation.line_notification_status,
        email: reservation.email_notification_status,
      }, 200);
    }

    const sendingPatch: Record<string, unknown> = {
      notification_attempt_count: (reservation.notification_attempt_count || 0) + 1,
      notification_last_attempt_at: new Date().toISOString(),
      notification_last_error: null,
    };
    if (attemptLine) sendingPatch.line_notification_status = "sending";
    if (attemptEmail) sendingPatch.email_notification_status = "sending";
    const { error: sendingError } = await sb
      .from("reservations")
      .update(sendingPatch)
      .eq("id", reservationId);
    if (sendingError) {
      console.error("Notification sending state could not be saved", {
        reservationId,
        code: sendingError.code,
      });
      return jsonResponse({ error: "Notification state could not be saved" }, 500);
    }

    const discountIds = (reservation.discount_ids || []).filter((id) => UUID_PATTERN.test(id));
    const [castResult, destinationResult, paymentResult, discountResult, storeResult] = await Promise.all([
      reservation.cast_id
        ? sb.from("casts").select("name").eq("id", reservation.cast_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      sb.from("line_notification_destinations")
        .select("line_group_id")
        .eq("store_id", reservation.store_id)
        .eq("destination_key", "operations")
        .maybeSingle(),
      sb.from("payment_settings")
        .select("payment_method,payment_link")
        .eq("store_id", reservation.store_id)
        .eq("is_active", true),
      discountIds.length > 0
        ? sb.from("discounts").select("id,name").in("id", discountIds)
        : Promise.resolve({ data: [], error: null }),
      sb.from("stores").select("name").eq("id", reservation.store_id).maybeSingle(),
    ]);

    if (castResult.error || paymentResult.error || discountResult.error || storeResult.error) {
      console.error("Booking notification related-data lookup failed", {
        reservationId,
        cast: castResult.error?.code,
        payment: paymentResult.error?.code,
        discount: discountResult.error?.code,
        store: storeResult.error?.code,
      });

      const failurePatch: Record<string, unknown> = {
        notification_last_error: "notification_data_lookup_failed",
      };
      if (attemptLine) failurePatch.line_notification_status = "failed";
      if (attemptEmail) failurePatch.email_notification_status = "failed";
      const { error: failureSaveError } = await sb
        .from("reservations")
        .update(failurePatch)
        .eq("id", reservationId);
      if (failureSaveError) {
        console.error("Notification lookup failure state could not be saved", {
          reservationId,
          code: failureSaveError.code,
        });
      }
      return jsonResponse({ error: "Reservation details could not be loaded" }, 500);
    }
    if (destinationResult.error) {
      console.error("LINE destination lookup failed", {
        reservationId,
        code: destinationResult.error.code,
      });
    }

    const castName = castResult.data?.name || "未設定";
    const storeName = storeResult.data?.name || "艶華";
    const { dateText, timeText } = formatBusinessDateTime(
      reservation.reservation_date,
      reservation.start_time,
    );
    const options = (reservation.options || []).map(optionDisplayName);
    const discountNames = (discountResult.data || []).map((row: { name: string }) => row.name);
    const paymentSetting = (paymentResult.data || []).find(
      (row: { payment_method: string | null }) =>
        paymentMethodsMatch(row.payment_method, reservation.payment_method),
    );
    const paymentFee = reservation.payment_fee || 0;
    const grandTotal = reservation.price + paymentFee;
    const paymentLink = paymentFee > 0 ? paymentSetting?.payment_link || null : null;

    const lines = [
      "🌸 新しいWEB予約が入りました 🌸",
      "",
      `📅 日付: ${dateText}`,
      `⏰ 時間: ${timeText}〜`,
      `💆 コース: ${reservation.course_name}`,
      `👤 セラピスト: ${castName}`,
    ];
    if (reservation.nomination_type) lines.push(`⭐ 指名: ${reservation.nomination_type}`);
    if (options.length > 0) lines.push(`➕ オプション: ${options.join(", ")}`);
    if (discountNames.length > 0 || (reservation.discount || 0) > 0) {
      const namePart = discountNames.length > 0 ? discountNames.join("、") : "割引";
      const amountPart = (reservation.discount || 0) > 0
        ? `（-¥${(reservation.discount || 0).toLocaleString()}）`
        : "";
      lines.push(`🎟️ ${namePart}${amountPart}`);
    }
    lines.push(`💴 料金: ¥${reservation.price.toLocaleString()}${reservation.nomination_type ? "（指名料込み）" : ""}`);
    if (paymentFee > 0) {
      lines.push(`💳 決済手数料: ¥${paymentFee.toLocaleString()}`);
      lines.push(`💰 総額: ¥${grandTotal.toLocaleString()}`);
    }
    if (reservation.payment_method) lines.push(`💵 支払方法: ${reservation.payment_method}`);
    if (reservation.referral_source) lines.push(`🔗 予約経路: ${reservation.referral_source}`);
    lines.push("", `お客様: ${reservation.customer_name} 様`, `☎️ ${reservation.customer_phone}`);
    if (reservation.notes) lines.push("", `📝 備考: ${reservation.notes}`);

    const smsLines = [
      `${reservation.customer_name}様`,
      `${storeName}です。この度はご予約ありがとうございます。`,
      "下記内容で承りました。",
      `■日付：${dateText}`,
      `■時間：${timeText}〜`,
      `■コース：${reservation.course_name}`,
      `■セラピスト：${castName}`,
    ];
    if (reservation.nomination_type) smsLines.push(`■指名：${reservation.nomination_type}`);
    if (options.length > 0) smsLines.push(`■オプション：${options.join("、")}`);
    smsLines.push(`■料金：¥${grandTotal.toLocaleString()}`);
    if (paymentLink) smsLines.push("▼決済はこちら", paymentLink);
    smsLines.push("本メッセージにご返信いただけましたらご予約確定となります。");

    lines.push("", "━━━━━━━━━━━━━", "📲 そのまま送信できるSMS文面", "━━━━━━━━━━━━━", smsLines.join("\n"));
    const message = lines.join("\n");
    const subject = `【${storeName}】新規WEB予約 ${dateText} ${timeText}〜 ${castName}`;

    const groupId = destinationResult.data?.line_group_id || Deno.env.get("LINE_GROUP_ID") || null;
    const [lineResult, emailResult] = await Promise.all([
      attemptLine
        ? sendLine(message, Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN"), groupId, reservationId)
        : Promise.resolve<ChannelResult>({ ok: true }),
      attemptEmail
        ? sendEmail(subject, message, reservationId)
        : Promise.resolve<ChannelResult>({ ok: true }),
    ]);

    const now = new Date().toISOString();
    const failureCodes = [
      !lineResult.ok ? lineResult.errorCode : null,
      !emailResult.ok ? emailResult.errorCode : null,
    ].filter(Boolean) as string[];
    const resultPatch: Record<string, unknown> = {
      notification_last_error: failureCodes.length > 0 ? failureCodes.join(",") : null,
    };
    if (attemptLine) {
      resultPatch.line_notification_status = lineResult.ok ? "sent" : "failed";
      if (lineResult.ok) resultPatch.line_notification_sent_at = now;
    }
    if (attemptEmail) {
      resultPatch.email_notification_status = emailResult.skipped
        ? "skipped"
        : emailResult.ok ? "sent" : "failed";
      if (emailResult.ok && !emailResult.skipped) resultPatch.email_notification_sent_at = now;
    }
    const { error: resultSaveError } = await sb
      .from("reservations")
      .update(resultPatch)
      .eq("id", reservationId);
    if (resultSaveError) {
      console.error("Notification result could not be saved", {
        reservationId,
        code: resultSaveError.code,
      });
      return jsonResponse({ error: "Notification result could not be saved" }, 500);
    }

    if (!lineResult.ok || !emailResult.ok) {
      return jsonResponse({
        success: false,
        line: attemptLine ? (lineResult.ok ? "sent" : "failed") : reservation.line_notification_status,
        email: attemptEmail ? (emailResult.skipped ? "skipped" : emailResult.ok ? "sent" : "failed") : reservation.email_notification_status,
        error_code: lineResult.errorCode || emailResult.errorCode,
      }, 502);
    }

    return jsonResponse({
      success: true,
      line: attemptLine ? "sent" : reservation.line_notification_status,
      email: attemptEmail ? (emailResult.skipped ? "skipped" : "sent") : reservation.email_notification_status,
      idempotent: false,
    }, 200);
  } catch (error) {
    console.error("notify-line-booking unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Unexpected notification error" }, 500);
  }
});
