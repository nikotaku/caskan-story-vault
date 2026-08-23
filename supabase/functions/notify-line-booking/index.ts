// 新規WEB予約の通知。LINE（設定時）とメールの両方へ送る。
// LINEが見られない期間はメール通知（BOOKING_NOTIFY_EMAIL / 既定 saito.crow@gmail.com）が主連絡手段。
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// メール送信先（Edge Function の secret で上書き可能）
const NOTIFY_EMAIL = Deno.env.get("BOOKING_NOTIFY_EMAIL") || "saito.crow@gmail.com";

interface BookingPayload {
  customer_name: string;
  customer_phone: string;
  cast_name: string;
  reservation_date: string;
  start_time: string;
  course_name: string;
  nomination_type?: string | null;
  options?: string[] | null;
  price: number;
  payment_fee?: number | null;
  payment_method?: string | null;
  payment_link?: string | null;
  notes?: string | null;
}

async function sendLine(message: string): Promise<{ ok: boolean; detail?: string }> {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = Deno.env.get("LINE_GROUP_ID");
  if (!token || !groupId) return { ok: false, detail: "LINE credentials not configured" };
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: "text", text: message }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`LINE API error [${res.status}]: ${errText}`);
      return { ok: false, detail: errText };
    }
    return { ok: true };
  } catch (e) {
    console.error("LINE send failed:", e);
    return { ok: false, detail: String(e) };
  }
}

// 通知メール送信。RESEND_API_KEY があれば Resend、無ければ FormSubmit（キー不要だが不安定）を使う。
async function sendEmail(subject: string, message: string): Promise<{ ok: boolean; detail?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  try {
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM") || "onboarding@resend.dev",
          to: [NOTIFY_EMAIL],
          subject,
          text: message,
        }),
      });
      const body = await res.text();
      if (!res.ok) {
        console.error(`Resend error [${res.status}]: ${body}`);
        return { ok: false, detail: body };
      }
      return { ok: true };
    }
    // フォールバック: FormSubmit（初回は宛先に有効化メールが届く）
    const res = await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        _template: "box",
        予約内容: message,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`FormSubmit error [${res.status}]: ${body}`);
      return { ok: false, detail: body };
    }
    return { ok: true, detail: body };
  } catch (e) {
    console.error("Email send failed:", e);
    return { ok: false, detail: String(e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const booking: BookingPayload = await req.json();

    const lines = [
      "🌸 新しいWEB予約が入りました 🌸",
      "",
      `📅 日付: ${booking.reservation_date}`,
      `⏰ 時間: ${booking.start_time}〜`,
      `💆 コース: ${booking.course_name}`,
      `👤 セラピスト: ${booking.cast_name}`,
    ];
    if (booking.nomination_type) lines.push(`⭐ 指名: ${booking.nomination_type}`);
    if (booking.options && booking.options.length > 0) {
      lines.push(`➕ オプション: ${booking.options.join(", ")}`);
    }
    const paymentFee = booking.payment_fee ?? 0;
    const grandTotal = booking.price + paymentFee;
    if (booking.nomination_type) {
      lines.push(`💴 料金: ¥${booking.price.toLocaleString()}（指名料込み）`);
    } else {
      lines.push(`💴 料金: ¥${booking.price.toLocaleString()}`);
    }
    if (paymentFee > 0) {
      lines.push(`💳 決済手数料: ¥${paymentFee.toLocaleString()}`);
      lines.push(`💰 総額: ¥${grandTotal.toLocaleString()}`);
    }
    lines.push("");
    lines.push(`お客様: ${booking.customer_name} 様`);
    lines.push(`☎️ ${booking.customer_phone}`);
    if (booking.notes) {
      lines.push("");
      lines.push(`📝 備考: ${booking.notes}`);
    }

    // そのままお客様へ送信できるSMS文面を下部に付加
    const smsLines = [
      `${booking.customer_name}様`,
      "艶華です。この度はご予約ありがとうございます。",
      "下記内容で承りました。",
      `■日付：${booking.reservation_date}`,
      `■時間：${booking.start_time}〜`,
      `■コース：${booking.course_name}`,
      `■セラピスト：${booking.cast_name}`,
    ];
    if (booking.nomination_type) smsLines.push(`■指名：${booking.nomination_type}`);
    if (booking.options && booking.options.length > 0) {
      smsLines.push(`■オプション：${booking.options.join("、")}`);
    }
    smsLines.push(`■料金：¥${grandTotal.toLocaleString()}`);
    if (paymentFee > 0 && booking.payment_link) {
      smsLines.push("▼決済はこちら");
      smsLines.push(booking.payment_link);
    }
    smsLines.push("本メッセージにご返信いただけましたらご予約確定となります。");

    const smsText = smsLines.join("\n");

    lines.push("");
    lines.push("━━━━━━━━━━━━━");
    lines.push("📲 そのまま送信できるSMS文面");
    lines.push("━━━━━━━━━━━━━");
    lines.push(smsText);

    const message = lines.join("\n");
    const subject = `【艶華】新規WEB予約 ${booking.reservation_date} ${booking.start_time}〜 ${booking.cast_name}`;

    // LINE とメールを独立して送信（どちらかが失敗してももう一方は届く）
    const [lineResult, emailResult] = await Promise.all([
      sendLine(message),
      sendEmail(subject, message),
    ]);

    if (!lineResult.ok && !emailResult.ok) {
      return new Response(
        JSON.stringify({ error: "All notification channels failed", line: lineResult, email: emailResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, line: lineResult.ok, email: emailResult.ok }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-line-booking error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
