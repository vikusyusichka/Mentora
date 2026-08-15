"use client";

import { cn } from "@/lib/utils";

/**
 * Мультивибір чипами (мови, рівні CEFR).
 * Вибране — soft-gold із золотим бордером, за духом дизайн-системи.
 */
export function ChipToggleGroup<T extends string>({
  options,
  selected,
  onToggle,
  label,
  error,
}: {
  options: readonly T[];
  selected: readonly T[];
  /**
   * Викликається з натиснутим значенням — батько сам обчислює новий масив
   * від АКТУАЛЬНОГО стану. Свідомо не передаємо готовий масив: кілька
   * швидких кліків в одному React-тіку читали б застарілий `selected`
   * і губили вибір (останній клік перезаписував попередні).
   */
  onToggle: (value: T) => void;
  label: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <span className="text-label-md block px-1 text-muted-foreground">
        {label}
      </span>

      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={active}
              className={cn(
                "text-label-md rounded-full border-2 px-4 py-2 transition-all",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/30",
                active
                  ? "border-gold bg-soft-gold text-secondary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {error && <p className="text-label-sm px-1 text-terracotta">{error}</p>}
    </div>
  );
}
