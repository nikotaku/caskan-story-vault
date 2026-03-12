import { Link, useLocation } from "react-router-dom";
import caskanLogo from "@/assets/caskan-logo.png";

const navItems = [
  { to: "/", label: "SCHEDULE", sub: "出勤情報" },
  { to: "/casts", label: "THERAPIST", sub: "セラピスト" },
  { to: "/system", label: "SYSTEM", sub: "料金システム" },
  { to: "/access", label: "ACCESS", sub: "アクセス" },
  { to: "/news", label: "NEWS", sub: "お知らせ" },
  { to: "/recruit", label: "RECRUIT", sub: "求人情報" },
  { to: "/booking", label: "RESERVE", sub: "Web予約" },
];

export const PublicNavigation = () => {
  const location = useLocation();

  return (
    <>
      {/* Top Contact Bar */}
      <div className="bg-[#d4b5a8] text-white py-2 px-4 text-sm">
        <div className="container mx-auto flex justify-center items-center gap-4">
          <span>12:00〜26:00(24:40最終受付)</span>
          <a href="tel:07090941854" className="hover:opacity-80">
            07090941854
          </a>
        </div>
      </div>

      {/* Logo Header */}
      <div className="bg-white py-6 border-b border-[#e5d5cc]">
        <div className="container mx-auto text-center">
          <Link to="/">
            <img
              src={caskanLogo}
              alt="全力エステ"
              className="h-20 md:h-28 mx-auto object-contain"
              style={{ mixBlendMode: "multiply" }}
            />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          {/* PC */}
          <div className="hidden md:flex justify-center items-center">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-5 py-3 text-center transition-colors border-b-2 ${
                    isActive
                      ? "bg-[#f5e8e4] border-[#d4a574]"
                      : "border-transparent hover:bg-[#f5e8e4] hover:border-[#d4a574]"
                  }`}
                >
                  <div className="text-[#8b7355] font-semibold text-xs tracking-wider">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[#a89586]">{item.sub}</div>
                </Link>
              );
            })}
          </div>

          {/* SP - 2行 */}
          <div className="md:hidden">
            <div className="flex justify-center items-center flex-wrap">
              {navItems.slice(0, 4).map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex-1 py-2 text-center transition-colors border-b-2 ${
                      isActive
                        ? "bg-[#f5e8e4] border-[#d4a574]"
                        : "border-transparent hover:bg-[#f5e8e4]"
                    }`}
                  >
                    <div className="text-[#8b7355] font-semibold text-[10px] tracking-wider">
                      {item.label}
                    </div>
                    <div className="text-[8px] text-[#a89586]">{item.sub}</div>
                  </Link>
                );
              })}
            </div>
            <div className="flex justify-center items-center flex-wrap border-t border-[#f0e6df]">
              {navItems.slice(4).map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex-1 py-2 text-center transition-colors border-b-2 ${
                      isActive
                        ? "bg-[#f5e8e4] border-[#d4a574]"
                        : "border-transparent hover:bg-[#f5e8e4]"
                    }`}
                  >
                    <div className="text-[#8b7355] font-semibold text-[10px] tracking-wider">
                      {item.label}
                    </div>
                    <div className="text-[8px] text-[#a89586]">{item.sub}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};
