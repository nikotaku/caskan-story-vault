// LINE Messaging API push notification for new web bookings
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  notes?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const groupId = Deno.env.get("LINE_GROUP_ID");

    if (!token || !groupId) {
      console.error("LINE credentials not configured");
      return new Response(
        JSON.stringify({ error: "LINE credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    lines.push(`💴 料金: ¥${booking.price.toLocaleString()}`);
    lines.push("");
    lines.push(`お客様: ${booking.customer_name} 様`);
    lines.push(`☎️ ${booking.customer_phone}`);
    if (booking.notes) {
      lines.push("");
      lines.push(`📝 備考: ${booking.notes}`);
    }

    const message = lines.join("\n");

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
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

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      console.error(`LINE API error [${lineRes.status}]: ${errText}`);
      return new Response(
        JSON.stringify({ error: "LINE API failed", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-line-booking error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
