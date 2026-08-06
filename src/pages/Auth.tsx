import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import caskanLogo from "@/assets/caskan-logo.png";
import { ENKA_STORE_ID, ZENRYOKU_STORE_ID } from "@/lib/storeSwitch";

// 共通パスワードを入力後、どちらの店舗の管理画面に入るかを選ぶ。
// 各店舗の管理アカウント（同一パスワード）へサインインする。
const STORE_OPTIONS = [
  { key: "zenryoku", label: "全力エステ 仙台", email: "saito.crow@gmail.com", storeId: ZENRYOKU_STORE_ID },
  { key: "enka", label: "艶華", email: "saito.crow+enka@gmail.com", storeId: ENKA_STORE_ID },
];

export default function Auth() {
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"password" | "store">("password");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "管理ログイン";
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") navigate("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // パスワード入力後、店舗選択へ進む
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setStep("store");
  };

  // 選んだ店舗のアカウントでサインイン
  const handleSelectStore = async (email: string, storeId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("パスワードが正しくありません");
        }
        throw error;
      }
      // 店舗切替トグル用にパスワードを一時保持（タブを閉じると消える）
      try { sessionStorage.setItem("admin_pw", password); } catch { /* noop */ }
      try { localStorage.setItem("current_store_id", storeId); } catch { /* noop */ }
      toast({ title: "ログイン成功" });
    } catch (error) {
      toast({
        title: "ログインエラー",
        description: error instanceof Error ? error.message : "ログインに失敗しました",
        variant: "destructive",
      });
      // パスワードが違う場合はパスワード入力に戻す
      setStep("password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="mb-6">
        <img src={caskanLogo} alt="Caskan" className="h-16" />
      </div>

      <div className="w-full max-w-[500px] bg-white rounded shadow-sm border border-gray-200">
        <div className="px-6 py-3 border-b border-gray-200" style={{ backgroundColor: '#fafafa' }}>
          <h2 className="text-base font-normal text-foreground">
            {step === "password" ? "ログイン" : "店舗を選択"}
          </h2>
        </div>

        <div className="px-6 py-5">
          {step === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">パスワード</label>
                <input
                  type="password"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-400"
                />
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  className="px-12 py-2 rounded text-white text-sm font-normal disabled:opacity-50"
                  style={{ backgroundColor: '#6aab35' }}
                >
                  次へ
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center mb-4">
                入る店舗を選んでください
              </p>
              {STORE_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleSelectStore(s.email, s.storeId)}
                  disabled={loading}
                  className="w-full py-3 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => setStep("password")}
                disabled={loading}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600"
              >
                ← パスワード入力に戻る
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto py-6 text-center text-xs text-gray-400">
        © 2026 caskan.jp All rights reserved
      </div>
    </div>
  );
}
