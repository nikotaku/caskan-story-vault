import { supabase } from "@/integrations/supabase/client";

/**
 * 管理画面の店舗切替。各店舗は専用アカウント（同一パスワード）に紐付いており、
 * トグルで「相手店舗のアカウントに再ログイン → リロード」して切り替える。
 * RLS（store_isolation）が店舗ごとにデータを分離するため、混在は起きない。
 */

export const ZENRYOKU_STORE_ID = "00000000-0000-0000-0000-000000000001";
export const ENKA_STORE_ID = "404499ab-5350-490f-9608-5814faffda6f";

export interface StoreDef {
  id: string;
  name: string;
  short: string; // ロゴ代わりの短縮表記（艶華="艶"）
  email: string;
}

export const STORE_DEFS: StoreDef[] = [
  { id: ZENRYOKU_STORE_ID, name: "過去データ", short: "旧", email: "saito.crow@gmail.com" },
  { id: ENKA_STORE_ID, name: "艶華", short: "艶", email: "saito.crow+enka@gmail.com" },
];

export function otherStore(currentId: string): StoreDef | null {
  return STORE_DEFS.find((s) => s.id !== currentId) ?? null;
}

/**
 * 相手店舗のアカウントへ再ログインしてリロード。
 * パスワードは引数優先、無ければ sessionStorage の保持分を使う。
 * どちらも無い場合は needLogin を返し、呼び出し側でパスワード入力ダイアログを出す。
 */
export async function switchToStore(
  target: StoreDef,
  password?: string,
): Promise<{ ok: boolean; needLogin?: boolean; error?: string }> {
  const pw = password || (() => { try { return sessionStorage.getItem("admin_pw"); } catch { return null; } })();
  if (!pw) return { ok: false, needLogin: true };

  const { error } = await supabase.auth.signInWithPassword({ email: target.email, password: pw });
  if (error) {
    const msg = error.message.includes("Invalid login credentials")
      ? "パスワードが正しくありません"
      : error.message;
    return { ok: false, error: msg };
  }
  // 成功時のみ保存（次回以降はダイアログなしで切り替え可能に）
  try { sessionStorage.setItem("admin_pw", pw); } catch { /* noop */ }
  localStorage.setItem("current_store_id", target.id);
  return { ok: true };
}
