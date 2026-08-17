import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";

import {
  catalogSearchParams,
  fetchCatalogPage,
  hasActiveFilters,
  parseCatalogFilters,
  type CatalogPage,
} from "@/lib/catalog";
import { CatalogFilters } from "./catalog-filters";
import { CatalogResults } from "./catalog-results";

export const metadata: Metadata = {
  title: "Каталог репетиторів — Mentora",
  description:
    "Знайдіть репетитора: мова, рівень CEFR, ціна, онлайн або офлайн у вашому місті. Без реєстрації.",
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Каталог репетиторів — Mentora",
    description:
      "Знайдіть репетитора: мова, рівень CEFR, ціна, онлайн або офлайн у вашому місті.",
    type: "website",
  },
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCatalogFilters(await searchParams);

  // Запит може впасти не лише через мережу, а й через відсутній composite-
  // індекс (див. firestore.indexes.json). Валити всю сторінку через це не
  // варто — фільтри мають лишитись на екрані, щоб було чим виправити пошук.
  let page: CatalogPage | null = null;
  try {
    page = await fetchCatalogPage(filters);
  } catch (err) {
    console.error("[catalog]", err);
  }

  const filtersKey = catalogSearchParams(filters).toString();

  return (
    <div className="mx-auto w-full max-w-content-max px-6 py-10 lg:py-14">
      <header className="mb-8 lg:mb-10">
        <h1 className="text-display-lg text-secondary">Репетитори</h1>
        <p className="text-body-lg mt-3 max-w-2xl text-muted-foreground">
          Оберіть мову, рівень і формат — і подивіться, хто вам підходить.
          Реєстрація потрібна лише щоб забронювати урок.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <CatalogFilters filters={filters} />

        {page ? (
          <CatalogResults
            key={filtersKey}
            filters={filters}
            initialItems={page.items}
            initialCursor={page.cursor}
            filtersActive={hasActiveFilters(filters)}
          />
        ) : (
          <div className="rounded-card border border-border bg-card p-10 text-center shadow-level1">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
              <TriangleAlert className="size-7" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-title-lg mb-2">Каталог тимчасово недоступний</h2>
            <p className="text-body-md mx-auto max-w-md text-muted-foreground">
              Не вдалося завантажити список репетиторів. Спробуйте оновити
              сторінку або змінити фільтри.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
