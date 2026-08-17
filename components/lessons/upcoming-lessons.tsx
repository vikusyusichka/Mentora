"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import {
  LESSON_STATUS_LABELS,
  type EnrollmentWithId,
  type LessonStatus,
  type LessonWithId,
} from "@/lib/enrollment";
import {
  getParentEnrollments,
  getStudentEnrollments,
  getTutorEnrollments,
  getUpcomingLessons,
} from "@/lib/firebase/enrollment-repo";
import { getPublicTutorProfile } from "@/lib/firebase/tutor-profile-repo";
import { useAuth } from "@/lib/hooks/use-auth";
import { browserTimeZone } from "@/lib/timezone";
import type { Role } from "@/lib/types";

const STATUS_STYLES: Record<LessonStatus, string> = {
  scheduled: "bg-soft-gold text-secondary",
  done: "bg-sage-green/10 text-sage-green",
  cancelled: "bg-badge-neutral text-muted-foreground",
};

interface LessonRow {
  lesson: LessonWithId;
  counterpart: string;
}

/**
 * Найближчі заняття. Один компонент на всі три ролі: список той самий,
 * різниця лише в тому, кого показувати другою стороною — і в тому, як
 * саме роль дістає свої звʼязки.
 *
 * Рендериться за AuthGate, тобто завжди в браузері, тож час одразу
 * форматуємо в зоні глядача.
 */
export function UpcomingLessons({ role }: { role: Role }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LessonRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const enrollments = await loadEnrollments(role, user.uid);
        const lessons = await getUpcomingLessons(enrollments.map((e) => e.id));
        if (cancelled) return;

        const counterparts = await counterpartNames(role, enrollments);
        if (cancelled) return;

        setRows(
          lessons.map((lesson) => ({
            lesson,
            counterpart: counterparts[lesson.enrollmentId] ?? "—",
          }))
        );
      } catch (err) {
        console.error("[lessons] upcoming", err);
        if (!cancelled) setRows([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  if (rows === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо заняття…
      </p>
    );
  }

  if (rows.length === 0) {
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
        {rows.map(({ lesson, counterpart }) => (
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
                  {counterpart} · {lesson.durationMin} хв
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

function loadEnrollments(role: Role, uid: string): Promise<EnrollmentWithId[]> {
  if (role === "tutor") return getTutorEnrollments(uid);
  if (role === "student") return getStudentEnrollments(uid);
  return getParentEnrollments(uid);
}

/**
 * Кого показувати другою стороною: репетитору — учня (ім'я вже лежить
 * в enrollment), учневі й батькам — репетитора (ім'я читається з його
 * публічного профілю).
 */
async function counterpartNames(
  role: Role,
  enrollments: readonly EnrollmentWithId[]
): Promise<Record<string, string>> {
  if (role === "tutor") {
    return Object.fromEntries(enrollments.map((e) => [e.id, e.name]));
  }

  const profiles = await Promise.all(
    enrollments.map((e) => getPublicTutorProfile(e.tutorId))
  );

  return Object.fromEntries(
    enrollments.map((e, index) => [
      e.id,
      profiles[index]?.displayName ?? "Репетитор",
    ])
  );
}
