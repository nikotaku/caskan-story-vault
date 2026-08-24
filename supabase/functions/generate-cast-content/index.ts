import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ニュース生成用に実データ（割引・料金・出勤）を取得してプロンプト用テキストと画像候補を作る
async function buildNewsGrounding(): Promise<{ facts: string; images: string[] }> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return { facts: "", images: [] };

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const todayYmd = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [discountsRes, shiftsRes, castsRes, bannersRes] = await Promise.all([
      sb.from("discounts").select("name, discount_type, discount_value").eq("is_active", true),
      sb.from("shifts").select("cast_id, shift_date, start_time, end_time").eq("shift_date", todayYmd).order("start_time").limit(20),
      sb.from("casts").select("id, name, photo").eq("is_active", true).eq("is_visible", true),
      sb.from("banners").select("image_url").eq("is_active", true).order("display_order").limit(1),
    ]);

    const lines: string[] = [];

    const discounts = discountsRes.data ?? [];
    if (discounts.length) {
      lines.push("【現在有効な割引】");
      for (const d of discounts) {
        const v = d.discount_type === "percent" ? `${d.discount_value}%OFF` : `${Number(d.discount_value).toLocaleString()}円引き`;
        lines.push(`・${d.name}：${v}`);
      }
    }

    const castMap = new Map<string, { name: string; photo: string | null }>();
    for (const c of castsRes.data ?? []) castMap.set(c.id, { name: c.name, photo: c.photo });

    const shifts = (shiftsRes.data ?? []).filter((s) => castMap.has(s.cast_id));
    if (shifts.length) {
      lines.push("【本日の出勤】");
      for (const s of shifts.slice(0, 8)) {
        const c = castMap.get(s.cast_id)!;
        const time = s.start_time && s.end_time ? ` ${String(s.start_time).slice(0, 5)}〜${String(s.end_time).slice(0, 5)}` : "";
        lines.push(`・${c.name}${time}`);
      }
    }

    // 画像候補: 出勤予定キャストの写真（重複排除・最大3）＋バナー1
    const images: string[] = [];
    const seen = new Set<string>();
    for (const s of shifts) {
      const photo = castMap.get(s.cast_id)?.photo;
      if (photo && !seen.has(photo)) { seen.add(photo); images.push(photo); }
      if (images.length >= 3) break;
    }
    const banner = bannersRes.data?.[0]?.image_url;
    if (banner) images.push(banner);

    return { facts: lines.join("\n"), images };
  } catch (e) {
    console.error("buildNewsGrounding failed:", e);
    return { facts: "", images: [] };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      type, castName, castType, existingProfile, newsTitle, features,
      // coupon
      couponName, couponDiscount, couponExpiry, couponConditions,
      // schedule
      scheduleDate, scheduleNote,
      // newstaff
      staffName, staffProfile, staffMessage,
      // parse_memo（面接メモから各項目を抽出）
      memo,
    } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";
    let autoImages: string[] = [];

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
      
      case "news": {
        const { facts, images } = await buildNewsGrounding();
        autoImages = images;
        systemPrompt = "あなたはメンズエステ公式サイトの予約獲得を担当する編集者です。スマートフォンで一読できる短いニュースを日本語で作成してください。料金・割引・出勤などの具体的な情報は、必ず提供された参照データにある事実だけを使用し、創作してはいけません。季節や天気の挨拶、一般論、オプション説明は不要です。参照データに割引があれば割引名と金額を前半で伝え、本日の出勤があれば名前と時間を簡潔に案内してください。最後はWeb予約またはLINE予約を促す一文にしてください。Markdown、絵文字、ハッシュタグ、URLは使わず、通常の文章と改行だけで書いてください。";
        const factsBlock = facts
          ? `\n\n===== 参照データ（この事実のみ使用可。創作禁止）=====\n${facts}\n===============================================\n`
          : "";
        userPrompt = (newsTitle
          ? `タイトル: ${newsTitle}\n\n上記のタイトルに基づき、結論から始まる90〜180文字の記事を作成してください。`
          : `クーポンまたは本日の空き状況を結論から伝える、90〜180文字のニュース記事を作成してください。`)
          + `参照データから予約判断に必要な情報だけを選び、結論、本日の案内、予約の順に2〜3段落でまとめてください。参照データにない具体的な数値や固有名は使わないでください。${factsBlock}`;
        break;
      }
      
      case "coupon":
        systemPrompt = "あなたはメンズエステのクーポン案内記事を作成する専門のライターです。お客様の来店意欲を高める魅力的なクーポン案内を日本語で作成してください。";
        userPrompt = `クーポン名: ${couponName}\n割引・特典内容: ${couponDiscount}\n有効期限: ${couponExpiry || "記載なし"}\n利用条件: ${couponConditions || "特になし"}\n\n上記の情報を元に、お客様向けのクーポン案内記事を200〜400文字で作成してください。お得感と限定感を演出し、来店を促す内容にしてください。`;
        break;

      case "schedule":
        systemPrompt = "あなたはメンズエステの出勤情報記事を作成する専門のライターです。キャストの魅力を引き出し、お客様の来店を促す出勤案内を日本語で作成してください。";
        userPrompt = `キャスト名: ${castName}\n出勤日時: ${scheduleDate}\n${scheduleNote ? `コメント・備考: ${scheduleNote}\n` : ""}上記の情報を元に、出勤案内記事を150〜250文字で作成してください。キャストの魅力が伝わるような文体にしてください。`;
        break;

      case "shop_comment":
        systemPrompt = "あなたはメンズエステのショップコメント（スタッフがお客様に向けてキャストを紹介する文章）を作成する専門のライターです。三人称で、お客様の来店意欲を高める魅力的な紹介文を日本語で作成してください。";
        userPrompt = `キャスト名: ${castName}\nタイプ: ${castType}${features ? `\n特徴: ${features}` : ""}${existingProfile ? `\nプロフィール参考: ${existingProfile}` : ""}\n\n上記の情報を元に、店舗スタッフ視点のショップコメントを100〜200文字で作成してください。三人称（「${castName}ちゃん」「彼女は」等）で書き、キャストの個性と魅力を引き出してください。`;
        break;

      case "newstaff":
        systemPrompt = "あなたはメンズエステの新人入店情報記事を作成する専門のライターです。新人スタッフの魅力を伝え、お客様の期待感を高める入店案内を日本語で作成してください。";
        userPrompt = `スタッフ名: ${staffName}\n${staffProfile ? `プロフィール: ${staffProfile}\n` : ""}${staffMessage ? `本人からのメッセージ: ${staffMessage}\n` : ""}上記の情報を元に、新人入店のお知らせ記事を250〜400文字で作成してください。スタッフの個性と魅力を引き出した内容にしてください。`;
        break;

      case "parse_memo":
        systemPrompt =
          "あなたはメンズエステの面接メモから、セラピスト登録フォームの各項目を抽出するアシスタントです。" +
          "与えられたメモから読み取れる項目だけをJSONで返してください。読み取れない項目はキー自体を含めないこと。" +
          "数値項目は数値型で返すこと。JSON以外のテキスト（説明・コードブロック記号など）は一切出力しないこと。\n" +
          "対象キー: name(名前), name_kana(フリガナ カタカナ), age(年齢/数値), height(身長cm/数値), weight(体重kg/数値), " +
          "bust_size(カップ 例:D), body_size(3サイズ B/W/H 例:84/58/84), blood_type(A/B/O/AB), hometown(出身地), " +
          "favorite_techniques(得意な施術), favorite_food(好きな食べ物), ideal_type(好きな男性のタイプ), " +
          "celebrity_lookalike(似ている芸能人), day_off_activities(休日の過ごし方), hobbies(趣味), " +
          "therapist_experience(セラピスト経験・経歴), x_account(XのIDまたはURL), instagram_url(Instagram URL), " +
          "shop_comment(お店からの紹介コメント。メモを元に魅力的に80〜120字で作成), " +
          "profile(自己紹介/プロフィール文。メモを元に自然に150〜250字で作成)。" +
          "shop_comment と profile はメモに直接無くても、読み取れた情報を元に作成してよい。";
        userPrompt = `以下の面接メモから項目を抽出し、JSONオブジェクトだけを返してください。\n\n===== メモ =====\n${memo ?? ""}\n================`;
        break;

      default:
        throw new Error("Invalid content type");
    }

    console.log("Calling Anthropic API with type:", type);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
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
      if (response.status === 402 || response.status === 400) {
        const errBody = await response.text();
        console.error("Anthropic API error:", response.status, errBody);
        return new Response(
          JSON.stringify({ error: "クレジットが不足しているか、リクエストが不正です。" }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    const generatedContent = data.content?.[0]?.text ?? "";

    console.log("Generated content:", generatedContent);

    return new Response(
      JSON.stringify({ content: generatedContent, images: autoImages }),
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
