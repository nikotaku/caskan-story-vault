import { supabase } from "@/integrations/supabase/client";

export type EstamaRunResult = {
  results: Array<{
    id: string;
    status: string;
    error?: string;
    result?: Record<string, unknown>;
  }>;
};

async function requestEstamaAutomation(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("ログインが期限切れです");
  const response = await fetch("/api/automations/estama", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "エスたま自動化の実行に失敗しました");
  return result;
}

export async function runEstamaCastAutomation(input: {
  storeId: string;
  castId: string;
  soulCredentials?: { email: string; password: string };
}): Promise<EstamaRunResult> {
  return requestEstamaAutomation({
    action: "run-cast",
    storeId: input.storeId,
    castId: input.castId,
    soulCredentials: input.soulCredentials,
  }) as Promise<EstamaRunResult>;
}

export async function runQueuedEstamaAutomation(storeId: string): Promise<EstamaRunResult> {
  return requestEstamaAutomation({ action: "run-queued", storeId }) as Promise<EstamaRunResult>;
}
