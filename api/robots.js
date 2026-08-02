export default function handler(req, res) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  const baseUrl = host.includes("enka-salon.jp") ? "https://enka-salon.jp" : "https://zenryokuesthe.com";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(`User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`);
}
