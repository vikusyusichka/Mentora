import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import type {
  Enrollment,
  Homework,
  Lesson,
  LessonReport,
} from "@/lib/enrollment";

/**
 * Звіт після уроку (Блок C.2).
 *
 * Живе на сервері не через складність, а через лічильники: `lessonsCount`
 * і `totalNewWords` показуються учневі й батькам як підсумок навчання, тож
 * Security Rules забороняють клієнту їх чіпати. Оновити їх може лише той,
 * хто пише сам звіт — і робить це однією транзакцією з ним.
 *
 * У типовій архітектурі Firebase це був би тригер Cloud Function, але вони
 * потребують платного плану (див. розділ «нульовий бюджет»).
 */

export type ReportFailure =
  | "enrollment-not-found"
  | "not-your-student"
  | "lesson-not-found"
  | "lesson-cancelled";

export class ReportError extends Error {
  constructor(readonly reason: ReportFailure) {
    super(reason);
  }
}

export const REPORT_ERROR_MESSAGES: Record<ReportFailure, string> = {
  "enrollment-not-found": "Учня не знайдено.",
  "not-your-student": "Це не ваш учень.",
  "lesson-not-found": "Урок не знайдено.",
  "lesson-cancelled": "Скасований урок не можна відзвітувати.",
};

export async function applyLessonReport({
  tutorUid,
  enrollmentId,
  lessonId,
  report,
  homework,
}: {
  tutorUid: string;
  enrollmentId: string;
  lessonId: string;
  report: LessonReport;
  homework?: { text: string; deadline: string } | null;
}): Promise<void> {
  const db = adminDb();
  const enrollmentRef = db.doc(`students/${enrollmentId}`);
  const lessonRef = enrollmentRef.collection("lessons").doc(lessonId);

  await db.runTransaction(async (tx) => {
    const [enrollmentSnap, lessonSnap] = await Promise.all([
      tx.get(enrollmentRef),
      tx.get(lessonRef),
    ]);

    if (!enrollmentSnap.exists) throw new ReportError("enrollment-not-found");
    const enrollment = enrollmentSnap.data() as Enrollment;
    if (enrollment.tutorId !== tutorUid) throw new ReportError("not-your-student");

    if (!lessonSnap.exists) throw new ReportError("lesson-not-found");
    const lesson = lessonSnap.data() as Lesson;
    if (lesson.status === "cancelled") throw new ReportError("lesson-cancelled");

    // Звіт можна переписати — тоді лічильники змінюються на різницю,
    // а не додаються вдруге.
    const previousWords = lesson.report?.newWordsCount ?? 0;
    const wordsDelta = report.newWordsCount - previousWords;

    // «Проведено уроків» рахується за наявністю звіту, а не за статусом:
    // статус міняється й з клієнта, а лічильники правила клієнту не дають.
    // Прив'язка до звіту робить цифру відтворюваною — її завжди можна
    // перерахувати, порахувавши уроки зі звітом.
    const lessonsDelta = lesson.report ? 0 : 1;

    tx.update(lessonRef, { report, status: "done" });

    if (wordsDelta !== 0 || lessonsDelta !== 0) {
      tx.update(enrollmentRef, {
        totalNewWords: FieldValue.increment(wordsDelta),
        lessonsCount: FieldValue.increment(lessonsDelta),
      });
    }

    if (homework) {
      const doc: Homework = {
        text: homework.text,
        deadline: homework.deadline,
        status: "assigned",
        submissionFileUrl: "",
        lessonId,
        createdAt: new Date().toISOString(),
      };
      tx.set(enrollmentRef.collection("homework").doc(), doc);
    }
  });
}
