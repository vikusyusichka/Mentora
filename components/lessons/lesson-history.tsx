"use client";

import { Loader2, Sparkles } from "lucide-react";

import {
  useEnrollments,
  useLessonsInRange,
} from "@/lib/hooks/use-enrollments";
import { browserTimeZone } from "@/lib/timezone";
import type { Role } from "@/lib/types";

const FROM_BEGINNING = "1970-01-01T00:00:00.000Z";

/**
 * Проведені уроки зі звітами — те, що учень і батьки бачать як результат
 * занять. Підписка жива: звіт, який репетитор щойно зберіг, зʼявляється
 * без перезавантаження.
 */
export function LessonHistory({
  role,
  max = 5,
}: {
  role: Role;
  max?: number;
}) {
  const { enrollments } = useEnrollments(role);

  // Беремо всі уроки, а не «ті, що в минулому»: ознака проведеного уроку —
  // звіт репетитора, а не годинник. Інакше урок, відзвітований раніше за
  // час у розкладі, зник би з очей учня.
  const lessons = useLessonsInRange(enrollments, FROM_BEGINNING);

  if (lessons === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо…
      </p>
    );
  }

  const withReports = lessons
    .filter((lesson) => lesson.report !== null)
    .reverse()
    .slice(0, max);

  if (withReports.length === 0) {
    return (
      <p className="text-body-md text-muted-foreground">
        Проведених уроків ще немає. Після заняття тут зʼявиться тема, нові
        слова й нотатка репетитора.
      </p>
    );
  }

  const formatter = new Intl.DateTimeFormat("uk-UA", {
    timeZone: browserTimeZone(),
    day: "numeric",
    month: "long",
  });

  return (
    <ul className="space-y-3">
      {withReports.map((lesson) => (
        <li
          key={`${lesson.enrollmentId}/${lesson.id}`}
          className="rounded-input border border-border p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-label-md text-secondary">
              {lesson.report?.topic}
            </p>
            <span className="text-label-sm text-outline">
              {formatter.format(new Date(lesson.slotStart))}
            </span>
          </div>

          <p className="text-label-md mt-2 flex flex-wrap items-center gap-x-3 text-muted-foreground">
            <span>Нових слів: {lesson.report?.newWordsCount}</span>
            {lesson.report?.speakingPractice && (
              <span className="inline-flex items-center gap-1 text-sage-green">
                <Sparkles className="size-3.5" strokeWidth={2} aria-hidden />
                розмовна практика
              </span>
            )}
          </p>

          {lesson.report?.noteForStudent && (
            <p className="text-body-md mt-2 whitespace-pre-line text-muted-foreground">
              {lesson.report.noteForStudent}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
