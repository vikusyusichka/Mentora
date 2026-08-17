import type { MetadataRoute } from "next";
import { fetchPublishedTutorIds } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

/**
 * Карта сайту: статичні публічні сторінки + кожен опублікований профіль.
 *
 * Профілі — головна причина існування цього файлу: сторінки динамічні,
 * посилань на них зсередини мало (лише поточна сторінка каталогу), тож без
 * sitemap краулер знайшов би далеко не всіх репетиторів.
 */
/**
 * Без цього Next згенерував би карту сайту один раз під час збірки — і нові
 * репетитори зʼявлялися б у ній лише після наступного деплою.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/catalog`, changeFrequency: "daily", priority: 0.9 },
  ];

  // Збій читання не має валити sitemap цілком — краще віддати статичну
  // частину, ніж 500 у відповідь пошуковику.
  let tutorIds: string[] = [];
  try {
    tutorIds = await fetchPublishedTutorIds();
  } catch (err) {
    console.error("[sitemap]", err);
  }

  return [
    ...staticPages,
    ...tutorIds.map((id) => ({
      url: `${base}/tutor/${id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
