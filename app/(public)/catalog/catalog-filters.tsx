"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";

import { ChipToggleGroup } from "@/components/tutor/chip-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATALOG_FORMATS,
  CATALOG_FORMAT_LABELS,
  CATALOG_SORTS,
  CATALOG_SORT_LABELS,
  catalogSearchParams,
  effectiveSort,
  hasActiveFilters,
  ratingSortBlocked,
  type CatalogFilters,
  type CatalogSort,
} from "@/lib/catalog";
import {
  CEFR_LEVELS,
  CURRENCIES,
  LANGUAGES,
  type CefrLevel,
  type Currency,
  type Language,
} from "@/lib/tutor-profile";
import { cn } from "@/lib/utils";

/** Пауза перед переходом: щоб набір міста не давав запит на кожну літеру. */
const APPLY_DELAY_MS = 350;

const FORMAT_OPTIONS = CATALOG_FORMATS.map((f) => CATALOG_FORMAT_LABELS[f]);

/**
 * Панель фільтрів каталогу.
 *
 * Джерело істини — URL, а не стан компонента: так сторінка лишається SSR,
 * посилання з фільтрами можна переслати, а кнопка «назад» працює сама собою.
 * Локальний `draft` існує лише щоб інпути не смикались до застосування.
 */
export function CatalogFilters({ filters }: { filters: CatalogFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<CatalogFilters>(filters);
  const [open, setOpen] = useState(false);

  const applied = catalogSearchParams(filters).toString();
  const draftQuery = catalogSearchParams(draft).toString();

  // Останнє, що ми самі поклали в URL. Потрібне, щоб відрізнити «URL змінили
  // ми» від «URL змінив користувач кнопкою назад» — у другому випадку форму
  // треба підтягнути під адресу, у першому чіпати її не можна.
  const ownPush = useRef(applied);

  useEffect(() => {
    if (applied !== ownPush.current) {
      ownPush.current = applied;
      setDraft(filters);
    }
  }, [applied, filters]);

  useEffect(() => {
    if (draftQuery === ownPush.current) return;
    const timer = setTimeout(() => {
      ownPush.current = draftQuery;
      startTransition(() => {
        router.replace(draftQuery ? `/catalog?${draftQuery}` : "/catalog", {
          scroll: false,
        });
      });
    }, APPLY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draftQuery, router]);

  /** Повторний клік по вибраному чипу знімає фільтр. */
  function toggled<T>(current: T | undefined, value: T): T | undefined {
    return current === value ? undefined : value;
  }

  function priceField(key: "minPrice" | "maxPrice") {
    return {
      value: draft[key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.trim();
        const parsed = Number(raw);
        setDraft((prev) => ({
          ...prev,
          [key]: raw === "" || !Number.isFinite(parsed) ? undefined : parsed,
        }));
      },
    };
  }

  const active = hasActiveFilters(draft);
  const activeCount = catalogSearchParams(draft).size;

  return (
    <aside className="rounded-card border border-border bg-card p-6 shadow-level1 lg:sticky lg:top-24">
      {/* На телефоні панель згорнута: розгорнутою вона займає півтора
          екрана, і перший репетитор опиняється за межами видимого. */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 lg:cursor-default"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-title-lg flex items-center gap-2">
          <SlidersHorizontal
            className="size-5 text-secondary lg:hidden"
            strokeWidth={2}
            aria-hidden
          />
          Фільтри
          {activeCount > 0 && (
            <span className="text-label-sm rounded-full bg-soft-gold px-2.5 py-0.5 text-secondary">
              {activeCount}
            </span>
          )}
        </span>

        <span className="flex items-center gap-2">
          {pending && (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-label="Оновлюємо"
            />
          )}
          <ChevronDown
            className={cn(
              "size-5 text-muted-foreground transition-transform lg:hidden",
              open && "rotate-180"
            )}
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </button>

      <div className={cn("mt-5 space-y-6", !open && "hidden lg:block")}>
        <div className="space-y-2">
          <Label htmlFor="sort" className="text-label-md text-muted-foreground">
            Порядок
          </Label>
          <select
            id="sort"
            className="text-body-md h-10 w-full rounded-input border border-input bg-card px-3 disabled:opacity-60"
            value={effectiveSort(draft)}
            disabled={ratingSortBlocked(draft)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                sort: e.target.value as CatalogSort,
              }))
            }
          >
            {CATALOG_SORTS.map((value) => (
              <option key={value} value={value}>
                {CATALOG_SORT_LABELS[value]}
              </option>
            ))}
          </select>
          {ratingSortBlocked(draft) && (
            <p className="text-label-sm text-outline">
              Із заданою ціною Firestore сортує лише за нею. Приберіть межі
              ціни, щоб сортувати за рейтингом.
            </p>
          )}
        </div>

        <ChipToggleGroup
          label="Мова"
          options={LANGUAGES}
          selected={draft.language ? [draft.language] : []}
          onToggle={(value: Language) =>
            setDraft((prev) => ({
              ...prev,
              language: toggled(prev.language, value),
            }))
          }
        />

        <ChipToggleGroup
          label="Рівень (CEFR)"
          options={CEFR_LEVELS}
          selected={draft.level ? [draft.level] : []}
          onToggle={(value: CefrLevel) =>
            setDraft((prev) => ({ ...prev, level: toggled(prev.level, value) }))
          }
        />

        <ChipToggleGroup
          label="Формат"
          options={FORMAT_OPTIONS}
          selected={draft.format ? [CATALOG_FORMAT_LABELS[draft.format]] : []}
          onToggle={(label) => {
            const value = CATALOG_FORMATS.find(
              (f) => CATALOG_FORMAT_LABELS[f] === label
            );
            if (!value) return;
            setDraft((prev) => ({
              ...prev,
              format: toggled(prev.format, value),
            }));
          }}
        />

        <div className="space-y-2">
          <Label htmlFor="city" className="text-label-md text-muted-foreground">
            Місто
          </Label>
          <Input
            id="city"
            className="h-10 rounded-input bg-card"
            placeholder="Наприклад, Львів"
            value={draft.city ?? ""}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                city: e.target.value || undefined,
              }))
            }
          />
          <p className="text-label-sm text-outline">
            Має сенс для офлайн-занять.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-label-md block text-muted-foreground">
            Ціна за урок
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-10 rounded-input bg-card"
              placeholder="від"
              aria-label="Ціна від"
              {...priceField("minPrice")}
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-10 rounded-input bg-card"
              placeholder="до"
              aria-label="Ціна до"
              {...priceField("maxPrice")}
            />
          </div>

          {/* Валюта — частина блоку ціни, бо порівнювати 500 ₴ і 500 $
              безглуздо. Поки межі не задані, фільтр валюти не діє взагалі. */}
          <div className="flex items-center gap-2 pt-1">
            <Label
              htmlFor="currency"
              className="text-label-sm text-muted-foreground"
            >
              Валюта
            </Label>
            <select
              id="currency"
              className="text-label-md h-9 rounded-input border border-input bg-card px-2"
              value={draft.currency ?? "UAH"}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  currency: e.target.value as Currency,
                }))
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {active && (
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => setDraft({})}
          >
            <RotateCcw className="size-4" aria-hidden />
            Скинути фільтри
          </Button>
        )}
      </div>
    </aside>
  );
}
