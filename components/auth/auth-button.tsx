"use client";

import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primary CTA за DESIGN.md: пігулка, золоте тло, текст Deep Maroon, bold.
 * Тактильний відгук — легкий scale на hover/active.
 */
export function AuthButton({
  children,
  loading = false,
  className,
  disabled,
  ...props
}: ComponentProps<"button"> & { loading?: boolean; children: ReactNode }) {
  return (
    <button
      className={cn(
        "text-title-lg flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4",
        "font-bold text-primary-foreground shadow-lg shadow-gold/20 transition-all duration-200",
        "hover:scale-[1.02] active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-5 animate-spin" />}
      {children}
    </button>
  );
}
