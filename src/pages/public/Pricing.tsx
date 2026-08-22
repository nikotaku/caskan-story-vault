import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Phone, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import caskanLogo from "@/assets/caskan-logo.png";
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
  description?: string;
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

export default function Pricing() {
  const { telHref } = useStoreContact();
  const { store, storeId } = useStore();
  const storeName = store?.name ?? "艶華";
  const [backRates, setBackRates] = useState<BackRate[]>([]);
  const [optionRates, setOptionRates] = useState<OptionRate[]>([]);
  const [nominationRates, setNominationRates] = useState<NominationRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const [backRes, optionRes, nomRes] = await Promise.all([
        supabase.rpc('get_public_back_rates', { p_store_id: storeId } as any),
        supabase.from('option_rates').select('*').eq('is_visible', true).eq('store_id', storeId).order('display_order', { ascending: true }),
        supabase.from('nomination_rates').select('*').eq('store_id', storeId).order('created_at', { ascending: true }),
      ]);
      if (backRes.error) throw backRes.error;
      if (optionRes.error) throw optionRes.error;
      if (nomRes.error) throw nomRes.error;
      setBackRates((backRes.data || []) as any);
      setOptionRates(optionRes.data || []);
      setNominationRates(nomRes.data || []);
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--pub-accent,#c6a15b)] mx-auto mb-4"></div>
          <p className="text-[var(--pub-text-muted,#a3987f)]">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
      <PublicNavigation />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-[var(--pub-card,#1a150f)] rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--pub-text,#f0e6d2)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.2em" }}>SYSTEM</h1>
            <p className="text-sm" style={{ color: "var(--pub-text-muted,#a3987f)", letterSpacing: "0.1em" }}>料金システム</p>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-2" style={{ color: "var(--pub-accent,#c6a15b)", fontFamily: "'Noto Serif JP', serif", letterSpacing: "0.1em" }}>{storeName}</h2>
          </div>

          {/* コース別料金（back_ratesマスター） */}
          {courseTypes.map((type) => {
            const rates = backRates.filter(r => r.course_type === type).sort((a, b) => a.duration - b.duration);
            return (
              <div key={type} className="mb-12">
                <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-3 mb-6">
                  <h3 className="font-bold text-lg" style={{ letterSpacing: "0.1em" }}>{type}コース</h3>
                </div>
                <div className="space-y-3">
                  {rates.map((rate) => (
                    <div key={rate.id} className="py-2 border-b border-[var(--pub-border,#3a2f1c)]">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--pub-text-mid,#d9cdb4)] font-medium">{rate.duration}min</span>
                        <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold">¥{rate.customer_price.toLocaleString()}</span>
                      </div>
                      {rate.description && (
                        <p className="text-xs text-[var(--pub-text-muted,#a3987f)] mt-0.5 leading-snug">{rate.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* DRコース */}
          {backRates.filter(r => r.course_type === 'DR').length > 0 && (
            <div className="mb-12">
              <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-3 mb-6">
                <h3 className="font-bold text-lg" style={{ letterSpacing: "0.1em" }}>DRコース</h3>
              </div>
              <div className="space-y-3">
                {backRates.filter(r => r.course_type === 'DR').sort((a, b) => a.duration - b.duration).map((rate) => (
                  <div key={rate.id} className="py-2 border-b border-[var(--pub-border,#3a2f1c)]">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--pub-text-mid,#d9cdb4)] font-medium">{rate.duration}min</span>
                      <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold">¥{rate.customer_price.toLocaleString()}</span>
                    </div>
                    {rate.description && (
                      <p className="text-xs text-[var(--pub-text-muted,#a3987f)] mt-0.5 leading-snug">{rate.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options（option_ratesマスター） */}
          <div className="mb-12">
            <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-3 mb-6">
              <h3 className="font-bold text-lg" style={{ letterSpacing: "0.1em" }}>オプションメニュー</h3>
            </div>
            <div className="space-y-3">
              {optionRates.map((opt) => (
                <div key={opt.id} className="flex justify-between items-center py-2 border-b border-[var(--pub-border,#3a2f1c)]">
                  <span className="text-[var(--pub-text-mid,#d9cdb4)] font-medium">{opt.option_name}</span>
                  <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold">¥{opt.customer_price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 指名料（nomination_ratesマスター） */}
          {nominationRates.length > 0 && (
            <div className="mb-12">
              <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-3 mb-6">
                <h3 className="font-bold text-lg" style={{ letterSpacing: "0.1em" }}>指名料</h3>
              </div>
              <div className="space-y-3">
                {nominationRates.map((nom) => (
                  <div key={nom.id} className="flex justify-between items-center py-2 border-b border-[var(--pub-border,#3a2f1c)]">
                    <span className="text-[var(--pub-text-mid,#d9cdb4)] font-medium">{nom.nomination_type}</span>
                    <span className="text-[var(--pub-text-mid,#d9cdb4)] font-bold">¥{nom.customer_price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Methods */}
          <div className="mb-12">
            <div className="bg-[var(--pub-accent,#c6a15b)] text-white text-center py-3 mb-6">
              <h3 className="font-bold text-lg" style={{ letterSpacing: "0.1em" }}>お支払い</h3>
            </div>
            <div className="space-y-3">
              {['現金', 'クレジット', '電子マネー'].map((m) => (
                <div key={m} className="flex justify-between items-center py-2 border-b border-[var(--pub-border,#3a2f1c)]">
                  <span className="text-[var(--pub-text-mid,#d9cdb4)]">{m}</span>
                  <span className="text-[var(--pub-text-mid,#d9cdb4)]">◯</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
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
        </div>
      </main>
      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
}
