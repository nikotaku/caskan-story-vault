import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { useStoreContact } from "@/hooks/useStoreContact";
import { useStore } from "@/hooks/useStore";

interface BackRate {
  id: string;
  course_type: string;
  duration: number;
  customer_price: number;
  description?: string | null;
}

interface OptionRate {
  id: string;
  option_name: string;
  customer_price: number;
}

interface NominationRate {
  id: string;
  nomination_type: string;
  customer_price: number;
}

const System = () => {
  const { store, storeId } = useStore();
  const storeName = store?.name ?? "艶華";
  const isDefaultStore = store?.is_default ?? true;
  // 店舗情報テーブル用：独自ドメインがあればそれを、なければ既定値を表示
  const siteUrl = store?.custom_domain
    ? `https://${store.custom_domain}`
    : isDefaultStore
      ? "https://enka-salon.jp"
      : window.location.origin;
  const areaLabel = isDefaultStore ? "出張専門" : "マンション（個室）";
  const { telHref, phoneDisplay } = useStoreContact();
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = `${storeName} - システム`; }, [storeName]);

  useEffect(() => { fetchPricing(); }, [storeId]);

  const c = (key: string, fallback = "") => content[key] ?? fallback;

  const fetchPricing = async () => {
    try {
      const [backRes, optionRes, nominationRes, contentRes] = await Promise.all([
        supabase.rpc('get_public_back_rates', { p_store_id: storeId } as any),
        supabase.from('option_rates').select('*').eq('store_id', storeId).order('display_order', { ascending: true }),
        supabase.from('nomination_rates').select('*').eq('store_id', storeId).order('created_at', { ascending: true }),
        supabase.from('site_content').select('key, value').eq('store_id', storeId),
      ]);
      if (backRes.error) throw backRes.error;
      if (optionRes.error) throw optionRes.error;
      if (nominationRes.error) throw nominationRes.error;
      // Wセラピスト専用コース・オプションはHPには掲載しない（専用フォーム限定）
      setBackRates(((backRes.data || []) as any[]).filter((r) => r.course_type !== "全力W") as any);
      setOptionRates((optionRes.data || []).filter((o: any) => !["全力PKG1W", "全力PKG2W"].includes(o.option_name)));
      setNominationRates(nominationRes.data || []);
      const map: Record<string, string> = {};
      (contentRes.data || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
      setContent(map);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const courseTypes = [...new Set(backRates.filter(r => r.course_type !== 'DR').map(r => r.course_type))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--pub-accent,#c6a15b)] mx-auto mb-4"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
      <PublicNavigation />

      <main className="container mx-auto px-3 md:px-4 py-5 md:py-12 max-w-3xl">
        <div className="bg-[var(--pub-card,#1a150f)] rounded-lg shadow-lg p-4 md:p-8 mb-5 md:mb-8">
          <div className="text-center mb-5 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2" style={{ color: "var(--pub-text,#f0e6d2)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>SYSTEM</h1>
            <p className="text-sm" style={{ color: "var(--pub-text-muted,#a3987f)", letterSpacing: "0.1em" }}>{c("system_title", "料金システム")}</p>
          </div>

          {c("system_intro") && (
            <div className="mb-8 text-sm leading-relaxed text-[var(--pub-text-mid,#d9cdb4)] whitespace-pre-wrap text-center">
              {c("system_intro")}
            </div>
          )}

          <div className="text-center mb-12">
            <h2 className="text-5xl font-bold mb-2" style={{ color: "var(--pub-accent,#c6a15b)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.1em" }}>{storeName}</h2>
          </div>

          {/* コース別料金（back_ratesマスター） */}
          {courseTypes.map((type) => {
            const rates = backRates.filter(r => r.course_type === type).sort((a, b) => a.duration - b.duration);
            return (
              <div key={type} className="mb-10">
                <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-2.5 mb-4 rounded">
                  <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>{type}コース</h3>
                </div>
                <div className="space-y-2">
                  {rates.map((rate) => (
                    <div key={rate.id} className="py-2 border-b border-[var(--pub-border,#3a2f1c)] last:border-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--pub-text-mid,#d9cdb4)] text-sm">{rate.duration}min</span>
                        <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold text-sm">¥{rate.customer_price.toLocaleString()}</span>
                      </div>
                      {rate.description && (
                        <p className="text-[var(--pub-text-muted,#a3987f)] text-xs mt-1 leading-relaxed">{rate.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* DRコース */}
          {backRates.filter(r => r.course_type === 'DR').length > 0 && (
            <div className="mb-10">
              <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-2.5 mb-4 rounded">
                <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>DRコース</h3>
              </div>
              <div className="space-y-2">
                {backRates.filter(r => r.course_type === 'DR').sort((a, b) => a.duration - b.duration).map((rate) => (
                  <div key={rate.id} className="flex justify-between items-center py-2 border-b border-[var(--pub-border,#3a2f1c)] last:border-0">
                    <span className="text-[var(--pub-text-mid,#d9cdb4)] text-sm">{rate.duration}min</span>
                    <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold text-sm">¥{rate.customer_price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* オプション（option_ratesマスター） */}
          <div className="mb-10">
            <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>オプションメニュー</h3>
            </div>
            <div className="space-y-2">
              {optionRates.map((opt) => (
                <div key={opt.id} className="flex justify-between items-center py-2 border-b border-[var(--pub-border,#3a2f1c)] last:border-0">
                  <span className="text-[var(--pub-text-mid,#d9cdb4)] text-sm">{opt.option_name}</span>
                  <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold text-sm">¥{opt.customer_price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 注意書き（site_content: system_note） */}
          {c("system_note") && (
            <p className="text-[var(--pub-text-muted,#a3987f)] text-xs mb-8 whitespace-pre-wrap leading-relaxed">
              {c("system_note")}
            </p>
          )}

          {/* 指名料（nomination_ratesマスター） */}
          {nominationRates.length > 0 && (
            <div className="mb-10">
              <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-2.5 mb-4 rounded">
                <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>指名料</h3>
              </div>
              <div className="space-y-2">
                {nominationRates.map((nom) => (
                  <div key={nom.id} className="flex justify-between items-center py-2 border-b border-[var(--pub-border,#3a2f1c)] last:border-0">
                    <span className="text-[var(--pub-text-mid,#d9cdb4)] text-sm">{nom.nomination_type}</span>
                    <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold text-sm">¥{nom.customer_price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="mb-10">
            <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-2.5 mb-4 rounded">
              <h3 className="font-bold text-base" style={{ letterSpacing: "0.1em" }}>お支払い</h3>
            </div>
            <div className="space-y-2">
              {['現金', 'クレジット', '電子マネー'].map((m) => (
                <div key={m} className="flex justify-between items-center py-2 border-b border-[var(--pub-border,#3a2f1c)] last:border-0">
                  <span className="text-[var(--pub-text-mid,#d9cdb4)] text-sm">{m}</span>
                  <span className="text-[var(--pub-text-mid,#d9cdb4)] text-sm">◯</span>
                </div>
              ))}
            </div>
          </div>

          {/* Flow */}
          {c("system_flow_text") && (
            <div className="mb-10">
              <div className="text-center mb-4">
                <h3 className="text-xl md:text-2xl font-bold" style={{ color: "var(--pub-text,#f0e6d2)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>FLOW</h3>
                <p className="text-xs mt-1" style={{ color: "var(--pub-text-muted,#a3987f)" }}>{c("system_flow_title", "ご利用方法")}</p>
              </div>
              <div className="border-l-4 border-[var(--pub-accent,#c6a15b)] pl-4 text-sm text-[var(--pub-text-mid,#d9cdb4)] whitespace-pre-wrap leading-relaxed">
                {c("system_flow_text")}
              </div>
            </div>
          )}

          {/* Notice */}
          {c("system_notice_text") && (
            <div className="mb-10">
              <div className="text-center mb-4">
                <h3 className="text-xl md:text-2xl font-bold" style={{ color: "var(--pub-text,#f0e6d2)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>NOTICE</h3>
                <p className="text-xs mt-1" style={{ color: "var(--pub-text-muted,#a3987f)" }}>{c("system_notice_title", "注意事項")}</p>
              </div>
              <div className="text-xs text-[var(--pub-text-mid,#d9cdb4)] leading-relaxed whitespace-pre-wrap">
                {c("system_notice_text")}
              </div>
            </div>
          )}

          {/* Shop Info */}
          <div className="mb-8">
            <div className="text-center mb-4">
              <h3 className="text-xl md:text-2xl font-bold" style={{ color: "var(--pub-text,#f0e6d2)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>SHOP</h3>
              <p className="text-xs mt-1" style={{ color: "var(--pub-text-muted,#a3987f)" }}>店舗情報</p>
            </div>
            <div className="bg-[var(--pub-card,#1a150f)] rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['店舗名', storeName],
                    ['URL', null],
                    ['営業時間', '12:00〜26:00(24:40最終受付)'],
                    ['TEL', null],
                    ['最寄り駅', '北四番丁駅｜勾当台公園駅｜仙台駅'],
                    ['定休日', '年中無休'],
                    ['エリア', areaLabel],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-[var(--pub-border,#3a2f1c)]">
                      <td className="py-3 px-4 font-bold text-[var(--pub-text,#f0e6d2)] w-1/3 bg-[var(--pub-card2,#221b12)] align-top">{k}</td>
                      <td className="py-3 px-4 text-[var(--pub-text-mid,#d9cdb4)]">
                        {k === 'URL' ? (
                          <a href={siteUrl} className="text-[var(--pub-accent,#c6a15b)] hover:underline">{siteUrl}</a>
                        ) : k === 'TEL' ? (
                          <a href={telHref} className="hover:underline">{phoneDisplay}</a>
                        ) : v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={telHref}>
              <Button size="lg" className="gap-2 min-w-[200px] bg-[var(--pub-accent,#c6a15b)] hover:bg-[var(--pub-accent-deep,#a87c2a)]">
                <Phone size={20} />電話で予約
              </Button>
            </a>
            <Link to="/casts">
              <Button size="lg" variant="outline" className="gap-2 min-w-[200px] bg-transparent border-[var(--pub-accent,#c6a15b)] text-[var(--pub-text,#f0e6d2)] hover:bg-[var(--pub-card2,#221b12)] hover:text-[var(--pub-text,#f0e6d2)]">
                <Calendar size={20} />キャスト一覧
              </Button>
            </Link>
          </div>

          {/* 特定商取引法に基づく表示（site_content: tokusho / 設定店舗のみ表示） */}
          {c("tokusho").trim() && (
            <div className="mt-12 pt-8 border-t border-[var(--pub-border,#3a2f1c)]">
              <div className="text-center mb-4">
                <h3 className="text-lg md:text-xl font-bold" style={{ color: "var(--pub-text,#f0e6d2)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.15em" }}>
                  特定商取引法に基づく表示
                </h3>
              </div>
              <div className="text-xs leading-relaxed whitespace-pre-wrap max-w-2xl mx-auto" style={{ color: "var(--pub-text-muted,#a3987f)" }}>
                {c("tokusho")}
              </div>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
};

export default System;
