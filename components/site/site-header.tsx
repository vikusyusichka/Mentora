import Link from "next/link";
import { SiteHeaderActions } from "@/components/site/site-header-actions";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Шапка публічної частини (каталог, профіль репетитора).
 *
 * Це не кабінет, тож maroon-сайдбару з еталона тут немає — від нього
 * лишаються wordmark, кремове тло й золота кнопка-пігулка як головна дія.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-warm-cream/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-content-max items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="text-headline-md text-secondary transition-opacity hover:opacity-80"
        >
          Mentora
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <ButtonLink
            href="/catalog"
            variant="ghost"
            className="text-label-md rounded-full text-secondary"
          >
            Каталог
          </ButtonLink>
          <SiteHeaderActions />
        </nav>
      </div>
    </header>
  );
}
