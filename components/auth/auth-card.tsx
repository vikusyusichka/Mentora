import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Level 1 поверхня за DESIGN.md: біла картка на теплому кремі,
 * радіус 20px, дифузна тінь з відтінком maroon.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "w-full rounded-card border border-border bg-card p-8 shadow-level1",
        className
      )}
    >
      <header className="mb-8">
        <h2 className="text-headline-md mb-2">{title}</h2>
        {description && (
          <p className="text-body-md text-muted-foreground">{description}</p>
        )}
      </header>

      {children}

      {footer && <div className="mt-8">{footer}</div>}
    </section>
  );
}
