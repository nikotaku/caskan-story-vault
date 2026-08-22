import { useStore } from "@/hooks/useStore";
import Top from "@/pages/public/Top";
import EnkaHome from "@/pages/public/EnkaHome";

/**
 * "/" のトップページを店舗ごとに出し分ける。
 * デフォルト店舗は従来の Top、それ以外は専用トップを表示。
 */
export default function StoreTop() {
  const { store, loading } = useStore();

  if (loading) {
    return <div className="min-h-screen" style={{ backgroundColor: "#100810" }} />;
  }

  return store && !store.is_default ? <EnkaHome /> : <Top />;
}
