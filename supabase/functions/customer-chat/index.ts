import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (entry && entry.resetAt > now) {
      if (entry.count >= RATE_LIMIT) {
        return new Response(JSON.stringify({ error: "リクエストが多すぎます。しばらく待ってからお試しください。" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      entry.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length > 50) {
      return new Response(JSON.stringify({ error: "リクエストが無効です。" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const m of messages) {
      if (typeof m?.content !== "string" || m.content.length > 1000) {
        return new Response(JSON.stringify({ error: "メッセージが長すぎます（1000文字以内）。" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `あなたはメンズエステの顧客対応スタッフです。以下の情報を基に、親切で丁寧に対応してください：

【対応方針】
- 親しみやすく、でも礼儀正しい対応を心がける
- お客様の質問には具体的に答える
- 予約や料金については正確な情報を提供する
- 分からないことは正直に伝え、スタッフに確認することを提案する

【基本情報】
- 営業時間：10:00-24:00（年中無休）
- 料金：コースにより異なります。詳しくは料金ページをご覧ください
- 予約：電話またはオンライン予約が可能です

【よくある質問】
- 初めての方も歓迎です
- 完全個室でプライバシーは守られます
- 清潔な環境を徹底しています
- 経験豊富なセラピストが対応します

お客様が快適に過ごせるよう、丁寧にサポートしてください。`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "レート制限に達しました。しばらく待ってから再度お試しください。" }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "クレジットが不足しています。" }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI API error");
    }

    console.log("Streaming response from AI");

    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      },
    });

  } catch (error) {
    console.error("Error in customer-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
