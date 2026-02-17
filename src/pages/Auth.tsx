import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import caskanLogo from "@/assets/caskan-logo.png";

const authSchema = z.object({
  email: z.string().email({ message: "正しいメールアドレスを入力してください" }),
  password: z.string().min(6, { message: "パスワードは6文字以上で入力してください" }),
  displayName: z.string().optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "全力エステ - ログイン";
  }, []);

  useEffect(() => {
    // 既にログインしている場合はダッシュボードにリダイレクト
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // バリデーション
      const validatedData = authSchema.parse({
        email,
        password,
        displayName: isLogin ? undefined : displayName,
      });

      if (isLogin) {
        // ログイン
        const { error } = await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("メールアドレスまたはパスワードが正しくありません");
          }
          throw error;
        }

        toast({
          title: "ログイン成功",
          description: "管理画面にアクセスできます",
        });
      } else {
        // サインアップ
        const redirectUrl = `${window.location.origin}/dashboard`;
        
        const { error } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: validatedData.displayName || "",
            },
          },
        });

        if (error) {
          if (error.message.includes("User already registered")) {
            throw new Error("このメールアドレスは既に登録されています");
          }
          throw error;
        }

        toast({
          title: "アカウント作成成功",
          description: "ログインできます",
        });
        
        setIsLogin(true);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "入力エラー",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: isLogin ? "ログインエラー" : "アカウント作成エラー",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Caskan Logo */}
      <div className="mb-6">
        <img 
          src={caskanLogo} 
          alt="Caskan" 
          className="h-16"
        />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[500px] bg-white rounded shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-3 border-b border-gray-200" style={{ backgroundColor: '#fafafa' }}>
          <h2 className="text-base font-normal text-foreground">
            {isLogin ? "スタッフログイン" : "新規登録"}
          </h2>
        </div>

        {/* Form */}
        <div className="px-6 py-5">
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">表示名</label>
                <input
                  type="text"
                  placeholder="山田太郎"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-1">店舗ID</label>
              <input
                type="text"
                value="zenryoku1209"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">ログインIDまたはメールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-400"
              />
            </div>

            {isLogin && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">パスワード</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">パスワード</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-12 py-2 rounded text-white text-sm font-normal disabled:opacity-50"
                style={{ backgroundColor: '#6aab35' }}
              >
                {loading ? "処理中..." : isLogin ? "次へ" : "アカウント作成"}
              </button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm hover:underline"
              style={{ color: '#6aab35' }}
              disabled={loading}
            >
              {isLogin 
                ? "キャストのログインはこちら" 
                : "既にアカウントをお持ちの方はこちら"}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto py-6 text-center text-xs text-gray-400">
        © 2026 caskan.jp All rights reserved
      </div>
    </div>
  );
}
