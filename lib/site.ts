/**
 * Базовий URL сайту — для канонічних посилань, og:-метаданих і sitemap.
 *
 * Без нього Next підставляє localhost, і посилання на профіль репетитора,
 * переслане в месенджер, розгортається у нікуди. На Vercel робочий домен
 * приходить у змінних оточення; NEXT_PUBLIC_SITE_URL перекриває все —
 * знадобиться, коли зʼявиться власний домен.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
