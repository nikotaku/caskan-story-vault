const ROUTES = [
  ["/", "daily", "1.0"],
  ["/schedule", "daily", "0.9"],
  ["/casts", "daily", "0.9"],
  ["/campaigns", "daily", "0.9"],
  ["/system", "monthly", "0.8"],
  ["/pricing", "monthly", "0.7"],
  ["/access", "monthly", "0.7"],
  ["/voice", "weekly", "0.7"],
  ["/recruit-talk", "monthly", "0.6"],
];

const escapeXml = (value) => value.replace(/[<>&'\"]/g, (character) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
}[character]));

export default function handler(req, res) {
  const site = String(req.query?.site || "").toLowerCase();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  const isEnka = site === "enka" || host.includes("enka-salon.jp");
  const baseUrl = isEnka ? "https://enka-salon.jp" : "https://zenryokuesthe.com";
  const lastModified = new Date().toISOString().slice(0, 10);
  const urls = ROUTES.map(([path, changefreq, priority]) => `  <url>
    <loc>${escapeXml(`${baseUrl}${path}`)}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
}
