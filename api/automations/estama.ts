import {
  assertStoreManager,
  authenticateUser,
  enqueueCastJob,
  getConnection,
  processAvailableJobs,
  startLoginSetup,
  verifyLoginSetup,
  type SoulCredentials,
} from "../../server/estama-automation.js";

export const config = { maxDuration: 300 };

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
};
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const stringValue = (value: unknown) => typeof value === "string" ? value : "";

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { admin, user } = await authenticateUser(req);
    const source = req.method === "GET" ? req.query || {} : req.body || {};
    const storeId = stringValue(source.storeId);
    if (!storeId) throw new Error("storeId が必要です");
    await assertStoreManager(admin, user.id, storeId);

    if (req.method === "GET") {
      const [connection, jobsResult] = await Promise.all([
        getConnection(admin, storeId),
        admin.from("automation_jobs").select("id,job_type,status,cast_id,error_message,created_at,finished_at")
          .eq("store_id", storeId).eq("provider", "estama").order("created_at", { ascending: false }).limit(10),
      ]);
      res.status(200).json({ connection, jobs: jobsResult.data || [] });
      return;
    }

    const action = stringValue(source.action);
    if (action === "setup") {
      const result = await startLoginSetup(admin, storeId);
      res.status(200).json(result);
      return;
    }
    if (action === "verify") {
      const connection = await verifyLoginSetup(admin, storeId);
      res.status(200).json({ connection });
      return;
    }
    if (action === "run-cast") {
      const castId = stringValue(source.castId);
      if (!castId) throw new Error("castId が必要です");
      const { data: cast } = await admin.from("casts").select("id,store_id,o2_login_email").eq("id", castId).eq("store_id", storeId).maybeSingle();
      if (!cast) throw new Error("対象セラピストが見つかりません");
      const jobId = await enqueueCastJob(admin, storeId, castId);
      const rawCredentials = source.soulCredentials && typeof source.soulCredentials === "object"
        ? source.soulCredentials as Record<string, unknown>
        : {};
      let soulCredentials: SoulCredentials | undefined =
        stringValue(rawCredentials.loginId) && stringValue(rawCredentials.password)
          ? {
            loginId: stringValue(rawCredentials.loginId),
            password: stringValue(rawCredentials.password),
            email: stringValue(rawCredentials.email) || stringValue(cast.o2_login_email) || undefined,
          }
          : undefined;
      if (!soulCredentials) {
        const { data: storedCredentials, error: credentialsError } = await admin.from("cast_site_credentials")
          .select("login_id,password")
          .eq("store_id", storeId)
          .eq("cast_id", castId)
          .eq("site", "o2")
          .maybeSingle();
        if (credentialsError) throw credentialsError;
        const loginId = stringValue(storedCredentials?.login_id);
        const password = stringValue(storedCredentials?.password);
        if (loginId && password) {
          soulCredentials = { loginId, password, email: stringValue(cast.o2_login_email) || undefined };
        }
      }
      const results = await processAvailableJobs(admin, { jobId, limit: 1, soulCredentials });
      res.status(200).json({ results });
      return;
    }
    if (action === "run-profile-sync") {
      const castId = stringValue(source.castId);
      if (!castId) throw new Error("castId が必要です");
      const [{ data: cast }, { data: profile }] = await Promise.all([
        admin.from("casts").select("id,store_id").eq("id", castId).eq("store_id", storeId).maybeSingle(),
        admin.from("external_cast_profiles").select("sync_status").eq("cast_id", castId).eq("provider", "estama").maybeSingle(),
      ]);
      if (!cast) throw new Error("対象セラピストが見つかりません");
      if (profile?.sync_status !== "synced") {
        res.status(200).json({ results: [], skipped: true, reason: "profile_not_linked" });
        return;
      }
      const { data: activeJob } = await admin.from("automation_jobs")
        .select("id,status")
        .eq("store_id", storeId)
        .eq("provider", "estama")
        .eq("job_type", "estama_register_cast")
        .eq("cast_id", castId)
        .in("status", ["queued", "running", "waiting_for_login"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeJob?.status === "running") {
        res.status(200).json({ results: [], skipped: true, reason: "already_running" });
        return;
      }
      const jobId = activeJob?.status === "queued"
        ? activeJob.id
        : await enqueueCastJob(admin, storeId, castId, "profile_update");
      const results = await processAvailableJobs(admin, { jobId, limit: 1 });
      res.status(200).json({ results });
      return;
    }
    if (action === "run-queued") {
      const results = await processAvailableJobs(admin, { storeId, limit: Number(source.limit) || 20 });
      res.status(200).json({ results });
      return;
    }
    throw new Error("未対応の操作です");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unauthorized = /認証|ログインが期限切れ/.test(message);
    const forbidden = /権限/.test(message);
    res.status(unauthorized ? 401 : forbidden ? 403 : 400).json({ error: message });
  }
}
