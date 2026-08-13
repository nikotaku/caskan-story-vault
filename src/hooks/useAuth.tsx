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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const [adminResult, { data: profileData }] = await Promise.all([
              checkIsAdmin(session.user.id),
              supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", session.user.id)
                .maybeSingle(),
            ]);
            setIsAdmin(adminResult);
            setDisplayName(profileData?.display_name || session.user.email || null);
          }, 0);
        } else {
          setIsAdmin(false);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(async () => {
          const [adminResult, { data: profileData }] = await Promise.all([
            checkIsAdmin(session.user.id),
            supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", session.user.id)
              .maybeSingle(),
          ]);
          setIsAdmin(adminResult);
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
