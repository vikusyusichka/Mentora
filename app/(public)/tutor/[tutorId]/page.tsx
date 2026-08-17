import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Monitor,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";

import { SlotList } from "@/components/tutor/slot-list";
import { ButtonLink } from "@/components/ui/button-link";
import { materializeSlots, type MaterializedSlot } from "@/lib/availability";
import {
  getAvailability,
  getSlotExceptions,
} from "@/lib/firebase/availability-repo";
import { getPublicTutorProfile } from "@/lib/firebase/tutor-profile-repo";
import { dateKeyInZone } from "@/lib/timezone";
import {
  CEFR_LEVELS,
  FORMAT_LABELS,
  formatPrice,
  type TutorProfile,
} from "@/lib/tutor-profile";

/**
 * `cache` дедуплікує читання між generateMetadata і самим рендером:
 * Next викликає їх окремо, а Firestore SDK (на відміну від fetch) сам
 * нічого не кешує — без цього кожна сторінка коштувала б два читання.
 */
const loadProfile = cache(
  (tutorId: string): Promise<TutorProfile | null> =>
    getPublicTutorProfile(tutorId)
);

type PageProps = { params: Promise<{ tutorId: string }> };

/** Горизонт публічного календаря. */
const SLOTS_DAYS = 14;

/**
 * Вільні слоти на найближчі два тижні.
 *
 * Розгортання шаблону відбувається на сервері й дає UTC-моменти — вони
 * однакові для всіх. Перевести їх у час глядача може лише браузер, тому
 * далі це робить клієнтський `SlotList`.
 */
async function loadUpcomingSlots(
  tutorId: string,
  timezone: string
): Promise<MaterializedSlot[]> {
  const availability = await getAvailability(tutorId);
  if (!availability || availability.weeklySlots.length === 0) return [];

  const now = new Date();
  const until = new Date(now.getTime() + SLOTS_DAYS * 86_400_000);
  const exceptions = await getSlotExceptions(
    tutorId,
    dateKeyInZone(now, timezone),
    dateKeyInZone(until, timezone)
  );

  return materializeSlots({
    availability,
    exceptions,
    timezone,
    from: now,
    days: SLOTS_DAYS,
  });
}

/** Опис для пошуку й для картки при розшарюванні — перше речення біо. */
function shareDescription(profile: TutorProfile): string {
  const bio = profile.bio.replace(/\s+/g, " ").trim();
  const languages = profile.languages.join(", ");
  const head = `${languages}, ${formatPrice(profile.pricePerLesson, profile.currency)} за урок.`;
  const tail = bio.length > 150 ? `${bio.slice(0, 147).trimEnd()}…` : bio;
  return `${head} ${tail}`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { tutorId } = await params;
  const profile = await loadProfile(tutorId);

  if (!profile) {
    return { title: "Репетитора не знайдено — Mentora", robots: { index: false } };
  }

  const title = `${profile.displayName} — репетитор (${profile.languages.join(", ")}) | Mentora`;
  const description = shareDescription(profile);
  const url = `/tutor/${tutorId}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      images: profile.photoURL ? [{ url: profile.photoURL }] : undefined,
    },
    twitter: {
      card: profile.photoURL ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function TutorPublicProfilePage({ params }: PageProps) {
  const { tutorId } = await params;
  const profile = await loadProfile(tutorId);

  // Неопублікований профіль і неіснуючий — однакова 404 за задумом:
  // чернетка не має видавати себе навіть фактом існування.
  if (!profile) notFound();

  const levels = CEFR_LEVELS.filter((l) => profile.levelsTaught.includes(l));
  const hasTrial = profile.trialPrice > 0;
  const slots = await loadUpcomingSlots(tutorId, profile.timezone);

  return (
    <div className="mx-auto w-full max-w-content-max px-6 py-10 lg:py-14">
      <Link
        href="/catalog"
        className="text-label-md mb-6 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-secondary"
      >
        <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
        До каталогу
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <article className="space-y-6">
          <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
            <div className="flex flex-wrap items-start gap-5">
              {profile.photoURL ? (
                <Image
                  src={profile.photoURL}
                  alt={profile.displayName}
                  width={112}
                  height={112}
                  className="size-28 shrink-0 rounded-3xl object-cover"
                  unoptimized /* довільний зовнішній URL — оптимізатор тут зайвий */
                  priority
                />
              ) : (
                <span className="flex size-28 shrink-0 items-center justify-center rounded-3xl bg-secondary/10 text-secondary">
                  <UserRound className="size-12" strokeWidth={1.5} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <h1 className="text-headline-lg text-secondary">
                  {profile.displayName}
                </h1>

                <div className="text-label-md mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
                  {profile.ratingCount > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Star
                        className="size-4 fill-gold text-gold"
                        strokeWidth={2}
                        aria-hidden
                      />
                      {profile.ratingAvg.toFixed(1)}
                      <span className="text-outline">
                        ({profile.ratingCount})
                      </span>
                    </span>
                  ) : (
                    <span className="text-outline">Ще без відгуків</span>
                  )}

                  <span className="flex items-center gap-1.5">
                    {profile.format === "offline" ? (
                      <MapPin className="size-4" strokeWidth={2} aria-hidden />
                    ) : (
                      <Monitor className="size-4" strokeWidth={2} aria-hidden />
                    )}
                    {FORMAT_LABELS[profile.format]}
                    {profile.city ? `, ${profile.city}` : ""}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" strokeWidth={2} aria-hidden />
                    {profile.timezone}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
            <h2 className="text-title-lg mb-4">Про репетитора</h2>
            <p className="text-body-lg whitespace-pre-line text-muted-foreground">
              {profile.bio}
            </p>
          </section>

          <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
            <h2 className="text-title-lg mb-5">Що викладає</h2>

            <div className="space-y-5">
              <div>
                <span className="text-label-md mb-2 block text-muted-foreground">
                  Мови
                </span>
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((lang) => (
                    <span
                      key={lang}
                      className="text-label-md rounded-full bg-soft-gold px-4 py-1.5 text-secondary"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-label-md mb-2 block text-muted-foreground">
                  Рівні CEFR
                </span>
                <div className="flex flex-wrap gap-2">
                  {levels.map((level) => (
                    <span
                      key={level}
                      className="text-label-md rounded-full bg-muted px-4 py-1.5 text-muted-foreground"
                    >
                      {level}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
            <h2 className="text-title-lg mb-5">Вільний час</h2>
            <SlotList slots={slots} tutorTimeZone={profile.timezone} />
          </section>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-border bg-card p-6 shadow-level1">
            <span className="text-label-md text-muted-foreground">
              Ціна за урок
            </span>
            <p className="text-display-lg mt-1 text-secondary">
              {formatPrice(profile.pricePerLesson, profile.currency)}
            </p>

            {hasTrial && (
              <p className="text-label-md mt-4 flex items-center gap-2 rounded-input bg-sage-green/10 px-3 py-2 text-sage-green">
                <Sparkles className="size-4" strokeWidth={2} aria-hidden />
                Пробний урок —{" "}
                {formatPrice(profile.trialPrice, profile.currency)}
              </p>
            )}

            <ButtonLink
              href="/register"
              size="lg"
              className="mt-6 w-full rounded-full"
            >
              Створити акаунт
            </ButtonLink>
            <p className="text-label-sm mt-3 text-center text-outline">
              Бронювання слотів і оплата зʼявляться найближчим часом.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
