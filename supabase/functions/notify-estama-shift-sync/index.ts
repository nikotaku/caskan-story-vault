import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const evidenceBucket = "estama-sync-evidence";

type ShiftResult = {
  castName?: string;
  shiftDate?: string;
  startTime?: string;
  endTime?: string;
  ok?: boolean;
  error?: string;
};

type EvidenceItem = {
  castId?: string;
  castName?: string;
  externalId?: string;
  weekStart?: string;
  publicUrl?: string;
  capturedAt?: string;
  verified?: boolean;
  screenshotBase64?: string;
  mimeType?: string;
  error?: string;
  expected?: Array<{
    shiftDate?: string;
    startTime?: string;
    endTime?: string;
    verified?: boolean;
    error?: string;
  }>;
};

type EvidenceReport = {
  storeId?: string;
  shopId?: string;
  startedAt?: string;
  finishedAt?: string;
  results?: ShiftResult[];
  evidence?: EvidenceItem[];
  missingProfiles?: string[];
  fatalError?: string;
};

const secureEqual = (left: string, right: string) => {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const hex = (bytes: Uint8Array) =>
  Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");

const sha256 = async (value: string) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

const getAdminKey = () => {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Supabaseの管理用鍵がありません");
  const parsed = JSON.parse(raw) as Record<string, string>;
  const key = parsed.default || Object.values(parsed)[0];
  if (!key) throw new Error("Supabaseの管理用鍵を取得できません");
  return key;
};

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const jstLabel = (value?: string) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(value ? new Date(value) : new Date());

const compact = (value: unknown, limit = 180) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";

function buildEvidenceMessage(report: EvidenceReport, imageLabels: string[]) {
  const results = Array.isArray(report.results) ? report.results : [];
  const evidence = Array.isArray(report.evidence) ? report.evidence : [];
  const missingProfiles = Array.isArray(report.missingProfiles)
    ? report.missingProfiles.filter((item): item is string => typeof item === "string")
    : [];
  const failures = results.filter((item) => item.ok !== true);
  const evidenceFailures = evidence.filter((item) => item.verified !== true);
  const fatal = compact(report.fatalError, 400);
  const critical = Boolean(fatal || failures.length || evidenceFailures.length || missingProfiles.length);
  const lines = [
    critical ? "🚨【致命的】エスたま公開表示の確認に失敗" : "✅ エスたま公開表示まで確認完了",
    `実行: ${jstLabel(report.finishedAt)}`,
    `シフト: ${results.filter((item) => item.ok === true).length}/${results.length}件 成功`,
    `公開ページ: ${evidence.filter((item) => item.verified === true).length}/${evidence.length}ページ 一致`,
  ];

  if (fatal) lines.push("", `実行エラー: ${fatal}`);
  if (missingProfiles.length) {
    lines.push("", `紐付け未完了: ${missingProfiles.slice(0, 12).join("、")}`);
  }

  const failureLines = failures.slice(0, 12).map((item) => {
    const time = item.startTime && item.endTime
      ? ` ${String(item.startTime).slice(0, 5)}-${String(item.endTime).slice(0, 5)}`
      : "";
    return `・${compact(item.castName, 40) || "セラピスト"} ${compact(item.shiftDate, 10)}${time}: ${compact(item.error) || "公開確認失敗"}`;
  });
  if (failureLines.length) lines.push("", "未反映・失敗:", ...failureLines);

  const unmatched = evidenceFailures.flatMap((entry) =>
    (entry.expected || []).filter((item) => item.verified !== true).map((item) =>
      `・${compact(entry.castName, 40) || "セラピスト"} ${compact(item.shiftDate, 10)}: ${compact(item.error) || compact(entry.error) || "表示不一致"}`
    )
  ).slice(0, 12);
  if (!failureLines.length && unmatched.length) lines.push("", "公開ページ不一致:", ...unmatched);

  if (imageLabels.length) {
    lines.push("", "📷 公開ページ証跡（この順番で画像を送信）");
    imageLabels.slice(0, 30).forEach((label, index) => lines.push(`${index + 1}. ${label}`));
  } else if (!fatal) {
    lines.push("", "⚠️ 証跡画像を取得できませんでした");
  }

  if (critical) {
    lines.push("", "公開ページに出勤が表示されるまで同期済み扱いにはしていません。至急確認してください。");
  }
  return lines.join("\n").slice(0, 4_900);
}

async function pushLine(token: string, groupId: string, messages: Array<Record<string, string>>) {
  for (let index = 0; index < messages.length; index += 5) {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: groupId, messages: messages.slice(index, index + 5) }),
    });
    const detail = await response.text();
    if (!response.ok) {
      throw new Error(`LINE API failed (${response.status}): ${detail.slice(0, 300)}`);
    }
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  let notificationTokenHash = "";
  let customTokenClaimed = false;
  try {
    const payload = await request.json() as {
      message?: unknown;
      notificationToken?: unknown;
      report?: EvidenceReport;
    };
    const adminKey = getAdminKey();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://imrxzkivwrkqbhqfbbes.supabase.co";
    const admin = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const isServiceCall = secureEqual(request.headers.get("apikey") || "", adminKey);

    if (!isServiceCall) {
      const notificationToken = typeof payload.notificationToken === "string" ? payload.notificationToken : "";
      if (notificationToken.length < 48) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
      }
      notificationTokenHash = await sha256(notificationToken);
      const { data: tokenRow, error: tokenError } = await admin
        .from("estama_sync_tokens")
        .select("id")
        .eq("token_hash", notificationTokenHash)
        .like("purpose", "notify:%")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (tokenError) throw tokenError;
      if (!tokenRow?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
      }
      customTokenClaimed = true;
    }

    const report = payload.report && typeof payload.report === "object" ? payload.report : null;
    const legacyMessage = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!report && (!legacyMessage || legacyMessage.length > 5_000)) {
      return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: jsonHeaders });
    }

    const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    const groupId = Deno.env.get("LINE_GROUP_ID");
    if (!lineToken || !groupId) throw new Error("LINE credentials are not configured");

    const imageMessages: Array<Record<string, string>> = [];
    const imageLabels: string[] = [];
    const uploaded: Array<{ path: string; publicUrl: string; label: string }> = [];
    const evidence = report && Array.isArray(report.evidence) ? report.evidence.slice(0, 30) : [];
    const batchId = notificationTokenHash.slice(0, 16) || crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const day = (report?.finishedAt || new Date().toISOString()).slice(0, 10);

    for (let index = 0; index < evidence.length; index += 1) {
      const item = evidence[index];
      const base64 = typeof item.screenshotBase64 === "string" ? item.screenshotBase64 : "";
      if (!base64 || base64.length > 2_800_000) continue;
      const bytes = decodeBase64(base64);
      if (!bytes.length || bytes.length > 2_000_000) continue;
      const externalId = compact(item.externalId, 32).replace(/[^a-zA-Z0-9_-]/g, "") || "cast";
      const weekStart = compact(item.weekStart, 10).replace(/[^0-9-]/g, "") || "week";
      const path = `${day}/${batchId}/${String(index + 1).padStart(2, "0")}-${externalId}-${weekStart}.jpg`;
      const { error: uploadError } = await admin.storage.from(evidenceBucket).upload(path, bytes, {
        contentType: "image/jpeg",
        cacheControl: "86400",
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data } = admin.storage.from(evidenceBucket).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      if (!publicUrl.startsWith("https://")) throw new Error("証跡画像URLを発行できませんでした");
      const label = `${compact(item.castName, 40) || "セラピスト"} ${weekStart}週 ${item.verified === true ? "✅" : "🚨"}`;
      uploaded.push({ path, publicUrl, label });
      imageLabels.push(label);
      imageMessages.push({ type: "image", originalContentUrl: publicUrl, previewImageUrl: publicUrl });
    }

    const message = report ? buildEvidenceMessage(report, imageLabels) : legacyMessage;
    await pushLine(lineToken, groupId, [{ type: "text", text: message }, ...imageMessages]);

    if (customTokenClaimed) {
      const { error: useError } = await admin
        .from("estama_sync_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token_hash", notificationTokenHash)
        .is("used_at", null);
      if (useError) throw useError;
    }

    return new Response(JSON.stringify({
      success: true,
      images: uploaded.map((item) => ({ path: item.path, publicUrl: item.publicUrl, label: item.label })),
    }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
