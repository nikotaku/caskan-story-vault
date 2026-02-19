import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 認証状態リスナーを設定
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', { event, userId: session?.user?.id, email: session?.user?.email });
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // 管理者権限をチェック & プロフィール取得
          setTimeout(async () => {
            const [{ data: roleData }, { data: profileData }] = await Promise.all([
              supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id)
                .eq("role", "admin")
                .maybeSingle(),
              supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", session.user.id)
                .maybeSingle(),
            ]);
            
            console.log('Admin check result:', { userId: session.user.id, data: roleData, isAdmin: !!roleData });
            setIsAdmin(!!roleData);
            setDisplayName(profileData?.display_name || session.user.email || null);
          }, 0);
        } else {
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    // 既存のセッションを確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          const [{ data: roleData }, { data: profileData }] = await Promise.all([
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .eq("role", "admin")
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", session.user.id)
              .maybeSingle(),
          ]);
          
          setIsAdmin(!!roleData);
          setDisplayName(profileData?.display_name || session.user.email || null);
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setDisplayName(null);
    navigate("/auth");
  };

  return {
    user,
    session,
    loading,
    isAdmin,
    displayName,
    signOut,
  };
}
