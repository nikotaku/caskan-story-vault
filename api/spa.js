/**
 * 艶華（enka-salon.jp）向けに index.html の OGP・タイトルを差し替えて返す。
 * SPA の index.html は全店舗共通のため、そのままだとリンクプレビューが
 * デフォルト店舗の内容になってしまう。vercel.json のホスト条件付きリライトで
 * enka-salon.jp の HTML リクエストだけがこの関数を通る。
 */

const ENKA = {
  title: "艶華 -えんか-｜仙台・宮城のメンズエステ",
  description:
    "仙台・宮城のメンズエステ、完全個室プライベートサロン【艶華 -えんか-】公式サイト。出勤情報、料金、キャンペーン、Web予約をご案内します。",
  author: "艶華",
  image:
    "https://imrxzkivwrkqbhqfbbes.supabase.co/storage/v1/object/public/cast-photos/image-stock/1784811500002_enka-hero-open.jpg",
};

const esc = (s) => s.replace(/"/g, "&quot;");

export default async function handler(req, res) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  try {
    // /index.html は実ファイルなのでリライトを通らず静的配信される（ループしない）
    const origin = `https://${host}`;
    const resp = await fetch(`${origin}/index.html`);
    let html = await resp.text();

    const canonical = `https://enka-salon.jp/`;
    html = html
      .replace(/<html lang="[^"]*"/, '<html lang="ja"')
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${ENKA.title}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(ENKA.description)}$2`)
      .replace(/(<meta name="author" content=")[^"]*(")/, `$1${esc(ENKA.author)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(ENKA.title)}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(ENKA.title)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(ENKA.description)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(ENKA.description)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
      .replace(/(<meta property="og:site_name" content=")[^"]*(")/, `$1${esc(ENKA.author)}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`)
      .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${ENKA.image}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${ENKA.image}$2`)
      .replace(/<meta name="twitter:site" content="[^"]*"\s*\/?>/, "")
      .replace(/(<link rel="icon"[^>]*href=")[^"]*(")/, `$1/favicon-tsuyaka.png$2`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.status(200).send(html);
  } catch (e) {
    // 取得に失敗しても白画面にはせずリダイレクトで素の SPA を返す
    res.setHeader("Cache-Control", "no-store");
    res.redirect(307, "/index.html");
  }
}
