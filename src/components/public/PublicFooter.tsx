import { useEffect, useState } from "react";
import o2Logo from "@/assets/o2-logo.png";
import { useStore } from "@/hooks/useStore";
import { useStoreContact } from "@/hooks/useStoreContact";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_X_URL = "https://x.com/enka_salon";

export const PublicFooter = () => {
  const { lineUrl } = useStoreContact();
  const { store, storeId, loading: storeLoading } = useStore();
  const [xUrl, setXUrl] = useState(DEFAULT_X_URL);
  const [o2Url, setO2Url] = useState("");
  const storeName = store?.name ?? "艶華";

  useEffect(() => {
    if (storeLoading) return;
    supabase
      .from("site_content")
      .select("key, value")
      .eq("store_id", storeId)
      .in("key", ["store_sns_x", "store_sns_o2"])
      .then(({ data }) => {
        const links = new Map((data || []).map((row: { key: string; value: string }) => [row.key, row.value]));
        setXUrl(links.get("store_sns_x") || DEFAULT_X_URL);
        setO2Url(links.get("store_sns_o2") || "");
      });
  }, [storeId, storeLoading]);

  return (
    <footer className="text-white" style={{ backgroundColor: "var(--pub-dark,#242220)" }}>
      {/* SNS Icons */}
      <div className="container mx-auto px-4 py-5 max-w-4xl">
        <div className="flex justify-center gap-4">
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80"
          >
            <img
              src="https://storage.googleapis.com/caskan/asset/line_icon.png"
              alt="LINE"
              className="w-9 h-9"
            />
          </a>
          <a
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80"
          >
            <img
              src="https://cdn2-caskan.com/caskan/asset/sns/x.png"
              alt="X"
              className="w-9 h-9"
            />
          </a>
          {o2Url && (
            <a
              href={o2Url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="店舗公式02"
              className="hover:opacity-80"
            >
              <img
                src={o2Logo}
                alt="02"
                className="w-9 h-9 rounded-full bg-white object-contain"
              />
            </a>
          )}
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © 2025 {storeName}. All rights reserved.
      </div>
    </footer>
  );
};
