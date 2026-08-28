import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { workerFailureSafety, workerPhotoCount } from "./photo-count.ts";
import { assertRequiredPostImageSize } from "./image-size.ts";
import { decodeRequiredPostImageBase64 } from "./image-payload.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL_WORKER_URL = Deno.env.get("ESTAMA_PORTAL_WORKER_URL") || "https://newkyasukan.vercel.app/api/automations/estama-portal-worker";
const O2_BASE = "https://m-sns.net";
const O2_LOGIN = `${O2_BASE}/cast/login/`;
const O2_POST_CREATE = `${O2_BASE}/cast/post/create/`;
const REVIEW_REQUIRED_PREFIX = "【要確認・再送停止】";
const ALLOWED_ORIGINS = new Set([
  "https://zenryokuesthe.com",
  "https://www.zenryokuesthe.com",
  "http://localhost:5173",
  "http://localhost:8080",
]);

type JsonRecord = Record<string, unknown>;
type PostRecord = {
  id: string;
  cast_id: string;
  store_id: string;
  title: string | null;
  body: string;
  image_urls: string[] | null;
  o2_status: string;
  esutama_status: string;
  esutama_error: string | null;
  o2_attempts: number;
  esutama_attempts: number;
};

type AutomationJob = {
  id: string;
  store_id: string;
  cast_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  payload: JsonRecord | null;
};

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://zenryokuesthe.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (req: Request, value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "private, no-store" },
});

const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

const requireSinglePostImage = (imageUrls: string[] | null) => {
  if (!Array.isArray(imageUrls) || imageUrls.length !== 1 || !stringValue(imageUrls[0])) {
    throw new Error("同時投稿には600×600の画像が1枚必要です");
  }
  return imageUrls[0];
};

async function createTherapistPost(req: Request, admin: ReturnType<typeof createClient>, body: JsonRecord) {
  const accessToken = stringValue(body.access_token);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const postBody = typeof body.post_body === "string" ? body.post_body.trim() : "";
  if (!accessToken || accessToken.length > 256) return json(req, { error: "ポータルトークンが無効です" }, 401);
  if (!postBody) return json(req, { error: "本文を入力してください" }, 400);
  if (title.length > 120 || postBody.length > 5000) {
    return json(req, { error: "タイトル120文字、本文5000文字以内で入力してください" }, 400);
  }

  let imageBytes: Uint8Array;
  try {
    imageBytes = decodeRequiredPostImageBase64(body.image_base64);
  } catch (error) {
    return json(req, { error: error instanceof Error ? error.message : "画像を確認できませんでした" }, 400);
  }

  const { data: cast, error: castError } = await admin.from("casts")
    .select("id,store_id")
    .eq("access_token", accessToken)
    .eq("is_active", true)
    .maybeSingle();
  if (castError) throw castError;
  if (!cast?.id || !cast.store_id) return json(req, { error: "無効またはアーカイブ済みのリンクです" }, 401);

  const path = `posts/${cast.id}/${crypto.randomUUID()}-600x600.jpg`;
  const { error: uploadError } = await admin.storage.from("cast-photos").upload(path, imageBytes, {
    cacheControl: "3600",
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploadError) throw new Error("画像をアップロードできませんでした");

  let created = false;
  try {
    const imageUrl = admin.storage.from("cast-photos").getPublicUrl(path).data.publicUrl;
    const { data: postId, error: postError } = await admin.rpc("create_therapist_post", {
      p_token: accessToken,
      p_title: title || null,
      p_body: postBody,
      p_image_urls: [imageUrl],
    });
    if (postError || typeof postId !== "string") throw postError || new Error("投稿を作成できませんでした");
    created = true;
    return json(req, { postId });
  } finally {
    if (!created) {
      let cleanupError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await admin.storage.from("cast-photos").remove([path]);
        cleanupError = result.error;
        if (!result.error) break;
      }
      if (cleanupError) console.error(JSON.stringify({ event: "therapist_post_image_cleanup_failed", path }));
    }
  }
}

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

async function claimEstamaWorker(req: Request, admin: ReturnType<typeof createClient>, body: JsonRecord) {
  const jobId = stringValue(body.job_id);
  const workerToken = stringValue(body.worker_token);
  if (!jobId || !workerToken) return json(req, { error: "実行認証に失敗しました" }, 401);
  const tokenHash = await sha256(workerToken);
  const { data: job } = await admin.from("automation_jobs")
    .select("id,store_id,cast_id,status,attempts,max_attempts,payload")
    .eq("id", jobId)
    .eq("provider", "estama")
    .eq("job_type", "estama_post_diary")
    .eq("status", "running")
    .maybeSingle<AutomationJob>();
  const payload = job?.payload || {};
  const expiresAt = stringValue(payload.worker_token_expires_at);
  if (!job || stringValue(payload.worker_token_hash) !== tokenHash || !expiresAt || expiresAt < new Date().toISOString()) {
    return json(req, { error: "実行認証に失敗しました" }, 401);
  }
  const claimedPayload = {
    ...payload,
    worker_token_hash: null,
    worker_token_claimed_at: new Date().toISOString(),
    ...(payload.reset_soul_pending === true ? { reset_soul_pending: false } : {}),
  };
  const { data: claimed } = await admin.from("automation_jobs")
    .update({ payload: claimedPayload })
    .eq("id", job.id)
    .eq("status", "running")
    .contains("payload", { worker_token_hash: tokenHash })
    .select("id")
    .maybeSingle();
  if (!claimed) return json(req, { error: "実行認証に失敗しました" }, 401);

  const postId = stringValue(payload.post_id);
  const [{ data: connection }, { data: cast }, { data: external }, { data: post }, { data: soulCredential }] = await Promise.all([
    admin.from("automation_connections").select("browserbase_context_id,status,shop_id").eq("store_id", job.store_id).eq("provider", "estama").maybeSingle(),
    admin.from("casts").select("name").eq("id", job.cast_id).eq("store_id", job.store_id).eq("is_active", true).maybeSingle(),
    admin.from("external_cast_profiles").select("external_cast_id,remote_name,sync_status,public_profile_url").eq("cast_id", job.cast_id).eq("store_id", job.store_id).eq("provider", "estama").maybeSingle(),
    admin.from("cast_posts").select("title,body,image_urls").eq("id", postId).eq("cast_id", job.cast_id).eq("store_id", job.store_id).maybeSingle(),
    admin.from("cast_site_credentials").select("login_id,password").eq("cast_id", job.cast_id).eq("store_id", job.store_id).eq("site", "esutama").maybeSingle(),
  ]);
  if (!connection?.browserbase_context_id || connection.status !== "ready") {
    return json(req, { error: "エステ魂ログイン設定が未完了です" }, 409);
  }
  if (!cast || !post || !external || external.sync_status !== "synced") {
    return json(req, { error: "先にセラピストをエステ魂へ登録してください" }, 409);
  }
  requireSinglePostImage(post.image_urls);
  const hasSoulCredential = Boolean(soulCredential?.login_id && soulCredential?.password);
  if (!hasSoulCredential) {
    return json(req, { error: "魂セラピストのID・パスワードが未設定です" }, 409);
  }
  return json(req, {
    work: {
      jobId: job.id,
      browserbaseContextId: connection.browserbase_context_id,
      // Vercel側の切替中も旧workerが初回設定を自動実行しないよう、固定ログイン方式として渡す。
      soulStatus: "configured",
      soulLoginUrl: "https://estama.jp/tamathera/login/",
      ...(hasSoulCredential ? {
        soulCredentials: {
          loginId: soulCredential!.login_id,
          password: soulCredential!.password,
          email: soulCredential!.login_id,
        },
      } : {}),
      cast: {
        name: cast.name,
        externalId: external.external_cast_id,
        remoteName: external.remote_name,
        publicUrl: external.public_profile_url,
        shopId: connection.shop_id,
      },
      post: { title: post.title, body: post.body, imageUrls: post.image_urls },
    },
  });
}

async function dispatchEstamaDiary(req: Request, admin: ReturnType<typeof createClient>, post: PostRecord) {
  if (post.esutama_status === "posted") return json(req, { status: "posted", skipped: true });
  if (stringValue(post.esutama_error).startsWith(REVIEW_REQUIRED_PREFIX)) {
    return json(req, {
      status: "review_required",
      error: post.esutama_error,
      skipped: true,
    }, 409);
  }
  if (post.esutama_status === "posting") return json(req, { status: "posting", skipped: true });

  try {
    const imageUrl = requireSinglePostImage(post.image_urls);
    await downloadImage(imageUrl, 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("cast_posts").update({ esutama_status: "failed", esutama_error: message }).eq("id", post.id);
    await updateOverallStatus(admin, post.id);
    return json(req, { status: "failed", error: message, safeToRetry: false }, 422);
  }

  const [{ data: connection }, { data: external }] = await Promise.all([
    admin.from("automation_connections").select("status,browserbase_context_id").eq("store_id", post.store_id).eq("provider", "estama").maybeSingle(),
    admin.from("external_cast_profiles").select("sync_status,soul_status").eq("cast_id", post.cast_id).eq("provider", "estama").maybeSingle(),
  ]);
  if (!connection?.browserbase_context_id || connection.status !== "ready" || external?.sync_status !== "synced") {
    const message = external?.sync_status !== "synced"
      ? "先にセラピストをエステ魂へ登録してください"
      : "エステ魂ログイン設定が未完了です";
    await admin.from("cast_posts").update({ esutama_status: "skipped", esutama_error: message }).eq("id", post.id);
    await updateOverallStatus(admin, post.id);
    return json(req, { status: "skipped", error: message }, 422);
  }

  let { data: job } = await admin.from("automation_jobs")
    .select("id,store_id,cast_id,status,attempts,max_attempts,payload")
    .eq("store_id", post.store_id)
    .eq("cast_id", post.cast_id)
    .eq("job_type", "estama_post_diary")
    .in("status", ["queued", "running", "waiting_for_login"])
    .contains("payload", { post_id: post.id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AutomationJob>();
  if (job?.status === "running") return json(req, { jobId: job.id, status: "posting", skipped: true });
  if (job?.status === "waiting_for_login") {
    const { data: reset } = await admin.from("automation_jobs").update({
      status: "queued",
      error_message: null,
      payload: { ...(job.payload || {}), reset_soul_pending: external?.soul_status === "issued" },
    })
      .eq("id", job.id).eq("status", "waiting_for_login")
      .select("id,store_id,cast_id,status,attempts,max_attempts,payload").maybeSingle<AutomationJob>();
    job = reset || job;
  }
  if (job?.status === "queued" && external?.soul_status === "issued" && job.payload?.reset_soul_pending !== true) {
    const { data: reset } = await admin.from("automation_jobs").update({
      payload: { ...(job.payload || {}), reset_soul_pending: true },
    }).eq("id", job.id).eq("status", "queued")
      .select("id,store_id,cast_id,status,attempts,max_attempts,payload").maybeSingle<AutomationJob>();
    job = reset || job;
  }
  if (!job) {
    const attempt = Number(post.esutama_attempts || 0) + 1;
    const { data: jobId, error } = await admin.rpc("enqueue_estama_job", {
      p_store_id: post.store_id,
      p_job_type: "estama_post_diary",
      p_cast_id: post.cast_id,
      p_shift_id: null,
      p_dedupe_key: `estama:diary:${post.id}:${attempt}`,
      p_payload: {
        source: "therapist_portal",
        post_id: post.id,
        attempt,
        ...(external?.soul_status === "issued" ? { reset_soul_pending: true } : {}),
      },
    });
    if (error) throw error;
    const { data: created } = await admin.from("automation_jobs")
      .select("id,store_id,cast_id,status,attempts,max_attempts,payload")
      .eq("id", jobId).single<AutomationJob>();
    job = created;
  }
  if (!job || job.status !== "queued") throw new Error("魂セラピスト投稿ジョブを開始できませんでした");

  const workerToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const workerTokenHash = await sha256(workerToken);
  const nextPayload = {
    ...(job.payload || {}),
    worker_token_hash: workerTokenHash,
    worker_token_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
  const { data: claimed } = await admin.from("automation_jobs").update({
    status: "running",
    attempts: Number(job.attempts || 0) + 1,
    started_at: new Date().toISOString(),
    error_message: null,
    payload: nextPayload,
  }).eq("id", job.id).eq("status", "queued")
    .select("id,store_id,cast_id,status,attempts,max_attempts,payload").maybeSingle<AutomationJob>();
  if (!claimed) return json(req, { jobId: job.id, status: "posting", skipped: true });

  const { data: postingPost, error: postingError } = await admin.from("cast_posts").update({
    esutama_status: "posting",
    esutama_error: null,
    esutama_attempts: Number(post.esutama_attempts || 0) + 1,
    last_attempt_at: new Date().toISOString(),
  }).eq("id", post.id).eq("esutama_status", post.esutama_status).select("id").maybeSingle();
  if (postingError || !postingPost) {
    const message = postingError
      ? `魂セラピスト投稿の送信前ロックに失敗しました（${postingError.message}）`
      : "魂セラピスト投稿は別の処理が開始済みです";
    const { error: jobError } = await admin.from("automation_jobs").update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
    }).eq("id", claimed.id);
    if (jobError) console.error(JSON.stringify({ event: "estama_pre_submit_lock_cleanup_failed", error: jobError.message }));
    return json(req, { jobId: claimed.id, status: postingError ? "failed" : "posting", error: message }, postingError ? 500 : 409);
  }

  let workerResponse: Response | null = null;
  let workerPayload: JsonRecord = {};
  try {
    workerResponse = await fetch(PORTAL_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: claimed.id, workerToken }),
      signal: AbortSignal.timeout(120_000),
    });
    workerPayload = await workerResponse.json().catch(() => ({})) as JsonRecord;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    workerPayload = {
      error: `${REVIEW_REQUIRED_PREFIX}魂セラピストへの送信結果を確認できません（${detail.slice(0, 240)}）`,
      submissionUncertain: true,
    };
  }
  const result = workerPayload.result && typeof workerPayload.result === "object" ? workerPayload.result as JsonRecord : {};
  const photoCount = workerPhotoCount(post.image_urls, result);
  const loginRequired = workerPayload.loginRequired === true;
  const activationRequired = workerPayload.activationRequired === true;
  const failureSafety = workerFailureSafety(workerResponse?.ok ?? null, workerPayload);
  const waitingForLogin = failureSafety.waitingForLogin;
  const workerResultMismatch = workerResponse?.ok === true && !photoCount.matches;
  const submissionUncertain = failureSafety.submissionUncertain;
  const reviewRequired = workerResultMismatch || submissionUncertain;
  if (workerResponse?.ok === true && photoCount.matches && !reviewRequired) {
    const soul = result.soul && typeof result.soul === "object" ? result.soul as JsonRecord : null;
    if (soul) {
      const soulStatus = stringValue(soul.status);
      const { error: soulUpdateError } = await admin.from("external_cast_profiles").update({
        soul_status: soulStatus === "configured" ? "configured" : soulStatus === "issued" ? "issued" : "error",
        soul_login_url: stringValue(soul.loginUrl) || null,
      }).eq("cast_id", post.cast_id).eq("provider", "estama");
      if (soulUpdateError) console.warn(JSON.stringify({ event: "estama_soul_status_update_failed", error: soulUpdateError.message }));
    }
    const [jobWrite, postWrite] = await Promise.all([
      admin.from("automation_jobs").update({
        status: "completed", result, error_message: null, finished_at: new Date().toISOString(),
      }).eq("id", claimed.id).eq("status", "running").select("id").maybeSingle(),
      admin.from("cast_posts").update({
        esutama_status: "posted", esutama_error: null, posted_at: new Date().toISOString(),
      }).eq("id", post.id).eq("esutama_status", "posting").select("id").maybeSingle(),
    ]);
    const persistenceError = jobWrite.error || postWrite.error;
    const persistenceMissing = !jobWrite.data || !postWrite.data;
    if (persistenceError || persistenceMissing) {
      const persistenceDetail = persistenceError?.message || "保存対象の状態が送信中ではありませんでした";
      const message = `${REVIEW_REQUIRED_PREFIX}魂セラピストへの投稿後、管理画面の状態を保存できませんでした（${persistenceDetail}）。魂側を確認するまで再送できません`;
      const [jobReviewWrite, postReviewWrite] = await Promise.all([
        admin.from("automation_jobs").update({
          status: "failed",
          result: { ...result, warning_code: "persistence_failed" },
          error_message: message,
          finished_at: new Date().toISOString(),
        }).eq("id", claimed.id),
        admin.from("cast_posts").update({
          esutama_status: "failed",
          esutama_error: message,
        }).eq("id", post.id),
      ]);
      console.error(JSON.stringify({
        event: "estama_post_persistence_failed",
        initialError: persistenceDetail,
        jobReviewError: jobReviewWrite.error?.message || null,
        postReviewError: postReviewWrite.error?.message || null,
      }));
      await updateOverallStatus(admin, post.id);
      return json(req, { jobId: claimed.id, status: "review_required", error: message }, 500);
    }
    const publicDiaryUrl = stringValue(result.url);
    if (publicDiaryUrl) {
      const { error: diaryLinkError } = await admin.from("cast_diaries")
        .update({ external_url: publicDiaryUrl })
        .eq("source_post_id", post.id);
      if (diaryLinkError) {
        console.warn(JSON.stringify({ event: "estama_hp_diary_link_failed", postId: post.id, error: diaryLinkError.message }));
      }
    }
    await updateOverallStatus(admin, post.id);
    return json(req, { jobId: claimed.id, status: "posted", result });
  }

  const workerError = stringValue(workerPayload.error);
  const message = workerResultMismatch
    ? `${REVIEW_REQUIRED_PREFIX}${photoCount.posted ? "魂セラピストの写真枚数" : "魂セラピストの投稿完了報告"}が一致しません（指定${photoCount.expected}枚 / 設定${photoCount.uploaded ?? "不明"}枚）。魂側を確認するまで再送できません`
    : submissionUncertain
      ? workerError.startsWith(REVIEW_REQUIRED_PREFIX)
        ? workerError
        : `${REVIEW_REQUIRED_PREFIX}${workerError || "魂セラピストへの送信結果を確認できません"}。魂側を確認するまで再送できません`
      : workerError || "魂セラピスト投稿に失敗しました";
  const retry = !waitingForLogin && !reviewRequired && claimed.attempts < claimed.max_attempts;
  const delayMinutes = Math.min(60, 2 ** Math.max(0, claimed.attempts - 1));
  const stateWrites = await Promise.all([
    admin.from("automation_jobs").update({
      status: waitingForLogin ? "waiting_for_login" : retry ? "queued" : "failed",
      error_message: message,
      available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      finished_at: waitingForLogin || retry ? null : new Date().toISOString(),
      ...(reviewRequired ? { result: { ...result, warning_code: "review_required" } } : {}),
    }).eq("id", claimed.id),
    admin.from("cast_posts").update({
      esutama_status: waitingForLogin || retry ? "pending" : "failed",
      esutama_error: message,
    }).eq("id", post.id),
    ...(loginRequired ? [admin.from("automation_connections").update({ status: "expired", last_error: message })
      .eq("store_id", post.store_id).eq("provider", "estama")] : []),
    ...(activationRequired ? [admin.from("external_cast_profiles").update({ soul_status: "issued", last_error: message })
      .eq("cast_id", post.cast_id).eq("provider", "estama")] : []),
  ]);
  const stateWriteError = stateWrites.find((write) => write.error)?.error;
  if (stateWriteError) {
    console.error(JSON.stringify({
      event: "estama_failure_state_persistence_failed",
      error: stateWriteError.message,
      reviewRequired,
    }));
  }
  await updateOverallStatus(admin, post.id);
  return json(req, {
    jobId: claimed.id,
    status: reviewRequired ? "review_required" : waitingForLogin || retry ? "pending" : "failed",
    error: message,
  }, waitingForLogin ? 409 : 422);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const body = await req.json() as JsonRecord;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (body.action === "claim-estama-worker") return claimEstamaWorker(req, admin, body);
    if (body.action === "create-therapist-post") return createTherapistPost(req, admin, body);

    const postId = stringValue(body.post_id);
    const accessToken = stringValue(body.access_token);
    const target = stringValue(body.target) || "o2";
    if (!postId || !accessToken) return json(req, { error: "投稿IDとポータルトークンが必要です" }, 400);
    if (!['o2', 'esutama'].includes(target)) return json(req, { error: "送信先が正しくありません" }, 400);
    const { data: post, error: postError } = await admin.from("cast_posts")
      .select("id,cast_id,store_id,title,body,image_urls,o2_status,esutama_status,o2_error,esutama_error,o2_attempts,esutama_attempts")
      .eq("id", postId)
      .maybeSingle<PostRecord>();
    if (postError) throw postError;
    const { data: cast } = post
      ? await admin.from("casts").select("id,access_token").eq("id", post.cast_id).eq("is_active", true).maybeSingle()
      : { data: null };
    if (!post || cast?.access_token !== accessToken) return json(req, { error: "ポータルの認証情報が正しくありません" }, 401);
    if (target === "esutama") return dispatchEstamaDiary(req, admin, post);
    if (post.o2_status === "posted") return json(req, { success: true, results: { o2: { status: "posted", skipped: true } } });
    if (post.o2_status === "posting") return json(req, { success: true, results: { o2: { status: "posting", skipped: true } } });

    try {
      const imageUrl = requireSinglePostImage(post.image_urls);
      await downloadImage(imageUrl, 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from("cast_posts").update({ o2_status: "failed", o2_error: message }).eq("id", post.id);
      await updateOverallStatus(admin, post.id);
      return json(req, { success: false, results: { o2: { status: "failed", error: message } } }, 422);
    }

    const { data: credential } = await admin.from("cast_site_credentials")
      .select("login_id,password")
      .eq("cast_id", post.cast_id)
      .eq("site", "o2")
      .maybeSingle();
    if (!credential?.login_id || !credential?.password) {
      const message = "O2のログイン情報が未設定です";
      await admin.from("cast_posts").update({ o2_status: "skipped", o2_error: message }).eq("id", post.id);
      await updateOverallStatus(admin, post.id);
      return json(req, { success: true, results: { o2: { status: "skipped", error: message } } });
    }

    const { data: locked } = await admin.from("cast_posts").update({
      o2_status: "posting",
      o2_error: null,
      o2_attempts: Number(post.o2_attempts || 0) + 1,
      last_attempt_at: new Date().toISOString(),
    }).eq("id", post.id).in("o2_status", ["pending", "failed", "skipped"]).select("id").maybeSingle();
    if (!locked) return json(req, { success: true, results: { o2: { status: "posting", skipped: true } } });

    try {
      const result = await postToO2(credential.login_id, credential.password, post);
      await admin.from("cast_posts").update({ o2_status: "posted", o2_error: null }).eq("id", post.id);
      await updateOverallStatus(admin, post.id);
      return json(req, { success: true, results: { o2: result } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from("cast_posts").update({ o2_status: "failed", o2_error: message }).eq("id", post.id);
      await updateOverallStatus(admin, post.id);
      return json(req, { success: false, results: { o2: { status: "failed", error: message } } }, 422);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(req, { error: message }, 500);
  }
});

async function updateOverallStatus(admin: ReturnType<typeof createClient>, postId: string) {
  const { data } = await admin.from("cast_posts").select("o2_status,esutama_status").eq("id", postId).single();
  if (!data) return;
  const statuses = [data.o2_status, data.esutama_status];
  const complete = statuses.every((status) => status === "posted");
  const failed = statuses.some((status) => status === "failed" || status === "skipped");
  await admin.from("cast_posts").update({
    status: complete ? "posted" : failed ? "failed" : "pending",
    posted_at: complete ? new Date().toISOString() : null,
  }).eq("id", postId);
}

const decodeHtml = (value: string) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#039;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

const attributes = (html: string) => {
  const result: Record<string, string> = {};
  for (const match of html.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = decodeHtml(match[2]);
  return result;
};

class CookieJar {
  values = new Map<string, string>();

  capture(response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = headers.getSetCookie?.() || [response.headers.get("set-cookie") || ""];
    for (const raw of cookies) {
      for (const part of raw.split(/,(?=[^;,]+=)/)) {
        const pair = part.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) this.values.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }
    }
  }

  header() {
    return [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function request(jar: CookieJar, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (jar.values.size) headers.set("Cookie", jar.header());
  headers.set("User-Agent", "Mozilla/5.0 (compatible; ZenryokuEstheTherapistPortal/1.0)");
  const response = await fetch(url, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  jar.capture(response);
  return response;
}

async function follow(jar: CookieJar, response: Response, fallbackUrl: string, maxRedirects = 5) {
  let current = response;
  let currentUrl = fallbackUrl;
  for (let index = 0; index < maxRedirects && [301, 302, 303, 307, 308].includes(current.status); index += 1) {
    const location = current.headers.get("location");
    const nextUrl = location ? new URL(location, currentUrl).toString() : O2_BASE;
    current = await request(jar, nextUrl, { method: "GET", headers: { Referer: currentUrl } });
    currentUrl = nextUrl;
  }
  return current;
}

type HtmlForm = { action: string; method: string; html: string; attributes: Record<string, string> };

const formsFrom = (html: string, baseUrl: string): HtmlForm[] => [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((match) => {
  const attrs = attributes(match[1]);
  return {
    action: new URL(attrs.action || baseUrl, baseUrl).toString(),
    method: (attrs.method || "post").toUpperCase(),
    html: match[2],
    attributes: attrs,
  };
});

const hiddenFields = (html: string) => {
  const fields = new Map<string, string>();
  for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = attributes(match[1]);
    if (attrs.name && (attrs.type || "text").toLowerCase() === "hidden") fields.set(attrs.name, attrs.value || "");
  }
  return fields;
};

const fieldNames = (html: string, tag: "input" | "textarea" | "button") => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))]
  .map((match) => attributes(match[1]))
  .filter((attrs) => attrs.name);

const findO2PostForm = (html: string, baseUrl: string) => formsFrom(html, baseUrl).find((form) => {
  const textareas = fieldNames(form.html, "textarea");
  const controls = [...fieldNames(form.html, "button"), ...fieldNames(form.html, "input")];
  return new URL(form.action).pathname === "/cast/post/create/" &&
    textareas.some((field) => field.name === "content") &&
    controls.some((field) => field.name === "status" && field.value === "published");
});

async function postToO2(loginId: string, password: string, post: PostRecord) {
  const jar = new CookieJar();
  const loginPage = await request(jar, O2_LOGIN);
  const loginHtml = await loginPage.text();
  const loginForm = formsFrom(loginHtml, O2_LOGIN).find((form) => /type=["']password/i.test(form.html));
  if (!loginForm) throw new Error("O2のログインフォームが見つかりません（画面仕様変更の可能性）");
  const loginBody = new URLSearchParams();
  for (const [name, value] of hiddenFields(loginForm.html)) loginBody.set(name, value);
  const loginFields = fieldNames(loginForm.html, "input");
  const passwordField = loginFields.find((field) => (field.type || "").toLowerCase() === "password");
  const identityField = loginFields.find((field) => {
    const type = (field.type || "text").toLowerCase();
    return ["text", "email", "tel"].includes(type) && /user|login|mail|email|account|member|cast|^id$/i.test(field.name);
  }) || loginFields.find((field) => ["text", "email", "tel"].includes((field.type || "text").toLowerCase()));
  const submitField = loginFields.find((field) => (field.type || "").toLowerCase() === "submit" && field.name);
  loginBody.set(identityField?.name || "username", loginId);
  loginBody.set(passwordField?.name || "password", password);
  if (submitField?.name) loginBody.set(submitField.name, submitField.value || "1");
  let loggedIn = await request(jar, loginForm.action, {
    method: loginForm.method,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: O2_LOGIN },
    body: loginBody.toString(),
  });
  loggedIn = await follow(jar, loggedIn, loginForm.action);
  let currentUrl = loggedIn.url || O2_BASE;
  const currentHtml = await loggedIn.text();
  if (loggedIn.status >= 400 || /name=["'](?:username|password)["']/i.test(currentHtml) && /ログイン/.test(currentHtml)) {
    throw new Error("O2へログインできません。ID・パスワードを確認してください");
  }

  let createPage = await request(jar, O2_POST_CREATE, { headers: { Referer: currentUrl } });
  createPage = await follow(jar, createPage, O2_POST_CREATE);
  currentUrl = createPage.url || O2_POST_CREATE;
  const createHtml = await createPage.text();
  if (/name=["'](?:username|password)["']/i.test(createHtml) && /ログイン/.test(createHtml)) {
    throw new Error("O2のログイン有効期限が切れました。投稿は完了していません");
  }
  const postForm = findO2PostForm(createHtml, currentUrl);
  if (!postForm) throw new Error("O2の投稿フォームが見つかりません（画面仕様変更の可能性）。投稿は行っていません");

  const form = new FormData();
  for (const [name, value] of hiddenFields(postForm.html)) form.set(name, value);
  const textareas = fieldNames(postForm.html, "textarea");
  const inputs = fieldNames(postForm.html, "input");
  const buttons = fieldNames(postForm.html, "button");
  const bodyName = textareas.find((field) => /body|content|text|message|post|caption/i.test(field.name))?.name || textareas[0]?.name;
  if (!bodyName) throw new Error("O2の投稿本文欄を特定できません。投稿は行っていません");
  form.set(bodyName, post.body);
  const titleName = inputs.find((field) => /title|subject/i.test(field.name))?.name;
  if (titleName && post.title) form.set(titleName, post.title);
  const publicVisibility = inputs.find((field) =>
    (field.type || "").toLowerCase() === "radio" && field.name === "visibility" && field.value === "public"
  );
  if (publicVisibility?.name) form.set(publicVisibility.name, publicVisibility.value || "public");
  const publishControl = [...buttons, ...inputs].find((field) =>
    (field.type || "").toLowerCase() === "submit" && field.name === "status" && field.value === "published"
  );
  if (publishControl?.name) form.set(publishControl.name, publishControl.value || "published");

  const fileFields = inputs.filter((field) => (field.type || "").toLowerCase() === "file");
  const imageUrls = [requireSinglePostImage(post.image_urls)];
  if (!fileFields.length) throw new Error("O2の画像入力欄が見つかりません。投稿は行っていません");
  const image = await downloadImage(imageUrls[0], 0);
  form.append(fileFields[0].name, image.blob, image.name);
  const attachedFiles = form.getAll(fileFields[0].name).filter((value) => value instanceof Blob);
  if (attachedFiles.length !== 1) {
    throw new Error(`O2の送信フォームへ画像を1枚設定できませんでした（設定${attachedFiles.length}枚）。投稿は行っていません`);
  }

  let posted = await request(jar, postForm.action, {
    method: postForm.method === "GET" ? "POST" : postForm.method,
    headers: { Referer: currentUrl },
    body: form,
  });
  posted = await follow(jar, posted, postForm.action);
  const responseHtml = await posted.text();
  if (posted.status >= 400) throw new Error(`O2投稿エラー（HTTP ${posted.status}）`);
  if (/name=["'](?:username|password)["']/i.test(responseHtml) && /ログイン/.test(responseHtml)) {
    throw new Error("O2のログイン有効期限が切れました。投稿は完了していません");
  }
  const errors = [...responseHtml.matchAll(/<(?:div|p|li)[^>]+class=["'][^"']*(?:error|danger|invalid)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|li)>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (errors.length) throw new Error(`O2: ${errors.join(" / ").slice(0, 300)}`);
  const responseUrl = posted.url || postForm.action;
  if (/\/cast\/post\/create\/?(?:\?|$)/i.test(responseUrl) && formsFrom(responseHtml, responseUrl).some((form) => /<textarea\b/i.test(form.html))) {
    throw new Error("O2が投稿を受け付けませんでした。入力項目の仕様変更を確認してください");
  }
  let verification = await request(jar, `${O2_BASE}/cast/post/`, { headers: { Referer: responseUrl } });
  verification = await follow(jar, verification, `${O2_BASE}/cast/post/`);
  const verificationHtml = await verification.text();
  const verificationText = decodeHtml(verificationHtml)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const expectedText = post.body.replace(/\s+/g, " ").trim();
  if (!expectedText || !verificationText.includes(expectedText)) {
    throw new Error("O2の投稿一覧で公開完了を確認できませんでした。投稿状態を確認してください");
  }
  return { status: "posted", url: verification.url || `${O2_BASE}/cast/post/`, images: 1 };
}

async function downloadImage(rawUrl: string, index: number) {
  const url = new URL(rawUrl);
  const allowed = url.protocol === "https:" && (
    url.hostname.endsWith(".supabase.co") ||
    url.hostname === "drive.google.com" ||
    url.hostname === "storage.googleapis.com"
  );
  if (!allowed) throw new Error(`画像${index + 1}の保存先が許可されていません`);
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`画像${index + 1}を取得できません（HTTP ${response.status}）`);
  const contentType = response.headers.get("content-type") || "";
  if (!/^image\/(jpeg|png|webp)$/i.test(contentType)) throw new Error(`画像${index + 1}はJPEG・PNG・WebPのみ対応です`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 10 * 1024 * 1024) throw new Error(`画像${index + 1}が10MBを超えています`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error(`画像${index + 1}が10MBを超えています`);
  assertRequiredPostImageSize(new Uint8Array(buffer), contentType);
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return { blob: new Blob([buffer], { type: contentType }), name: `photo-${index + 1}.${extension}` };
}
