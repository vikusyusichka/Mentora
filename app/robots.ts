import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Публічна частина (головна, каталог, профілі) відкрита для індексації —
 * у цьому й сенс маркетплейсу. Кабінети й API закриті: за ними все одно
 * стоїть авторизація, але немає причини витрачати на них краулінг.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/student", "/parent", "/tutor/profile", "/onboarding"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
