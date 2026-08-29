import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const emailPattern = /^[A-Za-z0-9](?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_configuration_error" }, 500);

  let email: string;
  let name: string;
  let storeId: string;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    name = typeof body?.name === "string" ? body.name.trim() : "";
    storeId = typeof body?.storeId === "string" ? body.storeId : "";
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!email || !emailPattern.test(email) || email.length > 255) {
    return json({ error: "invalid_email", message: "有効なメールアドレスを入力してください。" }, 400);
  }
  if (!storeId) return json({ error: "store_id_required" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 既存顧客をメールアドレスで検索
  const { data: existingCustomer } = await admin
    .from("customers")
    .select("id, newsletter_opt_in")
    .eq("store_id", storeId)
    .eq("email", email)
    .maybeSingle();

  if (existingCustomer) {
    // 既存顧客の場合は配信同意をONにする
    const { error: updateError } = await admin
      .from("customers")
      .update({ newsletter_opt_in: true, updated_at: new Date().toISOString() })
      .eq("id", existingCustomer.id);
    if (updateError) {
      console.error("newsletter-signup update error", updateError);
      return json({ error: "signup_failed", message: "登録に失敗しました。" }, 500);
    }
    return json({ success: true, message: "メルマガ登録を更新しました。" });
  }

  // 新規顧客として登録（電話番号は必須のため、メールアドレスを仮の電話番号として使用）
  const { error: insertError } = await admin
    .from("customers")
    .insert({
      store_id: storeId,
      name: name || email.split("@")[0],
      email,
      phone: `newsletter-${email}`,
      newsletter_opt_in: true,
      status: "newsletter_only",
    });
  if (insertError) {
    console.error("newsletter-signup insert error", insertError);
    return json({ error: "signup_failed", message: "登録に失敗しました。" }, 500);
  }

  return json({ success: true, message: "メルマガ登録が完了しました。" });
});
