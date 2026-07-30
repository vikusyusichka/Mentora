import Link from "next/link";
import { GraduationCap } from "lucide-react";

/**
 * Логотип-анкор auth-екранів.
 *  variant="wordmark" — лише назва + tagline капсом (макет login)
 *  variant="badge"    — maroon значок + назва + tagline (макет signup)
 */
export function AuthLogo({
  tagline,
  variant = "badge",
}: {
  tagline: string;
  variant?: "wordmark" | "badge";
}) {
  return (
    <div className="mb-10 flex flex-col items-center text-center">
      <Link
        href="/"
        className="mb-2 flex items-center gap-3"
        aria-label="Mentora — на головну"
      >
        {variant === "badge" && (
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-soft-gold shadow-md">
            <GraduationCap className="size-7" strokeWidth={2.25} />
          </span>
        )}
        <span className="text-display-lg tracking-tight text-secondary">
          Mentora
        </span>
      </Link>

      {variant === "wordmark" ? (
        <p className="text-label-md uppercase tracking-widest text-muted-foreground">
          {tagline}
        </p>
      ) : (
        <p className="text-body-md text-muted-foreground">{tagline}</p>
      )}
    </div>
  );
}
