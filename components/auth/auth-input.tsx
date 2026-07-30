"use client";

import { useState, type ComponentProps, type Ref } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthInputProps extends Omit<ComponentProps<"input">, "className"> {
  label: string;
  icon: LucideIcon;
  error?: string;
  /** Дія праворуч від лейбла (напр. «Забули пароль?»). */
  labelAction?: React.ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Поле форми за DESIGN.md:
 *  - default: біле тло, 1px soft-gold бордер, радіус 12px
 *  - focus:   2px gold бордер + 4px золотий glow (20%)
 *  - іконка зліва (thick-stroke, rounded-end — lucide)
 *  - для type="password" — вбудований toggle видимості
 */
export function AuthInput({
  label,
  icon: Icon,
  error,
  labelAction,
  type = "text",
  id,
  ref,
  ...props
}: AuthInputProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && revealed ? "text" : type;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <label htmlFor={id} className="text-label-md text-muted-foreground">
          {label}
        </label>
        {labelAction}
      </div>

      <div className="group relative">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-outline transition-colors group-focus-within:text-gold-dim"
          strokeWidth={2.25}
          aria-hidden
        />
        <input
          id={id}
          ref={ref}
          type={effectiveType}
          aria-invalid={!!error}
          className={cn(
            "text-body-md w-full rounded-input border bg-card py-3 pl-12 text-foreground transition-all",
            "placeholder:text-outline-variant",
            "focus:border-gold focus:shadow-[0_0_0_4px_rgba(255,192,0,0.2)] focus:outline-none",
            isPassword ? "pr-12" : "pr-4",
            error
              ? "border-terracotta focus:border-terracotta focus:shadow-[0_0_0_4px_rgba(217,108,63,0.2)]"
              : "border-soft-gold"
          )}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Сховати пароль" : "Показати пароль"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-secondary focus:outline-none focus-visible:text-gold-dim"
          >
            {revealed ? (
              <EyeOff className="size-5" strokeWidth={2.25} />
            ) : (
              <Eye className="size-5" strokeWidth={2.25} />
            )}
          </button>
        )}
      </div>

      {error && <p className="text-label-sm px-1 text-terracotta">{error}</p>}
    </div>
  );
}
