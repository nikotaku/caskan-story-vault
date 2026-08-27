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

const shiftDateLabel = (value?: string) => {
  const date = compact(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "日付不明";
  const [, month, day] = date.split("-");
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  return `${Number(month)}/${Number(day)}(${weekday})`;
};

const addDateDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const shiftLine = (item: ShiftResult) => {
  const time = item.startTime && item.endTime
    ? ` ${String(item.startTime).slice(0, 5)}〜${String(item.endTime).slice(0, 5)}`
    : "";
  return `・${compact(item.castName, 40) || "セラピスト"} ${shiftDateLabel(item.shiftDate)}${time}`;
};

function buildEvidenceMessage(report: EvidenceReport, imageLabels: string[]) {
  const results = Array.isArray(report.results) ? report.results : [];
  const evidence = Array.isArray(report.evidence) ? report.evidence : [];
  const missingProfiles = Array.isArray(report.missingProfiles)
    ? report.missingProfiles.filter((item): item is string => typeof item === "string")
    : [];
  const failures = results.filter((item) => item.ok !== true);
  const successes = results.filter((item) => item.ok === true);
  const evidenceFailures = evidence.filter((item) => item.verified !== true);
  const fatal = compact(report.fatalError, 400);
  const requiresAttention = Boolean(fatal || failures.length || evidenceFailures.length || missingProfiles.length);
  const castNames = [...new Set([
    ...results.map((item) => compact(item.castName, 40)),
    ...evidence.map((item) => compact(item.castName, 40)),
  ].filter(Boolean))];
  const title = fatal
    ? "🚨 エスたま同期処理が停止しました"
    : requiresAttention
    ? "⚠️ エスたまの出勤を公開ページで確認できません"
    : "✅ エスたまの出勤掲載を確認しました";
  const lines = [
    title,
    `確認日時: ${jstLabel(report.finishedAt)}`,
  ];
  if (castNames.length) lines.push(`対象: ${castNames.join("、")}`);
  if (results.length) {
    lines.push(
      requiresAttention
        ? `結果: ${successes.length}/${results.length}件を掲載確認`
        : `結果: ${results.length}件すべて掲載済み`,
    );
  }

  if (fatal) lines.push("", `停止した原因: ${fatal}`);
  if (missingProfiles.length) {
    lines.push("", `エスたま連携が未設定: ${missingProfiles.slice(0, 12).join("、")}`);
  }

  const failureLines = failures.slice(0, 12).map(shiftLine);
  if (failureLines.length) lines.push("", "確認できなかった出勤:", ...failureLines);

  const unmatched = evidenceFailures.flatMap((entry) =>
    (entry.expected || []).filter((item) => item.verified !== true).map((item) =>
      `・${compact(entry.castName, 40) || "セラピスト"} ${shiftDateLabel(item.shiftDate)}`
    )
  ).slice(0, 12);
  if (!failureLines.length && unmatched.length) lines.push("", "確認できなかった出勤:", ...unmatched);

  if (!requiresAttention && successes.length) {
    lines.push("", "掲載を確認した出勤:", ...successes.slice(0, 12).map(shiftLine));
    if (successes.length > 12) lines.push(`ほか${successes.length - 12}件`);
  }

  if (imageLabels.length) {
    lines.push("", "📷 公開ページの確認画像");
    imageLabels.slice(0, 30).forEach((label, index) => lines.push(`${index + 1}. ${label}`));
  } else if (!fatal) {
    lines.push("", "確認画像は取得できませんでした");
  }

  if (failures.length && !fatal) {
    const publicCheckOnly = failures.every((item) => /公開ページ|公開確認/.test(compact(item.error)));
    lines.push(
      "",
      publicCheckOnly
        ? "状態: 管理画面への保存後、公開ページを3回確認しましたが一致を確認できませんでした。"
        : "状態: 同期処理の一部でエラーが発生しました。",
      "掲載を確認できるまで未完了扱いです。",
    );
  }
  return lines.join("\n").slice(0, 4_900);
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
    if (!report || !report.storeId || (legacyMessage && legacyMessage.length > 5_000)) {
      return new Response(JSON.stringify({ error: "storeIdを含む同期結果が必要です" }), { status: 400, headers: jsonHeaders });
    }

    const imageLabels: string[] = [];
    const uploaded: Array<{
      path: string;
      publicUrl: string;
      label: string;
      castName: string;
      weekStart: string;
      verified: boolean;
      capturedAt: string;
      publicUrlChecked: string;
      expected: EvidenceItem["expected"];
      error: string;
    }> = [];
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
      const rangeEnd = /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? addDateDays(weekStart, 6) : "";
      const range = rangeEnd
        ? `${shiftDateLabel(weekStart)}〜${shiftDateLabel(rangeEnd)}`
        : "表示期間不明";
      const label = `${compact(item.castName, 40) || "セラピスト"} ${range} ${item.verified === true ? "✅ 一致" : "⚠️ 要確認"}`;
      uploaded.push({
        path,
        publicUrl,
        label,
        castName: compact(item.castName, 40),
        weekStart,
        verified: item.verified === true,
        capturedAt: compact(item.capturedAt, 40),
        publicUrlChecked: compact(item.publicUrl, 500),
        expected: Array.isArray(item.expected) ? item.expected.slice(0, 30) : [],
        error: compact(item.error, 500),
      });
      imageLabels.push(label);
    }

    const results = Array.isArray(report.results) ? report.results.slice(0, 200) : [];
    const missingProfiles = Array.isArray(report.missingProfiles)
      ? report.missingProfiles.filter((item): item is string => typeof item === "string").slice(0, 100)
      : [];
    const fatalError = compact(report.fatalError, 1_000) || null;
    const successCount = results.filter((item) => item.ok === true).length;
    const hasWarning = results.some((item) => item.ok !== true)
      || evidence.some((item) => item.verified !== true)
      || missingProfiles.length > 0;
    const status = fatalError ? "error" : hasWarning ? "warning" : "success";
    const castNames = [...new Set([
      ...results.map((item) => compact(item.castName, 40)),
      ...uploaded.map((item) => item.castName),
    ].filter(Boolean))].slice(0, 100);
    const message = legacyMessage || buildEvidenceMessage(report, imageLabels);

    const { data: savedReport, error: saveError } = await admin
      .from("estama_sync_reports")
      .insert({
        store_id: report.storeId,
        shop_id: compact(report.shopId, 100) || null,
        status,
        started_at: report.startedAt || null,
        finished_at: report.finishedAt || new Date().toISOString(),
        total_count: results.length,
        success_count: successCount,
        cast_names: castNames,
        summary: message,
        results,
        evidence: uploaded,
        missing_profiles: missingProfiles,
        fatal_error: fatalError,
      })
      .select("id")
      .single();
    if (saveError) throw saveError;

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
      reportId: savedReport.id,
      images: uploaded.map((item) => ({ path: item.path, publicUrl: item.publicUrl, label: item.label })),
    }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
