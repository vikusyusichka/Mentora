"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, SearchX } from "lucide-react";

import { TutorCard } from "@/components/tutor/tutor-card";
import { Button } from "@/components/ui/button";
import {
  fetchCatalogPage,
  type CatalogCursor,
  type CatalogFilters,
  type CatalogItem,
} from "@/lib/catalog";

/**
 * Видача каталогу.
 *
 * Перша сторінка приходить готовою з сервера (SSR — щоб її бачив пошуковик
 * і щоб не було порожнього кадру), наступні догортаються з браузера тим
 * самим `fetchCatalogPage`. Батьківська сторінка монтує компонент із
 * `key` за фільтрами, тож зміна фільтрів завжди починає список з нуля.
 */
export function CatalogResults({
  filters,
  initialItems,
  initialCursor,
  filtersActive,
}: {
  filters: CatalogFilters;
  initialItems: CatalogItem[];
  initialCursor: CatalogCursor | null;
  filtersActive: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchCatalogPage(filters, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.cursor);
    } catch (err) {
      console.error("[catalog] load more", err);
      setError("Не вдалося завантажити ще. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-card p-10 text-center shadow-level1">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
          <SearchX className="size-7" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="text-title-lg mb-2">Нікого не знайдено</h2>
        <p className="text-body-md mx-auto max-w-md text-muted-foreground">
          {filtersActive
            ? "За такими умовами репетиторів немає. Спробуйте прибрати частину фільтрів."
            : "Каталог поки порожній — репетитори ще не опублікували профілі."}
        </p>
        {filtersActive && (
          <Button
            className="mt-6 rounded-full"
            size="lg"
            render={<Link href="/catalog" />}
          >
            Скинути фільтри
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <TutorCard
            key={item.id}
            profile={item}
            href={`/tutor/${item.id}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-label-md text-center text-terracotta">{error}</p>
      )}

      {cursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full px-8"
            onClick={loadMore}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Показати ще
          </Button>
        </div>
      )}
    </div>
  );
}
