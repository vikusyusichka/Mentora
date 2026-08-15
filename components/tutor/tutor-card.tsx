import Image from "next/image";
import { MapPin, Monitor, Star, UserRound } from "lucide-react";
import {
  FORMAT_LABELS,
  formatPrice,
  levelsRange,
  type TutorProfile,
} from "@/lib/tutor-profile";

/**
 * Публічна картка репетитора — так профіль бачить гість.
 * Використовується для прев'ю в кабінеті (A.1) і в каталозі (A.2).
 */
export function TutorCard({ profile }: { profile: TutorProfile }) {
  const hasTrial = profile.trialPrice > 0;

  return (
    <article className="rounded-card border border-border bg-card p-6 shadow-level1">
      <div className="flex items-start gap-4">
        {profile.photoURL ? (
          <Image
            src={profile.photoURL}
            alt={profile.displayName}
            width={72}
            height={72}
            className="size-18 shrink-0 rounded-2xl object-cover"
            unoptimized /* Storage-URL із токеном; оптимізатор тут не потрібен */
          />
        ) : (
          <span className="flex size-18 shrink-0 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
            <UserRound className="size-8" strokeWidth={1.75} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-title-lg truncate">{profile.displayName}</h3>
            {hasTrial && (
              <span className="text-label-sm shrink-0 rounded-full bg-sage-green/10 px-3 py-1 text-sage-green">
                Пробний урок
              </span>
            )}
          </div>

          <div className="text-label-md mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            {profile.ratingCount > 0 ? (
              <span className="flex items-center gap-1">
                <Star
                  className="size-4 fill-gold text-gold"
                  strokeWidth={2}
                  aria-hidden
                />
                {profile.ratingAvg.toFixed(1)}
                <span className="text-outline">({profile.ratingCount})</span>
              </span>
            ) : (
              <span className="text-outline">Ще без відгуків</span>
            )}

            <span className="flex items-center gap-1">
              {profile.format === "offline" ? (
                <MapPin className="size-4" strokeWidth={2} aria-hidden />
              ) : (
                <Monitor className="size-4" strokeWidth={2} aria-hidden />
              )}
              {FORMAT_LABELS[profile.format]}
              {profile.city ? `, ${profile.city}` : ""}
            </span>
          </div>
        </div>
      </div>

      <p className="text-body-md mt-4 line-clamp-3 text-muted-foreground">
        {profile.bio}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {profile.languages.map((lang) => (
          <span
            key={lang}
            className="text-label-sm rounded-full bg-soft-gold px-3 py-1 text-secondary"
          >
            {lang}
          </span>
        ))}
        <span className="text-label-sm rounded-full bg-muted px-3 py-1 text-muted-foreground">
          {levelsRange(profile.levelsTaught)}
        </span>
      </div>

      <footer className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-headline-md text-secondary">
          {formatPrice(profile.pricePerLesson, profile.currency)}
        </span>
        <span className="text-label-md text-muted-foreground">за урок</span>
      </footer>
    </article>
  );
}
