import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";

/**
 * Оболонка публічної частини. Свідомо без AuthGate: каталог і профілі
 * репетиторів мають відкриватися гостю й індексуватися пошуковиками.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-warm-cream">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/70">
        <div className="text-label-md mx-auto flex w-full max-w-content-max flex-wrap items-center justify-between gap-3 px-6 py-6 text-muted-foreground">
          <span>Mentora — маркетплейс репетиторства</span>
          <Link href="/catalog" className="hover:text-secondary">
            Усі репетитори
          </Link>
        </div>
      </footer>
    </div>
  );
}
