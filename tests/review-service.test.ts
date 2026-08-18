import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Рейтинг визначає позицію в каталозі, тож перевіряємо і право на відгук,
 * і арифметику на справжніх документах.
 */

const PROJECT_ID = "demo-mentora-reviews";
process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.GCLOUD_PROJECT = PROJECT_ID;

const { adminDb } = await import("@/lib/firebase/admin");
const { submitReview, ReviewError } = await import(
  "@/lib/server/review-service"
);

const db = adminDb();

const TUTOR = "olena";
const STUDENT = "marko";
const ENROLLMENT = `${TUTOR}__${STUDENT}`;

async function seedTutor() {
  await db.doc(`tutorProfiles/${TUTOR}`).set({
    displayName: "Олена Вчителька",
    languages: ["Англійська"],
    levelsTaught: ["B1"],
    pricePerLesson: 500,
    currency: "UAH",
    format: "online",
    timezone: "Europe/Kyiv",
    trialPrice: 0,
    isPublished: true,
    ratingAvg: 0,
    ratingCount: 0,
  });
  await db.doc(`users/${STUDENT}`).set({
    role: "student",
    displayName: "Марко Кравець",
    email: "marko@example.com",
  });
}

async function seedEnrollment(lessonStatus: string | null) {
  await db.doc(`students/${ENROLLMENT}`).set({
    tutorId: TUTOR,
    studentUid: STUDENT,
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

  if (lessonStatus) {
    await db.doc(`students/${ENROLLMENT}/lessons/l1`).set({
      slotStart: "2026-09-07T15:00:00.000Z",
      durationMin: 60,
      status: lessonStatus,
      bookingId: "b1",
      report: null,
      createdAt: "2026-09-01T10:00:00.000Z",
    });
  }
}

async function rating() {
  const snap = await db.doc(`tutorProfiles/${TUTOR}`).get();
  return {
    ratingAvg: snap.get("ratingAvg") as number,
    ratingCount: snap.get("ratingCount") as number,
    ratingSum: snap.get("ratingSum") as number | undefined,
  };
}

async function clearAll() {
  for (const path of [`students/${ENROLLMENT}/lessons/l1`, `students/${ENROLLMENT}`]) {
    await db.doc(path).delete();
  }
  const reviews = await db.collection("reviews").get();
  await Promise.all(reviews.docs.map((d) => d.ref.delete()));
  await db.doc(`tutorProfiles/${TUTOR}`).delete();
  await db.doc(`users/${STUDENT}`).delete();
}

beforeAll(clearAll);
beforeEach(clearAll);
afterAll(clearAll);

describe("право на відгук", () => {
  it("без проведеного уроку відгук неможливий", async () => {
    await seedTutor();
    await seedEnrollment("scheduled");

    await expect(
      submitReview({ studentUserId: STUDENT, tutorId: TUTOR, rating: 5, text: "" })
    ).rejects.toBeInstanceOf(ReviewError);

    expect((await rating()).ratingCount).toBe(0);
  });

  it("без навчального звʼязку взагалі — теж", async () => {
    await seedTutor();

    await expect(
      submitReview({ studentUserId: STUDENT, tutorId: TUTOR, rating: 5, text: "" })
    ).rejects.toBeInstanceOf(ReviewError);
  });

  it("неіснуючий репетитор", async () => {
    await expect(
      submitReview({ studentUserId: STUDENT, tutorId: "nobody", rating: 5, text: "" })
    ).rejects.toBeInstanceOf(ReviewError);
  });
});

describe("відгук і рейтинг", () => {
  it("проведений урок дає право, рейтинг оновлюється", async () => {
    await seedTutor();
    await seedEnrollment("done");

    await submitReview({
      studentUserId: STUDENT,
      tutorId: TUTOR,
      rating: 5,
      text: "Дуже задоволений.",
    });

    expect(await rating()).toEqual({
      ratingAvg: 5,
      ratingCount: 1,
      ratingSum: 5,
    });

    const review = (await db.doc(`reviews/${TUTOR}__${STUDENT}`).get()).data();
    expect(review?.rating).toBe(5);
    // Імʼя збережено на момент відгуку — щоб не читати чужі картки при показі.
    expect(review?.studentName).toBe("Марко Кравець");
  });

  it("повторне надсилання редагує відгук, а не додає другий", async () => {
    await seedTutor();
    await seedEnrollment("done");

    await submitReview({ studentUserId: STUDENT, tutorId: TUTOR, rating: 5, text: "" });
    await submitReview({ studentUserId: STUDENT, tutorId: TUTOR, rating: 3, text: "" });

    const reviews = await db.collection("reviews").get();
    expect(reviews.size).toBe(1);

    expect(await rating()).toEqual({
      ratingAvg: 3,
      ratingCount: 1,
      ratingSum: 3,
    });
  });

  it("дата створення при редагуванні не змінюється", async () => {
    await seedTutor();
    await seedEnrollment("done");

    await submitReview({ studentUserId: STUDENT, tutorId: TUTOR, rating: 5, text: "" });
    const first = (await db.doc(`reviews/${TUTOR}__${STUDENT}`).get()).get(
      "createdAt"
    );

    await submitReview({ studentUserId: STUDENT, tutorId: TUTOR, rating: 4, text: "" });
    const after = await db.doc(`reviews/${TUTOR}__${STUDENT}`).get();

    expect(after.get("createdAt")).toBe(first);
    expect(after.get("updatedAt")).not.toBe(first);
  });

  it("двоє учнів дають середнє", async () => {
    await seedTutor();
    await seedEnrollment("done");

    // Другий учень зі своїм звʼязком і проведеним уроком.
    await db.doc(`students/${TUTOR}__petro`).set({
      tutorId: TUTOR,
      studentUid: "petro",
      parentUids: [],
      name: "Петро",
      languages: [],
      currentLevel: null,
      goalLevel: null,
      goalText: "",
      totalNewWords: 0,
      lessonsCount: 0,
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    await db.doc(`students/${TUTOR}__petro/lessons/l1`).set({
      slotStart: "2026-09-07T15:00:00.000Z",
      durationMin: 60,
      status: "done",
      bookingId: "b2",
      report: null,
      createdAt: "2026-09-01T10:00:00.000Z",
    });

    await submitReview({ studentUserId: STUDENT, tutorId: TUTOR, rating: 5, text: "" });
    await submitReview({ studentUserId: "petro", tutorId: TUTOR, rating: 4, text: "" });

    expect(await rating()).toEqual({
      ratingAvg: 4.5,
      ratingCount: 2,
      ratingSum: 9,
    });

    const lessons = await db.collection(`students/${TUTOR}__petro/lessons`).get();
    await Promise.all(lessons.docs.map((d) => d.ref.delete()));
    await db.doc(`students/${TUTOR}__petro`).delete();
  });
});
