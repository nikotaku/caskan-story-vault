import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "cleaning-reports";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type SupabaseAdmin = ReturnType<typeof createClient>;

interface CastRecord {
  id: string;
  name: string;
  store_id: string;
}

interface CleaningReportRecord {
  id: string;
  cast_id: string | null;
  store_id: string;
  date: string;
  room_name: string | null;
  room_photo_path: string | null;
  water_area_photo_path: string | null;
  notification_status: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tokyoNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function previousDate(dateText: string) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function currentBusinessDate(businessDayStart: string | null) {
  const [startHour = 10, startMinute = 0] = (businessDayStart || "10:00").slice(0, 5).split(":").map(Number);
  const now = tokyoNowParts();
  const beforeStart = now.hour * 60 + now.minute < startHour * 60 + startMinute;
  return beforeStart ? previousDate(now.date) : now.date;
}

function formatJapaneseDate(dateText: string) {
  const date = new Date(`${dateText}T12:00:00Z`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function validatePhoto(value: FormDataEntryValue | null, label: string): File {
  if (!(value instanceof File) || value.size === 0) throw new Error(`${label}を選択してください`);
  if (!CONTENT_TYPES.has(value.type)) throw new Error(`${label}はJPEG・PNG・WebP画像にしてください`);
  if (value.size > MAX_FILE_BYTES) throw new Error(`${label}は4MB以内にしてください`);
  return value;
}

async function uploadPhoto(admin: SupabaseAdmin, path: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error("cleaning_photo_upload_failed");
}

async function markNotificationFailed(admin: SupabaseAdmin, reportId: string, errorCode: string) {
  const { error } = await admin
    .from("cleaning_checklists")
    .update({
      notification_status: "failed",
      notification_last_error: errorCode,
    })
    .eq("id", reportId);
  if (error) console.error("Cleaning notification failure state could not be saved", { reportId, code: error.code });
}

async function notifyLine(
  admin: SupabaseAdmin,
  report: CleaningReportRecord,
  castName: string,
  storeName: string,
) {
  if (!report.room_photo_path || !report.water_area_photo_path) {
    return { ok: false, errorCode: "cleaning_photo_path_missing" };
  }

  const [destinationResult, signedUrlsResult] = await Promise.all([
    admin
      .from("line_notification_destinations")
      .select("line_group_id")
      .eq("store_id", report.store_id)
      .eq("destination_key", "operations")
      .maybeSingle(),
    admin.storage.from(BUCKET).createSignedUrls(
      [report.room_photo_path, report.water_area_photo_path],
      SIGNED_URL_TTL_SECONDS,
    ),
  ]);

  if (destinationResult.error) {
    console.error("Cleaning LINE destination lookup failed", { reportId: report.id, code: destinationResult.error.code });
  }
  if (signedUrlsResult.error) {
    console.error("Cleaning signed URLs could not be created", { reportId: report.id });
    return { ok: false, errorCode: "cleaning_signed_url_failed" };
  }

  const signedUrls = (signedUrlsResult.data || []).map((item) => item.signedUrl).filter(Boolean);
  if (signedUrls.length !== 2) return { ok: false, errorCode: "cleaning_signed_url_missing" };

  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = destinationResult.data?.line_group_id || Deno.env.get("LINE_GROUP_ID");
  if (!token) return { ok: false, errorCode: "line_token_missing" };
  if (!groupId) return { ok: false, errorCode: "line_destination_missing" };

  const lines = [
    "🧹【清掃完了報告】",
    "",
    `店舗：${storeName}`,
    `営業日：${formatJapaneseDate(report.date)}`,
    `セラピスト：${castName}`,
    `ルーム：${report.room_name || "未設定"}`,
    "",
    "✅ 洗濯機を回した",
    "✅ ゴミ捨て",
    "📷 ルーム・水回り画像を確認してください",
  ];

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Line-Retry-Key": report.id,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [
          { type: "text", text: lines.join("\n") },
          { type: "image", originalContentUrl: signedUrls[0], previewImageUrl: signedUrls[0] },
          { type: "image", originalContentUrl: signedUrls[1], previewImageUrl: signedUrls[1] },
        ],
      }),
    });

    if (response.ok || (response.status === 409 && response.headers.get("x-line-accepted-request-id"))) {
      return { ok: true };
    }
    console.error("Cleaning LINE notification failed", {
      reportId: report.id,
      status: response.status,
      requestId: response.headers.get("x-line-request-id"),
    });
    return { ok: false, errorCode: `line_http_${response.status}` };
  } catch {
    console.error("Cleaning LINE notification network error", { reportId: report.id });
    return { ok: false, errorCode: "line_network_error" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "清掃報告サービスを利用できません" }, 503);

  try {
    const formData = await req.formData();
    const token = String(formData.get("token") || "").trim();
    const reportId = String(formData.get("report_id") || "").trim();
    if (!token || token.length > 200) return jsonResponse({ error: "無効なポータルリンクです" }, 401);
    if (!UUID_V4_PATTERN.test(reportId)) return jsonResponse({ error: "無効な報告番号です" }, 400);
    if (formData.get("laundry_started") !== "true" || formData.get("trash_taken_out") !== "true") {
      return jsonResponse({ error: "洗濯機とゴミ捨てを確認してください" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: castData, error: castError } = await admin
      .from("casts")
      .select("id,name,store_id")
      .eq("access_token", token)
      .maybeSingle();
    if (castError) {
      console.error("Cleaning cast lookup failed", { code: castError.code });
      return jsonResponse({ error: "セラピスト情報を確認できませんでした" }, 500);
    }
    if (!castData) return jsonResponse({ error: "無効なポータルリンクです" }, 401);
    const cast = castData as CastRecord;

    const { data: existingData, error: existingError } = await admin
      .from("cleaning_checklists")
      .select("id,cast_id,store_id,date,room_name,room_photo_path,water_area_photo_path,notification_status")
      .eq("id", reportId)
      .maybeSingle();
    if (existingError) {
      console.error("Existing cleaning report lookup failed", { reportId, code: existingError.code });
      return jsonResponse({ error: "清掃報告を確認できませんでした" }, 500);
    }
    if (existingData && existingData.cast_id !== cast.id) return jsonResponse({ error: "清掃報告が見つかりません" }, 404);
    if (existingData?.notification_status === "sent") {
      return jsonResponse({ success: true, idempotent: true, report_id: reportId });
    }

    const [{ data: settingsData }, { data: storeData }] = await Promise.all([
      admin.from("shop_settings").select("business_day_start").eq("store_id", cast.store_id).limit(1).maybeSingle(),
      admin.from("stores").select("name").eq("id", cast.store_id).maybeSingle(),
    ]);
    const businessDate = currentBusinessDate(settingsData?.business_day_start || null);

    let report = existingData as CleaningReportRecord | null;
    if (!report) {
      let roomImage: File;
      let waterImage: File;
      try {
        roomImage = validatePhoto(formData.get("room_image"), "ルーム画像");
        waterImage = validatePhoto(formData.get("water_image"), "水回り画像");
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "画像を確認してください" }, 400);
      }

      const { data: shiftData } = await admin
        .from("shifts")
        .select("room")
        .eq("cast_id", cast.id)
        .eq("shift_date", businessDate)
        .neq("approval_status", "rejected")
        .not("room", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const roomName = shiftData?.room || null;
      const prefix = `${cast.store_id}/${businessDate}/${cast.id}/${reportId}`;
      const roomPath = `${prefix}/room.${CONTENT_TYPES.get(roomImage.type)}`;
      const waterPath = `${prefix}/water.${CONTENT_TYPES.get(waterImage.type)}`;
      const uploadedPaths: string[] = [];

      try {
        await uploadPhoto(admin, roomPath, roomImage);
        uploadedPaths.push(roomPath);
        await uploadPhoto(admin, waterPath, waterImage);
        uploadedPaths.push(waterPath);
      } catch {
        if (uploadedPaths.length > 0) await admin.storage.from(BUCKET).remove(uploadedPaths);
        return jsonResponse({ error: "画像を保存できませんでした。もう一度お試しください" }, 500);
      }

      const now = new Date().toISOString();
      const { data: insertedData, error: insertError } = await admin
        .from("cleaning_checklists")
        .insert({
          id: reportId,
          date: businessDate,
          cast_id: cast.id,
          store_id: cast.store_id,
          room_name: roomName,
          room_photo_path: roomPath,
          water_area_photo_path: waterPath,
          laundry_started: true,
          trash_taken_out: true,
          room_cleaned: true,
          equipment_checked: true,
          status: "pending",
          completed_at: now,
          notification_status: "sending",
          notification_last_error: null,
        })
        .select("id,cast_id,store_id,date,room_name,room_photo_path,water_area_photo_path,notification_status")
        .single();
      if (insertError || !insertedData) {
        await admin.storage.from(BUCKET).remove(uploadedPaths);
        console.error("Cleaning report insert failed", { reportId, code: insertError?.code });
        return jsonResponse({ error: "清掃報告を保存できませんでした" }, 500);
      }
      report = insertedData as CleaningReportRecord;

      const { error: clearanceError } = await admin
        .from("daily_clearances")
        .update({ status: "completed" })
        .eq("cast_id", cast.id)
        .eq("date", businessDate)
        .eq("status", "pending");
      if (clearanceError) console.error("Daily clearance could not be completed", { reportId, code: clearanceError.code });
    } else {
      const { error: sendingError } = await admin
        .from("cleaning_checklists")
        .update({ notification_status: "sending", notification_last_error: null })
        .eq("id", report.id);
      if (sendingError) {
        console.error("Cleaning notification sending state could not be saved", { reportId, code: sendingError.code });
        return jsonResponse({ error: "通知を再送できませんでした", saved: true }, 500);
      }
    }

    const lineResult = await notifyLine(admin, report, cast.name, storeData?.name || "艶華");
    if (!lineResult.ok) {
      await markNotificationFailed(admin, report.id, lineResult.errorCode || "line_unknown_error");
      return jsonResponse({
        error: "清掃報告は保存しましたが、予約通知グループへの通知に失敗しました。もう一度押してください",
        saved: true,
        retryable: true,
        report_id: report.id,
      }, 502);
    }

    const { error: sentError } = await admin
      .from("cleaning_checklists")
      .update({
        notification_status: "sent",
        notification_sent_at: new Date().toISOString(),
        notification_last_error: null,
      })
      .eq("id", report.id);
    if (sentError) {
      console.error("Cleaning notification success state could not be saved", { reportId, code: sentError.code });
      return jsonResponse({ error: "通知結果を保存できませんでした。もう一度押してください", saved: true }, 500);
    }

    return jsonResponse({ success: true, report_id: report.id, notification: "sent" });
  } catch (error) {
    console.error("submit-cleaning-report unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "清掃完了報告を送信できませんでした" }, 500);
  }
});
