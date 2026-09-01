import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  // user_rolesを使わない店舗環境では、owner/managerの所属を管理権限として扱う。
  // どちらの照会にも失敗した場合は fail closed にする。
  if (error || !data) {
    const { data: membership, error: membershipError } = await supabase
      .from("user_stores")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["owner", "manager"])
      .limit(1)
      .maybeSingle();
    if (membershipError) {
      console.error("Failed to verify admin role", error || membershipError);
      return false;
    }
    return !!membership;
  }
  return !!data;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let sessionRequestId = 0;

    const resolveSession = (nextSession: Session | null) => {
      const requestId = ++sessionRequestId;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setIsAdmin(false);
        setDisplayName(null);
        setLoading(false);
        return;
      }

      // 管理者権限の確認が終わるまでは認証処理中として扱う。
      // isAdmin の初期値 false を見て、管理画面からログインへ戻される競合を防ぐ。
      setLoading(true);
      setTimeout(async () => {
        const [adminResult, { data: profileData }] = await Promise.all([
          checkIsAdmin(nextSession.user.id),
          supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", nextSession.user.id)
            .maybeSingle(),
        ]);

        if (!active || requestId !== sessionRequestId) return;
        setIsAdmin(adminResult);
        setDisplayName(profileData?.display_name || nextSession.user.email || null);
        setLoading(false);
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => resolveSession(nextSession)
    );

    void supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (active) resolveSession(nextSession);
    });

    return () => {
      active = false;
      sessionRequestId += 1;
      subscription.unsubscribe();
    };
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
