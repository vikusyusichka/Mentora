"use client";

import { useEffect, useState } from "react";

import type { EnrollmentWithId, LessonWithId } from "@/lib/enrollment";
import {
  subscribeEnrollments,
  subscribeLessons,
} from "@/lib/firebase/enrollment-repo";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Role } from "@/lib/types";

/** Навчальні звʼязки поточного користувача в реальному часі. */
export function useEnrollments(role: Role): {
  enrollments: EnrollmentWithId[] | null;
  error: string | null;
} {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithId[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeEnrollments(
      role,
      user.uid,
      (found) => {
        setEnrollments(
          [...found].sort((a, b) => a.name.localeCompare(b.name, "uk"))
        );
      },
      (err) => {
        console.error("[enrollments]", err);
        setError("Не вдалося завантажити дані.");
        setEnrollments([]);
      }
    );
  }, [user, role]);

  return { enrollments, error };
}

/**
 * Уроки за проміжком по всіх звʼязках одразу.
 *
 * Підписка йде на кожен звʼязок окремо: у `lessons` немає `tutorId`, а
 * денормалізувати його заради collection-group запиту означало б тримати
 * копію звʼязку свіжою — зайвий клас помилок. Учнів у репетитора одиниці,
 * тож окремі підписки дешевші за цю ціну.
 */
export function useLessonsInRange(
  enrollments: EnrollmentWithId[] | null,
  from: string,
  to?: string
): LessonWithId[] | null {
  // Разом із уроками зберігаємо, для якого саме проміжку вони прийшли.
  // Так «готовність» виводиться з даних, без окремого прапорця, який
  // довелося б скидати при кожній зміні періоду.
  const [byEnrollment, setByEnrollment] = useState<
    Record<string, { rangeKey: string; lessons: LessonWithId[] }>
  >({});

  const rangeKey = `${from}|${to ?? ""}`;
  const ids = (enrollments ?? []).map((e) => e.id);
  const idsKey = ids.join(",");

  useEffect(() => {
    if (enrollments === null || enrollments.length === 0) return;

    const unsubscribers = enrollments.map((enrollment) =>
      subscribeLessons(
        enrollment.id,
        { from, to },
        (lessons) => {
          setByEnrollment((prev) => ({
            ...prev,
            [enrollment.id]: { rangeKey, lessons },
          }));
        },
        (err) => {
          console.error("[tutor] lessons", enrollment.id, err);
          setByEnrollment((prev) => ({
            ...prev,
            [enrollment.id]: { rangeKey, lessons: [] },
          }));
        }
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    // `idsKey` замість масиву об'єктів: нове посилання на той самий
    // список інакше перепідписувало б усіх слухачів щорендера.
  }, [idsKey, from, to, rangeKey, enrollments]);

  if (enrollments === null) return null;

  const ready = ids.every((id) => byEnrollment[id]?.rangeKey === rangeKey);
  if (!ready) return null;

  return ids
    .flatMap((id) => byEnrollment[id].lessons)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
}
