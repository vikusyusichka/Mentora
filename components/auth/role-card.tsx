"use client";

import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Картка вибору ролі за макетом role-selection:
 *  - радіус 24px, біле тло, прозорий бордер
 *  - hover: підйом на 2px + інтенсивніша тінь
 *  - вибрано: 2px золотий бордер, тло soft-gold, підйом, тінь Level 2
 */
export function RoleCard({
  icon: Icon,
  title,
  description,
  cta,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={title}
      className={cn(
        "group flex h-full flex-col rounded-role-card border-2 p-8 text-left transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40",
        selected
          ? "-translate-y-1 border-gold bg-soft-gold shadow-level2"
          : "border-transparent bg-card shadow-level1 hover:-translate-y-2 hover:shadow-level1-hover"
      )}
    >
      <span
        className={cn(
          "mb-6 flex size-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-110",
          selected ? "bg-gold/40 text-secondary" : "bg-secondary/10 text-secondary"
        )}
      >
        <Icon className="size-9" strokeWidth={1.75} aria-hidden />
      </span>

      <h3 className="text-headline-md mb-3">{title}</h3>

      <p className="text-body-md mb-8 grow text-muted-foreground">
        {description}
      </p>

      <span className="text-label-md mt-auto flex items-center gap-2 text-secondary">
        {cta}
        <ArrowRight className="size-5" strokeWidth={2.5} aria-hidden />
      </span>
    </button>
  );
}
