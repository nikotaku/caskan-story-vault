import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch visible therapists with status not offline
    const { data: therapists, error: castError } = await supabase
      .from("casts")
      .select("name, age, height, bust, waist, hip, cup_size, specialties, message, profile, tags, experience_years, hobbies, favorite_techniques, status, photo")
      .eq("is_visible", true)
      .neq("status", "offline");

    if (castError) throw castError;

    if (!therapists || therapists.length === 0) {
      return new Response(JSON.stringify({ message: "紹介可能なセラピストがいません" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick a random therapist to feature
    const therapist = therapists[Math.floor(Math.random() * therapists.length)];

    const prompt = `以下のセラピスト情報をもとに、掲示板に投稿する紹介文を1つ作成してください。
140文字以内で、魅力的で親しみやすいトーンで書いてください。絵文字を適度に使ってOKです。
「本日出勤中！」のような言葉を入れてください。

セラピスト情報:
- 名前: ${therapist.name}
- 年齢: ${therapist.age || "非公開"}
- 身長: ${therapist.height ? therapist.height + "cm" : "非公開"}
- スリーサイズ: ${therapist.bust || "?"}/${therapist.waist || "?"}/${therapist.hip || "?"}
- カップ: ${therapist.cup_size || "非公開"}
- 得意な手技: ${therapist.specialties || therapist.favorite_techniques || "未登録"}
- メッセージ: ${therapist.message || "なし"}
- プロフィール: ${therapist.profile || "なし"}
- 趣味: ${therapist.hobbies || "なし"}
- 経験年数: ${therapist.experience_years ? therapist.experience_years + "年" : "未登録"}
- タグ: ${therapist.tags?.join(", ") || "なし"}

紹介文のみを返してください。余計な説明は不要です。`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "あなたはメンズエステ店の公式アカウントです。セラピストの魅力を伝える短い紹介文を書きます。" },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let introText = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Trim to 140 chars if needed
    if (introText.length > 140) {
      introText = introText.substring(0, 137) + "...";
    }

    if (!introText) {
      throw new Error("AI generated empty content");
    }

    // Post to board
    const { error: insertError } = await supabase.from("board_posts").insert({
      content: introText,
      author_name: "🤖 全力コンシェルジュ",
      title: "-",
      is_pinned: false,
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      success: true, 
      therapist: therapist.name,
      content: introText 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-therapist-intro error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
