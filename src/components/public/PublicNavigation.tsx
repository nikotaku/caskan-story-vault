import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Clock, Phone, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useStoreContact } from "@/hooks/useStoreContact";
import { useStore } from "@/hooks/useStore";

const SHOP_LOGO = "https://cdn2-caskan.com/caskan/img/shop_logo/1401_logo_1750237137.png";

const navItems = [
  { to: "/", label: "TOP", sub: "トップ", external: false },
  { to: "/schedule", label: "SCHEDULE", sub: "出勤情報", external: false },
  { to: "/casts", label: "THERAPIST", sub: "セラピスト", external: false },
  { to: "/campaigns", label: "CAMPAIGN", sub: "キャンペーン", external: false },
  { to: "/voice", label: "VOICE", sub: "口コミ", external: false },
  { to: "/system", label: "SYSTEM", sub: "料金システム", external: false },
  { to: "/access", label: "ACCESS", sub: "アクセス", external: false },
  { to: "/recruit-talk", label: "RECRUIT", sub: "求人情報", external: false },
  { to: "/booking", label: "RESERVE", sub: "Web予約", external: false },
];

export const PublicNavigation = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { telHref, phoneDisplay, hours } = useStoreContact();
  const { store } = useStore();
  const storeName = store?.name ?? "艶華";
  // デフォルト店舗は既存ロゴ画像、その他店舗は logo_url かテキストロゴ
  const logoUrl = store?.logo_url || ((store?.is_default ?? true) ? SHOP_LOGO : null);
  usePageTracking();

  return (
    <>
      {/* Logo Header — ロゴは左上に控えめに配置、店舗情報は右 */}
      <div
        className="border-b border-[var(--pub-border,#3a2f1c)] py-2.5 md:py-4"
        style={{
          background:
            "linear-gradient(135deg, var(--pub-bg,#1a150e) 0%, var(--pub-bg,#12100d) 50%, var(--pub-bg,#1a150e) 100%)",
        }}
      >
        <div className="container mx-auto px-4 flex items-center justify-between gap-3">
          {/* Logo - top left, modest（ロゴ画像が無い店舗はロゴ非表示） */}
          <Link to="/" className="shrink-0" aria-label={storeName}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt={storeName}
                className="h-8 md:h-11 object-contain"
                loading="eager"
              />
            )}
          </Link>

          {/* PC: business info right */}
          <div className="hidden md:flex items-center gap-5 text-sm" style={{ color: "var(--pub-accent,#c6a15b)" }}>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              {hours}
            </span>
            <a
              href={telHref}
              className="inline-flex items-center gap-1.5 font-semibold hover:text-[var(--pub-accent-light,#e9d189)]"
              style={{ color: "var(--pub-accent,#c6a15b)" }}
            >
              <Phone size={14} />
              {phoneDisplay}
            </a>
          </div>

          {/* SP: phone + hamburger */}
          <div className="md:hidden flex items-center gap-3" style={{ color: "var(--pub-accent,#c6a15b)" }}>
            <a
              href={telHref}
              className="inline-flex items-center gap-1 font-semibold text-[10px]"
              style={{ color: "var(--pub-accent,#c6a15b)" }}
            >
              <Phone size={11} /> {phoneDisplay}
            </a>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button aria-label="メニュー" className="p-1 text-[#e8dcc6] hover:text-white">
                  <Menu size={24} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-r border-[var(--pub-border,#3a2f1c)] text-white" style={{ backgroundColor: "var(--pub-bg,#12100d)" }}>
                <div className="px-5 py-4 border-b border-[var(--pub-border,#3a2f1c)]">
                  {logoUrl ? (
                    <img src={logoUrl} alt={storeName} className="h-9 object-contain" />
                  ) : (
                    <span className="text-lg font-bold tracking-[0.3em]" style={{ color: "var(--pub-accent,#c6a15b)", fontFamily: "'Noto Serif JP', serif" }}>{storeName}</span>
                  )}
                </div>
                <nav className="py-2">
                  {navItems.map((item) => {
                    const isActive = !item.external && location.pathname === item.to;
                    const cls = `flex items-baseline gap-2 px-5 py-3.5 border-b border-[var(--pub-border-a60,#3a2f1c99)] transition-colors ${
                      isActive ? "bg-[var(--pub-border,#3a2f1c)]" : "hover:bg-[var(--pub-border-a60,#3a2f1c99)]"
                    }`;
                    const inner = (
                      <>
                        <span className="text-[#e8dcc6] font-semibold text-sm tracking-wider">{item.label}</span>
                        <span className="text-[11px] text-[var(--pub-text-muted,#a3987f)]">{item.sub}</span>
                      </>
                    );
                    return item.external ? (
                      <a key={item.to} href={item.to} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setMenuOpen(false)}>{inner}</a>
                    ) : (
                      <Link key={item.to} to={item.to} className={cls} onClick={() => setMenuOpen(false)}>{inner}</Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Navigation (PC only) */}
      <nav className="hidden md:block bg-[var(--pub-bg,#12100d)] border-b border-[var(--pub-border,#3a2f1c)] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center">
            {navItems.map((item) => {
              const isActive = !item.external && location.pathname === item.to;
              const cls = `px-5 py-3 text-center transition-colors border-b-2 ${
                isActive ? "bg-[var(--pub-border,#3a2f1c)] border-[var(--pub-accent,#c6a15b)]" : "border-transparent hover:bg-[var(--pub-border,#3a2f1c)] hover:border-[var(--pub-accent,#c6a15b)]"
              }`;
              const inner = (
                <>
                  <div className="text-[#e8dcc6] font-semibold text-xs tracking-wider">{item.label}</div>
                  <div className="text-[10px] text-[var(--pub-text-muted,#a3987f)]">{item.sub}</div>
                </>
              );
              return item.external
                ? <a key={item.to} href={item.to} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                : <Link key={item.to} to={item.to} className={cls}>{inner}</Link>;
            })}
          </div>
        </div>
      </nav>
    </>
  );
};
