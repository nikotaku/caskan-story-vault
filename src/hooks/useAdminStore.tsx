import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_STORE_ID } from "@/hooks/useStore";
import { STORE_DEFS } from "@/lib/storeSwitch";

/**
 * 管理画面用：ログイン中ユーザーの所属店舗（user_stores→stores）を返す。
 * 全力エステのアカウントなら全力エステ、艶花のアカウントなら艶花になる。
 */

interface AdminStore {
  id: string;
  name: string;
  slug: string;
  custom_domain?: string | null;
}

const cachedByUser: Record<string, AdminStore> = {};

export const useAdminStore = () => {
  const { user } = useAuth();
  const cached = user ? cachedByUser[user.id] : undefined;
  const [store, setStore] = useState<AdminStore | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!user) return;
    if (cachedByUser[user.id]) {
      setStore(cachedByUser[user.id]);
      setLoading(false);
      return;
    }
    supabase
      .from("user_stores")
      .select("store_id, stores(id, name, slug, custom_domain)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const memberships = data ?? [];
        const accountStoreId = STORE_DEFS.find(
          (definition) => definition.email.toLowerCase() === user.email?.toLowerCase(),
        )?.id;
        let rememberedStoreId: string | null = null;
        try {
          rememberedStoreId = localStorage.getItem("current_store_id");
        } catch {
          // localStorage が使えない環境では、ログインアカウントに対応する店舗を使う
        }
        const membership = memberships.find((row) => row.store_id === accountStoreId)
          ?? memberships.find((row) => row.store_id === rememberedStoreId)
          ?? memberships[0];
        const s = membership?.stores;
        const resolved: AdminStore = s
          ? { id: s.id, name: s.name, slug: s.slug, custom_domain: s.custom_domain }
          : { id: DEFAULT_STORE_ID, name: "全力エステ 仙台", slug: "main", custom_domain: null };
        try {
          localStorage.setItem("current_store_id", resolved.id);
        } catch {
          // 保存できなくても、現在の表示には影響しない
        }
        cachedByUser[user.id] = resolved;
        setStore(resolved);
        setLoading(false);
      });
  }, [user]);

  return { store, storeId: store?.id ?? DEFAULT_STORE_ID, loading };
};
