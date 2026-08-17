import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Лічильники учня — найтонше місце блоку C.2: їх бачать учень і батьки як
 * підсумок навчання, а звіт можна переписати. Тому перевіряємо саме
 * арифметику: повторне збереження не має додавати вдруге.
 */

const PROJECT_ID = "demo-mentora-reports";
process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.GCLOUD_PROJECT = PROJECT_ID;

const { adminDb } = await import("@/lib/firebase/admin");
const { applyLessonReport, ReportError } = await import(
  "@/lib/server/lesson-service"
);

const db = adminDb();

const TUTOR = "olena";
const ENROLLMENT = `${TUTOR}__marko`;
const LESSON = "lesson-1";

function report(overrides: Record<string, unknown> = {}) {
  return {
    topic: "Минулий час",
    newWordsCount: 12,
    speakingPractice: true,
    noteForStudent: "Гарний прогрес.",
    ...overrides,
  };
}

async function seed(lessonStatus = "scheduled", lessonReport: unknown = null) {
  await db.doc(`students/${ENROLLMENT}`).set({
    tutorId: TUTOR,
    studentUid: "marko",
    parentUids: [],
    name: "Марко Кравець",
    languages: ["Англійська"],
    currentLevel: null,
    goalLevel: null,
    goalText: "",
    totalNewWords: 0,
    lessonsCount: 0,
    createdAt: "2026-09-01T10:00:00.000Z",
  });
  await db.doc(`students/${ENROLLMENT}/lessons/${LESSON}`).set({
    slotStart: "2026-09-07T15:00:00.000Z",
    durationMin: 60,
    status: lessonStatus,
    bookingId: "booking-1",
    report: lessonReport,
    createdAt: "2026-09-01T10:00:00.000Z",
  });
}

async function counters() {
  const snap = await db.doc(`students/${ENROLLMENT}`).get();
  return {
    lessonsCount: snap.get("lessonsCount") as number,
    totalNewWords: snap.get("totalNewWords") as number,
  };
}

async function clearAll() {
  const homework = await db.collection(`students/${ENROLLMENT}/homework`).get();
  await Promise.all(homework.docs.map((d) => d.ref.delete()));
  await db.doc(`students/${ENROLLMENT}/lessons/${LESSON}`).delete();
  await db.doc(`students/${ENROLLMENT}`).delete();
}

beforeAll(clearAll);
beforeEach(clearAll);
afterAll(clearAll);

describe("звіт після уроку", () => {
  it("записує звіт, закриває урок і рухає лічильники", async () => {
    await seed();

    await applyLessonReport({
      tutorUid: TUTOR,
      enrollmentId: ENROLLMENT,
      lessonId: LESSON,
      report: report(),
    });

    const lesson = (
      await db.doc(`students/${ENROLLMENT}/lessons/${LESSON}`).get()
    ).data();
    expect(lesson?.status).toBe("done");
    expect(lesson?.report.topic).toBe("Минулий час");

    expect(await counters()).toEqual({ lessonsCount: 1, totalNewWords: 12 });
  });

  it("повторне збереження не рахує урок удруге", async () => {
    await seed();

    await applyLessonReport({
      tutorUid: TUTOR,
      enrollmentId: ENROLLMENT,
      lessonId: LESSON,
      report: report(),
    });
    await applyLessonReport({
      tutorUid: TUTOR,
      enrollmentId: ENROLLMENT,
      lessonId: LESSON,
      report: report(),
    });

    expect(await counters()).toEqual({ lessonsCount: 1, totalNewWords: 12 });
  });

  it("виправлення кількості слів змінює підсумок на різницю", async () => {
    await seed();

    await applyLessonReport({
      tutorUid: TUTOR,
      enrollmentId: ENROLLMENT,
      lessonId: LESSON,
      report: report({ newWordsCount: 12 }),
    });
    // Репетитор помітив, що слів було менше.
    await applyLessonReport({
      tutorUid: TUTOR,
      enrollmentId: ENROLLMENT,
      lessonId: LESSON,
      report: report({ newWordsCount: 5 }),
    });

    expect(await counters()).toEqual({ lessonsCount: 1, totalNewWords: 5 });
  });

  it("звіт разом із домашнім завданням створює завдання", async () => {
    await seed();

    await applyLessonReport({
      tutorUid: TUTOR,
      enrollmentId: ENROLLMENT,
      lessonId: LESSON,
      report: report(),
      homework: { text: "Вивчити слова з уроку", deadline: "2026-09-14" },
    });

    const homework = await db
      .collection(`students/${ENROLLMENT}/homework`)
      .get();
    expect(homework.size).toBe(1);
    expect(homework.docs[0].get("status")).toBe("assigned");
    expect(homework.docs[0].get("lessonId")).toBe(LESSON);
    expect(homework.docs[0].get("submissionFileUrl")).toBe("");
  });
});

describe("захист", () => {
  it("чужий репетитор не може відзвітувати урок", async () => {
    await seed();

    await expect(
      applyLessonReport({
        tutorUid: "petro",
        enrollmentId: ENROLLMENT,
        lessonId: LESSON,
        report: report(),
      })
    ).rejects.toBeInstanceOf(ReportError);

    expect(await counters()).toEqual({ lessonsCount: 0, totalNewWords: 0 });
  });

  it("скасований урок відзвітувати не можна", async () => {
    await seed("cancelled");

    await expect(
      applyLessonReport({
        tutorUid: TUTOR,
        enrollmentId: ENROLLMENT,
        lessonId: LESSON,
        report: report(),
      })
    ).rejects.toBeInstanceOf(ReportError);
  });

  it("неіснуючий урок дає помилку, а не тихий запис", async () => {
    await seed();

    await expect(
      applyLessonReport({
        tutorUid: TUTOR,
        enrollmentId: ENROLLMENT,
        lessonId: "no-such-lesson",
        report: report(),
      })
    ).rejects.toBeInstanceOf(ReportError);
  });
});

describe("урок, який уже позначено проведеним", () => {
  it("перший звіт усе одно рахує урок — лічильник іде за звітом, не за статусом", async () => {
    await seed("done");

    await applyLessonReport({
      tutorUid: TUTOR,
      enrollmentId: ENROLLMENT,
      lessonId: LESSON,
      report: report({ newWordsCount: 8 }),
    });

    expect(await counters()).toEqual({ lessonsCount: 1, totalNewWords: 8 });
  });
});
