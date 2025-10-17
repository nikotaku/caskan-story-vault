import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, castName, castType, existingProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "profile":
        systemPrompt = "あなたはメンズエステのキャストプロフィールを作成する専門のライターです。魅力的で親しみやすく、お客様が興味を持つようなプロフィールを日本語で作成してください。";
        userPrompt = `キャスト名: ${castName}\nタイプ: ${castType}\n\n上記の情報を元に、200-300文字程度の魅力的なプロフィールを作成してください。${existingProfile ? `既存のプロフィール: ${existingProfile}\n\n既存の内容を参考にしつつ、より魅力的に改善してください。` : ''}`;
        break;
      
      case "announcement":
        systemPrompt = "あなたはメンズエステのお知らせ文章を作成する専門のライターです。お客様に分かりやすく、魅力的なお知らせ文を日本語で作成してください。";
        userPrompt = `キャスト名: ${castName}\nタイプ: ${castType}\n\n上記のキャストに関する新着情報やお知らせの文章を100-150文字程度で作成してください。`;
        break;
      
      case "catchphrase":
        systemPrompt = "あなたはメンズエステのキャッチコピーを作成する専門のコピーライターです。短く印象的で、お客様の興味を引くキャッチコピーを日本語で作成してください。";
        userPrompt = `キャスト名: ${castName}\nタイプ: ${castType}\n\n上記のキャストの魅力を表現する、20-40文字程度の印象的なキャッチコピーを作成してください。`;
        break;
      
      default:
        throw new Error("Invalid content type");
    }

    console.log("Calling Lovable AI with type:", type);

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
          { role: "user", content: userPrompt }
        ],
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
          JSON.stringify({ error: "クレジットが不足しています。ワークスペースに資金を追加してください。" }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI API error");
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log("Generated content:", generatedContent);

    return new Response(
      JSON.stringify({ content: generatedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-cast-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
