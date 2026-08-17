"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import {
  LESSON_STATUS_LABELS,
  type EnrollmentWithId,
  type LessonStatus,
} from "@/lib/enrollment";
import { getPublicTutorProfile } from "@/lib/firebase/tutor-profile-repo";
import {
  useEnrollments,
  useLessonsInRange,
} from "@/lib/hooks/use-enrollments";
import { browserTimeZone } from "@/lib/timezone";
import type { Role } from "@/lib/types";

const STATUS_STYLES: Record<LessonStatus, string> = {
  scheduled: "bg-soft-gold text-secondary",
  done: "bg-sage-green/10 text-sage-green",
  cancelled: "bg-badge-neutral text-muted-foreground",
};

/**
 * Найближчі заняття. Один компонент на всі три ролі: список той самий,
 * різниця лише в тому, кого показувати другою стороною.
 *
 * Читає через підписки — статус, який репетитор змінив у картці учня,
 * учень бачить без перезавантаження.
 */
export function UpcomingLessons({ role }: { role: Role }) {
  const { enrollments } = useEnrollments(role);

  // Момент відліку фіксуємо один раз: інакше кожен рендер давав би нову
  // межу проміжку й перепідписував слухачів.
  const from = useMemo(() => new Date().toISOString(), []);
  const lessons = useLessonsInRange(enrollments, from);

  const counterparts = useCounterpartNames(role, enrollments);

  if (lessons === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо заняття…
      </p>
    );
  }

  if (lessons.length === 0) {
    return (
      <p className="text-body-md text-muted-foreground">
        {role === "tutor"
          ? "Запланованих занять немає. Вони зʼявляться, коли учні оплатять бронь."
          : "Запланованих занять немає. Оберіть репетитора в каталозі й оплатіть урок."}
      </p>
    );
  }

  const timeZone = browserTimeZone();
  const formatter = new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {lessons.map((lesson) => (
          <li
            key={`${lesson.enrollmentId}/${lesson.id}`}
            className="rounded-input border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-label-md flex items-center gap-2 text-secondary">
                  <CalendarClock className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                  {formatter.format(new Date(lesson.slotStart))}
                </p>
                <p className="text-label-sm mt-1 text-muted-foreground">
                  {counterparts[lesson.enrollmentId] ?? "—"} · {lesson.durationMin} хв
                </p>
              </div>

              <span
                className={`text-label-sm rounded-full px-3 py-1 ${STATUS_STYLES[lesson.status]}`}
              >
                {LESSON_STATUS_LABELS[lesson.status]}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-label-sm text-outline">
        Час показано у вашому поясі ({timeZone}).
      </p>
    </div>
  );
}

/**
 * Кого показувати другою стороною: репетитору — учня (імʼя вже лежить
 * у звʼязку), учневі й батькам — репетитора (імʼя читається з його
 * публічного профілю).
 */
function useCounterpartNames(
  role: Role,
  enrollments: EnrollmentWithId[] | null
): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const tutorIds = (enrollments ?? []).map((e) => e.tutorId).join(",");

  useEffect(() => {
    if (role === "tutor" || !enrollments || enrollments.length === 0) return;
    let cancelled = false;

    (async () => {
      const profiles = await Promise.all(
        enrollments.map((e) => getPublicTutorProfile(e.tutorId))
      );
      if (cancelled) return;
      setNames(
        Object.fromEntries(
          enrollments.map((e, index) => [
            e.id,
            profiles[index]?.displayName ?? "Репетитор",
          ])
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [role, tutorIds, enrollments]);

  if (role === "tutor") {
    return Object.fromEntries((enrollments ?? []).map((e) => [e.id, e.name]));
  }
  return names;
}
