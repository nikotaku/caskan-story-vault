// LINE Webhook 受信。
// ・セラピストのグループLINEで「連携 セラピスト名」→ casts.line_group_id に紐付け
// ・「問合せ 店舗 チャネル メモ」→ inquiries に問い合わせを記録（グループ・個チャどちらでも）
//   例) 問合せ 全力 電話 ／ 問合せ 艶華 LINE 新規のお客様
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_MAP: Record<string, { id: string; label: string }> = {
  "全力": { id: "00000000-0000-0000-0000-000000000001", label: "全力" },
  "艶華": { id: "404499ab-5350-490f-9608-5814faffda6f", label: "艶華" },
  "えんか": { id: "404499ab-5350-490f-9608-5814faffda6f", label: "艶華" },
  "エンカ": { id: "404499ab-5350-490f-9608-5814faffda6f", label: "艶華" },
};
const CHANNEL_MAP: Record<string, { key: string; label: string }> = {
  "電話": { key: "phone", label: "電話" },
  "LINE": { key: "line", label: "LINE" },
  "ライン": { key: "line", label: "LINE" },
  "その他": { key: "other", label: "その他" },
};
const INQUIRY_USAGE =
  "形式が違います🙇\n以下の形式で送ってください：\n\n問合せ 店舗 チャネル メモ(任意)\n\n店舗: 全力 / 艶華\nチャネル: 電話 / LINE / その他\n例) 問合せ 艶華 電話 新規のお客様\n※WEB予約は自動集計されるため入力不要です";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
};

interface LineEvent {
  type?: string;
  replyToken?: string;
  source?: { groupId?: string; userId?: string };
  message?: { type?: string; text?: string };
}

async function verifySignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

async function reply(token: string, replyToken: string, text: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const secret = Deno.env.get("LINE_CHANNEL_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!token) return new Response("ok", { headers: corsHeaders });

    const raw = await req.text();
    if (secret) {
      const signatureValid = await verifySignature(raw, req.headers.get("x-line-signature"), secret);
      if (!signatureValid) return new Response("bad signature", { status: 403, headers: corsHeaders });
    }

    const body = JSON.parse(raw || "{}") as { events?: LineEvent[] };
    const events = body.events || [];
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const notificationAdminUserIds = new Set(
      (Deno.env.get("LINE_NOTIFICATION_ADMIN_USER_IDS") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );

    for (const ev of events) {
      // 問い合わせ記録（グループ・個チャどちらからでも受け付ける）
      if (ev.type === "message" && ev.message?.type === "text") {
        const t: string = (ev.message.text || "").trim();

        // 管理用の共通通知先を、このメッセージが送られたグループに切り替える。
        if (/^(グループID確認|通知先登録)([\s\u3000]+艶華)?$/.test(t)) {
          const notificationGroupId: string | undefined = ev.source?.groupId;
          const actorUserId: string | undefined = ev.source?.userId;
          if (!notificationGroupId) {
            if (ev.replyToken) await reply(token, ev.replyToken, "この操作は通知先にしたいLINEグループ内で送ってください。");
            continue;
          }
          if (!secret || !actorUserId || !notificationAdminUserIds.has(actorUserId)) {
            if (ev.replyToken) await reply(token, ev.replyToken, "この操作を行う権限がありません。管理者へご連絡ください。");
            continue;
          }
          const { error: destinationError } = await sb
            .from("line_notification_destinations")
            .upsert({
              store_id: "404499ab-5350-490f-9608-5814faffda6f",
              destination_key: "operations",
              line_group_id: notificationGroupId,
              updated_at: new Date().toISOString(),
            }, { onConflict: "store_id,destination_key" });
          if (destinationError) {
            console.error("Notification destination update failed:", destinationError);
            if (ev.replyToken) await reply(token, ev.replyToken, "通知先の登録に失敗しました。時間をおいてもう一度送ってください。");
          } else if (ev.replyToken) {
            await reply(token, ev.replyToken, "✅ 艶華の共通通知先をこのグループに切り替えました。予約・決済・各種レポートを今後はこちらへ送ります。");
          }
          continue;
        }
        const im = t.match(/^問い?合わ?せ([\s\u3000]+(.*))?$/s);
        if (im) {
          const rest = (im[2] || "").trim();
          const parts = rest.split(/[\s\u3000]+/).filter(Boolean);
          const storeKey = parts[0] ?? "";
          const chKey = (parts[1] ?? "").toUpperCase() === "LINE" ? "LINE" : parts[1] ?? "";
          const store = STORE_MAP[storeKey];
          const channel = CHANNEL_MAP[chKey];
          if (/^(WEB|ウェブ|web)$/i.test(chKey)) {
            if (ev.replyToken) await reply(token, ev.replyToken, "WEB予約は予約フォームから自動で集計されるため、入力は不要です👌");
            continue;
          }
          if (!store || !channel) {
            if (ev.replyToken) await reply(token, ev.replyToken, INQUIRY_USAGE);
            continue;
          }
          const memo = parts.slice(2).join(" ") || null;
          const { error: insErr } = await sb.from("inquiries").insert({
            store_id: store.id, channel: channel.key, memo, source: "line",
          });
          if (insErr) {
            if (ev.replyToken) await reply(token, ev.replyToken, "記録に失敗しました。もう一度お試しください🙇");
            continue;
          }
          // 本日・今月の件数（同店舗・同チャネル、日本時間基準）
          const now = new Date(Date.now() + 9 * 3600 * 1000);
          const y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate();
          const dayStart = new Date(Date.UTC(y, mo, d) - 9 * 3600 * 1000).toISOString();
          const monthStart = new Date(Date.UTC(y, mo, 1) - 9 * 3600 * 1000).toISOString();
          const { count: dayCount } = await sb.from("inquiries")
            .select("id", { count: "exact", head: true })
            .eq("store_id", store.id).eq("channel", channel.key).gte("inquired_at", dayStart);
          const { count: monthCount } = await sb.from("inquiries")
            .select("id", { count: "exact", head: true })
            .eq("store_id", store.id).eq("channel", channel.key).gte("inquired_at", monthStart);
          if (ev.replyToken) {
            await reply(token, ev.replyToken,
              `✅ ${store.label}：${channel.label}の問い合わせを記録しました\n（本日${dayCount ?? "?"}件目／今月${monthCount ?? "?"}件）${memo ? `\nメモ: ${memo}` : ""}`);
          }
          continue;
        }
      }

      const groupId: string | undefined = ev.source?.groupId;
      if (!groupId) continue;

      if (ev.type === "join") {
        // ボットがグループに招待された時の案内
        if (ev.replyToken) {
          await reply(token, ev.replyToken,
            "招待ありがとうございます🙌\nこのグループをセラピストの予約共有先にするには、\n「連携 セラピスト名」と送信してください。\n例）連携 はる");
        }
        continue;
      }

      if (ev.type === "message" && ev.message?.type === "text") {
        const text: string = (ev.message.text || "").trim();
        const m = text.match(/^連携[\s\u3000]+(.+)$/);
        if (!m) continue;
        const name = m[1].trim();

        const { data: cast } = await sb
          .from("casts")
          .select("id, name")
          .eq("name", name)
          .eq("is_active", true)
          .maybeSingle();

        if (!cast) {
          if (ev.replyToken) {
            await reply(token, ev.replyToken, `「${name}」というセラピストが見つかりませんでした🙇\n管理画面の登録名と同じ名前で送ってください。`);
          }
          continue;
        }

        const { error } = await sb
          .from("casts")
          .update({ line_group_id: groupId })
          .eq("id", cast.id);

        if (ev.replyToken) {
          await reply(token, ev.replyToken,
            error
              ? "登録に失敗しました。もう一度お試しください🙇"
              : `✅ このグループを「${cast.name}」の予約共有グループとして登録しました！\n今後、${cast.name}の予約確認SMS送信時に予約内容が自動で届きます。`);
        }
      }
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (err) {
    console.error("line-webhook error:", err);
    // LINEには常に200を返す（再送ループ防止）
    return new Response("ok", { headers: corsHeaders });
  }
});
