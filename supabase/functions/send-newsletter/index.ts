import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;
const MAX_RECIPIENTS_PER_SEND = 2_000;

interface Campaign {
  id: string;
  store_id: string;
  title: string;
  subject: string;
  body_text: string;
  status: "draft" | "sending" | "sent" | "partial" | "failed";
}

interface Recipient {
  id: string;
  email: string;
  newsletter_opt_out_token: string;
}

const emailPattern = /^[A-Za-z0-9](?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidRecipientEmail(value: string) {
  return value.length <= 255 && emailPattern.test(value);
}

function makeHtml(bodyText: string, unsubscribeUrl: string) {
  const safeBody = escapeHtml(bodyText.trim()).replace(/\r?\n/g, "<br />");
  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#f8fafc;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif;line-height:1.75;">
    <main style="max-width:640px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <div style="white-space:normal;font-size:15px;">${safeBody}</div>
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
      <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
        今後のご案内メールが不要な場合は、<a href="${escapeHtml(unsubscribeUrl)}" style="color:#4f46e5;">配信を停止する</a>からお手続きください。
      </p>
    </main>
  </body>
</html>`;
}

async function verifyStoreAccess(
  authClient: ReturnType<typeof createClient>,
  storeId: string,
) {
  const { data: store, error } = await authClient
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .maybeSingle();
  return !error && Boolean(store);
}

async function loadRecipients(admin: ReturnType<typeof createClient>, storeId: string) {
  const recipients: Recipient[] = [];
  for (let from = 0; from < MAX_RECIPIENTS_PER_SEND; from += 500) {
    const { data, error } = await admin
      .from("customers")
      .select("id, email, newsletter_opt_out_token")
      .eq("store_id", storeId)
      .eq("newsletter_opt_in", true)
      .or("is_banned.is.null,is_banned.eq.false")
      .not("email", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 499);
    if (error) throw error;

    const page = ((data || []) as Recipient[])
      .filter((recipient) => typeof recipient.email === "string" && isValidRecipientEmail(recipient.email.trim()))
      .map((recipient) => ({ ...recipient, email: recipient.email.trim().toLowerCase() }));
    recipients.push(...page);
    if ((data || []).length < 500) break;
  }

  if (recipients.length >= MAX_RECIPIENTS_PER_SEND) {
    throw new Error(`1回の配信上限は${MAX_RECIPIENTS_PER_SEND.toLocaleString()}件です。対象を絞ってください。`);
  }

  const uniqueEmails = new Set<string>();
  return recipients.filter((recipient) => {
    if (uniqueEmails.has(recipient.email)) return false;
    uniqueEmails.add(recipient.email);
    return true;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM");
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!resendKey || !resendFrom || !publicSiteUrl) {
    return json({
      error: "mail_configuration_missing",
      message: "メール送信設定が未完了です。RESEND_API_KEY・RESEND_FROM・PUBLIC_SITE_URLを設定してください。",
    }, 503);
  }
  if (!supabaseUrl || !serviceRoleKey || !authorization) return json({ error: "unauthorized" }, 401);

  let campaignId: string;
  try {
    const body = await req.json();
    campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!campaignId) return json({ error: "campaign_id_required" }, 400);

  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const { data: campaignData, error: campaignError } = await admin
    .from("newsletter_campaigns")
    .select("id, store_id, title, subject, body_text, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError || !campaignData) return json({ error: "campaign_not_found" }, 404);
  const campaign = campaignData as Campaign;

  if (!await verifyStoreAccess(authClient, campaign.store_id)) return json({ error: "forbidden" }, 403);
  if (campaign.status !== "draft") {
    return json({ error: "campaign_not_draft", message: "下書き状態の配信だけを送信できます。" }, 409);
  }

  const { data: lockedCampaign, error: lockError } = await admin
    .from("newsletter_campaigns")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", campaign.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (lockError || !lockedCampaign) {
    return json({ error: "campaign_already_sending", message: "この配信はすでに送信処理中です。" }, 409);
  }

  try {
    const recipients = await loadRecipients(admin, campaign.store_id);
    if (recipients.length === 0) {
      await admin.from("newsletter_campaigns").update({
        status: "draft",
        recipient_count: 0,
        sent_count: 0,
        failed_count: 0,
        updated_at: new Date().toISOString(),
      }).eq("id", campaign.id);
      return json({ error: "no_recipients", message: "配信同意済みの有効なメールアドレスがありません。" }, 422);
    }

    const createdAt = new Date().toISOString();
    const { error: deliveryCreateError } = await admin
      .from("newsletter_deliveries")
      .upsert(
        recipients.map((recipient) => ({
          campaign_id: campaign.id,
          customer_id: recipient.id,
          recipient_email: recipient.email,
          status: "queued",
          updated_at: createdAt,
        })),
        { onConflict: "campaign_id,customer_id" },
      );
    if (deliveryCreateError) throw deliveryCreateError;

    let sentCount = 0;
    let failedCount = 0;
    const sendTimestamp = new Date().toISOString();
    const normalizedBaseUrl = publicSiteUrl.replace(/\/$/, "");

    for (let offset = 0; offset < recipients.length; offset += BATCH_SIZE) {
      const batch = recipients.slice(offset, offset + BATCH_SIZE);
      const payload = batch.map((recipient) => {
        const unsubscribeUrl = `${normalizedBaseUrl}/newsletter/unsubscribe?token=${encodeURIComponent(recipient.newsletter_opt_out_token)}`;
        return {
          from: resendFrom,
          to: [recipient.email],
          subject: campaign.subject,
          html: makeHtml(campaign.body_text, unsubscribeUrl),
          text: `${campaign.body_text.trim()}\n\n配信停止: ${unsubscribeUrl}`,
          tags: [
            { name: "campaign", value: campaign.id },
            { name: "store", value: campaign.store_id },
          ],
        };
      });

      let result: { data?: Array<{ id?: string }>; error?: unknown } = {};
      try {
        const response = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
            "Idempotency-Key": `newsletter-${campaign.id}-${offset}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          result = { error: (await response.text()).slice(0, 500) };
        } else {
          result = await response.json();
        }
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "network_error" };
      }

      const providerIds = result.data || [];
      const batchSucceeded = !result.error && providerIds.length === batch.length;
      const errorMessage = result.error
        ? String(result.error).slice(0, 500)
        : batchSucceeded
          ? null
          : "メールサービスから一部の送信結果を取得できませんでした。";

      const updates = batch.map((recipient, index) => ({
        campaign_id: campaign.id,
        customer_id: recipient.id,
        status: batchSucceeded ? "sent" : "failed",
        provider_message_id: batchSucceeded ? (providerIds[index]?.id || null) : null,
        error_message: errorMessage,
        sent_at: batchSucceeded ? sendTimestamp : null,
        updated_at: new Date().toISOString(),
      }));
      const { error: updateError } = await admin
        .from("newsletter_deliveries")
        .upsert(updates, { onConflict: "campaign_id,customer_id" });
      if (updateError) throw updateError;

      if (batchSucceeded) sentCount += batch.length;
      else failedCount += batch.length;
    }

    const finalStatus = failedCount === 0 ? "sent" : sentCount > 0 ? "partial" : "failed";
    await admin.from("newsletter_campaigns").update({
      status: finalStatus,
      recipient_count: recipients.length,
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: sendTimestamp,
      updated_at: new Date().toISOString(),
    }).eq("id", campaign.id);

    return json({
      success: finalStatus === "sent",
      status: finalStatus,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
    });
  } catch (error) {
    console.error("send-newsletter error", error);
    await admin.from("newsletter_campaigns").update({
      status: "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", campaign.id);
    return json({
      error: "send_failed",
      message: error instanceof Error ? error.message : "メルマガの送信に失敗しました。",
    }, 500);
  }
});
