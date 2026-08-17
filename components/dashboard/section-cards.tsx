import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export interface DashboardSection {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Тільки для готових розділів; решта показуються з підписом «Скоро». */
  href?: string;
}

/**
 * Плитки розділів кабінету. Нереалізовані розділи лишаються на екрані
 * приглушеними: так видно, куди рухається продукт, і не виникає відчуття,
 * що кабінет порожній через помилку.
 */
export function SectionCards({ sections }: { sections: DashboardSection[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map(({ title, description, icon: Icon, href }) => {
        const body = (
          <>
            {/* Іконка-плитка з еталона: maroon квадрат зі скругленням */}
            <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-gold">
              <Icon className="size-6" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-title-lg mb-2">{title}</h2>
            <p className="text-body-md grow text-muted-foreground">
              {description}
            </p>
          </>
        );

        return href ? (
          <Link
            key={title}
            href={href}
            className="flex flex-col rounded-card border border-border bg-card p-6 shadow-level1 transition-all hover:-translate-y-1 hover:shadow-level1-hover"
          >
            {body}
            <span className="text-label-md mt-4 flex items-center gap-2 text-secondary">
              Відкрити
              <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
            </span>
          </Link>
        ) : (
          <div
            key={title}
            className="flex flex-col rounded-card border border-border bg-card/60 p-6"
          >
            {body}
            <span className="text-label-sm mt-4 w-fit rounded-full bg-badge-neutral px-3 py-1 text-muted-foreground">
              Скоро
            </span>
          </div>
        );
      })}
    </div>
  );
}
