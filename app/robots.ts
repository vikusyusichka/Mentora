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
      // Кабінети за авторизацією й так недоступні, але витрачати на них
      // краулінговий бюджет немає сенсу.
      disallow: [
        "/api/",
        "/student",
        "/parent",
        "/onboarding",
        "/tutor/profile",
        "/tutor/schedule",
        "/tutor/students",
        "/tutor/lessons",
        "/tutor/payouts",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
