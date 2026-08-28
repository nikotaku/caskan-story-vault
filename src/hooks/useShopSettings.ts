import { useState, useEffect, useMemo } from "react";
import { subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAdminStore } from "@/hooks/useAdminStore";
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from "@/lib/availability";

interface ShopSettings {
  business_day_start: string;
  reservation_interval_minutes: number;
}

const DEFAULT_SETTINGS: ShopSettings = {
  business_day_start: "10:00",
  reservation_interval_minutes: DEFAULT_RESERVATION_INTERVAL_MINUTES,
};

const cachedSettingsByStore: Record<string, ShopSettings> = {};
let lastCachedSettings: ShopSettings | null = null;

/** ページ初期化時（useState lazy init）で使う。キャッシュがあればそこから、なければ暦日ベースの今日を返す */
export function getBusinessDateFromCache(): Date {
  const now = new Date();
  if (!lastCachedSettings) return now;
  const h = parseInt(lastCachedSettings.business_day_start.split(":")[0], 10);
  return now.getHours() < h ? subDays(now, 1) : now;
}

export function useShopSettings() {
  const { storeId, loading: storeLoading } = useAdminStore();
  const [settings, setSettings] = useState<ShopSettings>(
    cachedSettingsByStore[storeId] ?? DEFAULT_SETTINGS,
  );
  const [loaded, setLoaded] = useState(Boolean(cachedSettingsByStore[storeId]));

  useEffect(() => {
    if (storeLoading) return;
    const cached = cachedSettingsByStore[storeId];
    if (cached) {
      setSettings(cached);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    supabase
      .from("shop_settings" as any)
      .select("business_day_start, reservation_interval_minutes")
      .eq("store_id", storeId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const s = data as ShopSettings | null;
        const resolved = s?.business_day_start
          ? {
              ...s,
              reservation_interval_minutes:
                s.reservation_interval_minutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES,
            }
          : DEFAULT_SETTINGS;
        cachedSettingsByStore[storeId] = resolved;
        lastCachedSettings = resolved;
        setSettings(resolved);
        setLoaded(true);
      });
  }, [storeId, storeLoading]);

  // Returns "HH:MM:SS" format for SQL comparisons
  const dayStartTime = settings.business_day_start.length === 5
    ? settings.business_day_start + ":00"
    : settings.business_day_start;

  // 「今日」の営業日: dayStartHour前は前日扱い
  const businessToday = useMemo(() => {
    const h = parseInt(settings.business_day_start.split(":")[0], 10);
    const now = new Date();
    return now.getHours() < h ? subDays(now, 1) : now;
  }, [settings.business_day_start]);

  const intervalMinutes =
    settings.reservation_interval_minutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES;

  return { settings, loaded, dayStartTime, businessToday, intervalMinutes };
}
