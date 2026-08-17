"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
import Image from "next/image";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingScreen } from "@/components/loading-screen";
import { ChipToggleGroup } from "@/components/tutor/chip-toggle";
import { TutorCard } from "@/components/tutor/tutor-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  getTutorProfile,
  saveTutorProfile,
} from "@/lib/firebase/tutor-profile-repo";
import {
  CEFR_LEVELS,
  CURRENCIES,
  FORMAT_LABELS,
  LANGUAGES,
  LESSON_FORMATS,
  tutorProfileSchema,
  type CefrLevel,
  type Language,
  type TutorProfile,
  type TutorProfileInput,
} from "@/lib/tutor-profile";

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
  } catch {
    return "Europe/Kyiv";
  }
}

function ProfileForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState(false);
  const [savingAs, setSavingAs] = useState<"draft" | "published" | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<TutorProfileInput>({
    resolver: zodResolver(tutorProfileSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      languages: [],
      levelsTaught: [],
      pricePerLesson: 500,
      currency: "UAH",
      format: "online",
      city: "",
      timezone: browserTimezone(),
      trialPrice: 0,
      photoURL: "",
    },
  });

  // useWatch (а не watch()) — офіційна API підписки на значення форми;
  // потрібна для живого прев'ю й сумісна з React Compiler.
  const values = useWatch({ control });

  // Підтягуємо наявний профіль (або готуємо новий з іменем з акаунта).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await getTutorProfile(user.uid);
        if (cancelled) return;
        if (existing) {
          const { ratingAvg, ratingCount, isPublished, ...input } = existing;
          void ratingAvg;
          void ratingCount;
          reset(input as TutorProfileInput);
          setPublished(isPublished);
        } else {
          reset({
            displayName: user.displayName ?? "",
            bio: "",
            languages: [],
            levelsTaught: [],
            pricePerLesson: 500,
            currency: "UAH",
            format: "online",
            city: "",
            timezone: browserTimezone(),
            trialPrice: 0,
            photoURL: user.photoURL ?? "",
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Не вдалося завантажити профіль.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, reset]);

  /**
   * Перемикачі мультивибору читають АКТУАЛЬНЕ значення через getValues() —
   * це живе сховище react-hook-form (ref), а не React-стан. Тому кілька
   * швидких кліків підряд не губляться через батчинг React.
   */
  function toggleLanguage(lang: Language) {
    const current = getValues("languages") ?? [];
    setValue(
      "languages",
      current.includes(lang)
        ? current.filter((v) => v !== lang)
        : [...current, lang],
      { shouldValidate: true }
    );
  }

  function toggleLevel(level: CefrLevel) {
    const current = getValues("levelsTaught") ?? [];
    setValue(
      "levelsTaught",
      current.includes(level)
        ? current.filter((v) => v !== level)
        : [...current, level],
      { shouldValidate: true }
    );
  }

  function submitAs(target: "draft" | "published") {
    return handleSubmit(async (data) => {
      if (!user) return;
      setSavingAs(target);
      try {
        await saveTutorProfile(user.uid, data, target === "published");
        setPublished(target === "published");
        toast.success(
          target === "published"
            ? "Профіль опубліковано — він з'явиться в каталозі."
            : "Чернетку збережено."
        );
      } catch (err) {
        console.error(err);
        toast.error("Не вдалося зберегти профіль.");
      } finally {
        setSavingAs(null);
      }
    })();
  }

  if (loading) return <LoadingScreen label="Завантажуємо профіль…" />;

  // Прев'ю з поточних значень форми — так репетитор бачить себе очима гостя.
  // useWatch повертає частковий об'єкт (форма може бути недозаповнена),
  // тож підставляємо нейтральні значення, щоб картка рендерилась завжди.
  const previewProfile: TutorProfile = {
    displayName: values.displayName?.trim() || "Ваше ім'я",
    bio: values.bio?.trim() || "Тут буде ваш опис — розкажіть про досвід і підхід.",
    languages: values.languages ?? [],
    levelsTaught: values.levelsTaught ?? [],
    pricePerLesson: values.pricePerLesson || 0,
    currency: values.currency ?? "UAH",
    format: values.format ?? "online",
    city: values.city,
    timezone: values.timezone ?? "Europe/Kyiv",
    trialPrice: values.trialPrice ?? 0,
    photoURL: values.photoURL,
    ratingAvg: 0,
    ratingCount: 0,
    isPublished: published,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* ── Форма ─────────────────────────────────────────── */}
      <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
        <section className="rounded-card border border-border bg-card p-6 shadow-level1">
          <h2 className="text-title-lg mb-5">Про вас</h2>

          <div className="space-y-5">
            {/* Фото — поки посиланням: Cloud Storage вимагає платного плану Blaze.
                Завантаження файлом повернемо, коли проєкт перейде на Blaze. */}
            <div className="flex items-start gap-4">
              {values.photoURL ? (
                <Image
                  src={values.photoURL}
                  alt="Фото профілю"
                  width={72}
                  height={72}
                  className="size-18 shrink-0 rounded-2xl object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex size-18 shrink-0 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <UserRound className="size-8" strokeWidth={1.75} />
                </span>
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="photoURL">Посилання на фото</Label>
                <Input
                  id="photoURL"
                  type="url"
                  placeholder="https://…"
                  {...register("photoURL")}
                />
                {errors.photoURL ? (
                  <p className="text-label-sm text-terracotta">
                    {errors.photoURL.message}
                  </p>
                ) : (
                  <p className="text-label-sm text-outline">
                    Можна лишити порожнім — покажемо заглушку.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">{"Ім'я"}</Label>
              <Input id="displayName" {...register("displayName")} />
              {errors.displayName && (
                <p className="text-label-sm text-terracotta">
                  {errors.displayName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Про себе</Label>
              <Textarea
                id="bio"
                rows={5}
                placeholder="Досвід, підхід до навчання, з якими цілями допомагаєте…"
                {...register("bio")}
              />
              <p className="text-label-sm text-outline">
                {values.bio?.length ?? 0} / 1500
              </p>
              {errors.bio && (
                <p className="text-label-sm text-terracotta">
                  {errors.bio.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-card p-6 shadow-level1">
          <h2 className="text-title-lg mb-5">Що викладаєте</h2>

          <div className="space-y-5">
            <ChipToggleGroup
              label="Мови"
              options={LANGUAGES}
              selected={values.languages ?? []}
              onToggle={toggleLanguage}
              error={errors.languages?.message}
            />

            <ChipToggleGroup
              label="Рівні (CEFR)"
              options={CEFR_LEVELS}
              selected={values.levelsTaught ?? []}
              onToggle={toggleLevel}
              error={errors.levelsTaught?.message}
            />
          </div>
        </section>

        <section className="rounded-card border border-border bg-card p-6 shadow-level1">
          <h2 className="text-title-lg mb-5">Умови</h2>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pricePerLesson">Ціна за урок</Label>
                <Input
                  id="pricePerLesson"
                  type="number"
                  min={1}
                  {...register("pricePerLesson", { valueAsNumber: true })}
                />
                {errors.pricePerLesson && (
                  <p className="text-label-sm text-terracotta">
                    {errors.pricePerLesson.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Валюта</Label>
                <select
                  id="currency"
                  className="text-body-md h-10 w-full rounded-input border border-input bg-card px-3"
                  {...register("currency")}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trialPrice">
                Ціна пробного уроку (0 — пробного немає)
              </Label>
              <Input
                id="trialPrice"
                type="number"
                min={0}
                {...register("trialPrice", { valueAsNumber: true })}
              />
              {errors.trialPrice && (
                <p className="text-label-sm text-terracotta">
                  {errors.trialPrice.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="format">Формат</Label>
                <select
                  id="format"
                  className="text-body-md h-10 w-full rounded-input border border-input bg-card px-3"
                  {...register("format")}
                >
                  {LESSON_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>

              {values.format !== "online" && (
                <div className="space-y-2">
                  <Label htmlFor="city">Місто</Label>
                  <Input id="city" {...register("city")} />
                  {errors.city && (
                    <p className="text-label-sm text-terracotta">
                      {errors.city.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Часовий пояс</Label>
              <Input id="timezone" {...register("timezone")} />
              <p className="text-label-sm text-outline">
                Впливає на показ ваших слотів учням з інших регіонів.
              </p>
              {errors.timezone && (
                <p className="text-label-sm text-terracotta">
                  {errors.timezone.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="rounded-full"
            size="lg"
            onClick={() => submitAs("published")}
            disabled={savingAs !== null}
          >
            {savingAs === "published" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {published ? "Зберегти та лишити в каталозі" : "Опублікувати профіль"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            size="lg"
            onClick={() => submitAs("draft")}
            disabled={savingAs !== null}
          >
            {savingAs === "draft" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {published ? "Зняти з публікації" : "Зберегти чернетку"}
          </Button>
        </div>
      </form>

      {/* ── Прев'ю ────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-title-lg">{"Прев'ю"}</h2>
          <span
            className={
              published
                ? "text-label-sm rounded-full bg-sage-green/10 px-3 py-1 text-sage-green"
                : "text-label-sm rounded-full bg-muted px-3 py-1 text-muted-foreground"
            }
          >
            {published ? "У каталозі" : "Чернетка"}
          </span>
        </div>
        <p className="text-label-md mb-4 text-muted-foreground">
          Так вас побачить учень у каталозі.
        </p>
        <TutorCard profile={previewProfile} />
      </aside>
    </div>
  );
}

export default function TutorProfilePage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Профіль репетитора"
        description="Заповніть профіль, щоб учні могли знайти вас у каталозі."
      >
        <ProfileForm />
      </DashboardLayout>
    </AuthGate>
  );
}
