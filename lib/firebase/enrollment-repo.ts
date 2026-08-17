import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  Enrollment,
  EnrollmentWithId,
  Homework,
  HomeworkStatus,
  HomeworkWithId,
  Lesson,
  LessonStatus,
  LessonWithId,
} from "@/lib/enrollment";
import type { Role } from "@/lib/types";

/**
 * Навчальні звʼязки та уроки. Читаються під Security Rules: доступ дає
 * сам документ enrollment (`tutorId` / `studentUid` / `parentUids`).
 */

// Читання — тільки підписками. Це наскрізна домовленість проєкту:
// зміну, яку зробив репетитор, учень бачить без перезавантаження.

/**
 * Звʼязки користувача — кожна роль дивиться зі свого боку того самого
 * документа: репетитор за `tutorId`, учень за `studentUid`, батьки —
 * через `parentUids`.
 */
export function subscribeEnrollments(
  role: Role,
  uid: string,
  onChange: (enrollments: EnrollmentWithId[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const clause =
    role === "tutor"
      ? where("tutorId", "==", uid)
      : role === "student"
        ? where("studentUid", "==", uid)
        : where("parentUids", "array-contains", uid);

  return onSnapshot(
    query(collection(db, "students"), clause, limit(200)),
    (snapshot) => {
      onChange(
        snapshot.docs.map((snap) => ({
          id: snap.id,
          ...(snap.data() as Enrollment),
        }))
      );
    },
    onError
  );
}

export function subscribeEnrollment(
  enrollmentId: string,
  onChange: (enrollment: EnrollmentWithId | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "students", enrollmentId),
    (snap) => {
      onChange(
        snap.exists()
          ? { id: snap.id, ...(snap.data() as Enrollment) }
          : null
      );
    },
    onError
  );
}

/** Уроки одного звʼязку за проміжком. `to` не задано — усі майбутні. */
export function subscribeLessons(
  enrollmentId: string,
  range: { from: string; to?: string },
  onChange: (lessons: LessonWithId[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const constraints = [
    where("slotStart", ">=", range.from),
    ...(range.to ? [where("slotStart", "<=", range.to)] : []),
    orderBy("slotStart", "asc"),
    limit(200),
  ];

  return onSnapshot(
    query(collection(db, "students", enrollmentId, "lessons"), ...constraints),
    (snapshot) => {
      onChange(
        snapshot.docs.map((snap) => ({
          id: snap.id,
          enrollmentId,
          ...(snap.data() as Lesson),
        }))
      );
    },
    onError
  );
}

/**
 * Картка учня. Свідомо приймає лише поля, які веде репетитор: звʼязки
 * визначають доступ, лічильники рахує сервер — правила відхилять спробу
 * їх чіпати, і краще не давати такої можливості в API взагалі.
 */
export function updateEnrollmentCard(
  enrollmentId: string,
  patch: Partial<
    Pick<
      Enrollment,
      "name" | "languages" | "currentLevel" | "goalLevel" | "goalText"
    >
  >
): Promise<void> {
  return updateDoc(doc(db, "students", enrollmentId), patch);
}

export function setLessonStatus(
  enrollmentId: string,
  lessonId: string,
  status: LessonStatus
): Promise<void> {
  return updateDoc(
    doc(db, "students", enrollmentId, "lessons", lessonId),
    { status }
  );
}

// ── Домашні завдання (Блок C.2) ───────────────────────────────────────
//
// На відміну від звіту, ДЗ не чіпає лічильників, тож пишеться з клієнта
// напряму — правила вже стежать, хто що може: репетитор веде завдання,
// учень міняє лише `status` і `submissionFileUrl`, батьки читають.

export function subscribeHomework(
  enrollmentId: string,
  onChange: (homework: HomeworkWithId[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "students", enrollmentId, "homework"),
      orderBy("deadline", "desc"),
      limit(100)
    ),
    (snapshot) => {
      onChange(
        snapshot.docs.map((snap) => ({
          id: snap.id,
          ...(snap.data() as Homework),
        }))
      );
    },
    onError
  );
}

export function createHomework(
  enrollmentId: string,
  input: { text: string; deadline: string; lessonId?: string | null }
): Promise<unknown> {
  const homework: Homework = {
    text: input.text.trim(),
    deadline: input.deadline,
    status: "assigned",
    submissionFileUrl: "",
    lessonId: input.lessonId ?? null,
    createdAt: new Date().toISOString(),
  };
  return addDoc(collection(db, "students", enrollmentId, "homework"), homework);
}

export function deleteHomework(
  enrollmentId: string,
  homeworkId: string
): Promise<void> {
  return deleteDoc(doc(db, "students", enrollmentId, "homework", homeworkId));
}

/**
 * Здача завдання учнем. Свідомо приймає лише ці два поля — рівно те, що
 * дозволяють правила: ані текст, ані дедлайн учень змінити не може.
 */
export function submitHomework(
  enrollmentId: string,
  homeworkId: string,
  patch: { status: HomeworkStatus; submissionFileUrl?: string }
): Promise<void> {
  return updateDoc(doc(db, "students", enrollmentId, "homework", homeworkId), {
    status: patch.status,
    submissionFileUrl: patch.submissionFileUrl ?? "",
  });
}
