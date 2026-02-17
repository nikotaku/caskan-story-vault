import { Link } from "react-router-dom";

const footerNavItems = [
  { to: "/", label: "トップ" },
  { to: "/schedule", label: "出勤情報" },
  { to: "/casts", label: "セラピスト" },
  { to: "/system", label: "料金システム" },
  { to: "/access", label: "アクセス" },
  { to: "/news", label: "お知らせ" },
  { to: "/recruit", label: "求人情報" },
  { to: "/booking", label: "Web予約" },
];

export const PublicFooter = () => {
  return (
    <footer className="text-white" style={{ backgroundColor: "#3a3a3a" }}>
      {/* Shop Info */}
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="text-center mb-8">
          <h3
            className="text-2xl font-bold mb-1"
            style={{ letterSpacing: "0.1em" }}
          >
            全力エステ 仙台
          </h3>
          <p className="text-sm text-white/80">
            12:00〜26:00(24:40最終受付)
          </p>
          <a
            href="tel:07090941854"
            className="text-lg font-bold text-white/90 hover:text-white mt-2 inline-block"
          >
            07090941854
          </a>
        </div>

        {/* SNS Icons */}
        <div className="flex justify-center gap-4 mb-8">
          <a
            href="https://lin.ee/RdRhmXw"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80"
          >
            <img
              src="https://storage.googleapis.com/caskan/asset/line_icon.png"
              alt="LINE"
              className="w-10 h-10"
            />
          </a>
          <a
            href="https://twitter.com/zr_sendai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80"
          >
            <img
              src="https://cdn2-caskan.com/caskan/asset/sns/x.png"
              alt="X"
              className="w-10 h-10"
            />
          </a>
        </div>

        {/* Navigation */}
        <div className="mb-8">
          <h4 className="text-sm font-bold mb-4 text-center text-white/60 tracking-wider">
            MENU
          </h4>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-sm text-center">
            {footerNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-white/70 hover:text-white transition-colors py-1"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © 2025 全力エステ 仙台. All rights reserved.
      </div>
    </footer>
  );
};
