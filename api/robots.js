export default function handler(req, res) {
  const baseUrl = "https://enka-salon.jp";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).send(`User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`);
}
