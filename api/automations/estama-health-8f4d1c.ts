type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

export default function handler(_req: unknown, res: ResponseLike) {
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({
    browserbaseApiKey: Boolean(process.env.BROWSERBASE_API_KEY),
    browserbaseProjectId: Boolean(process.env.BROWSERBASE_PROJECT_ID),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
  });
}
