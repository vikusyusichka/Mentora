import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { enrollmentId } from "@/lib/enrollment";
import {
  applyRating,
  reviewId,
  type Review,
} from "@/lib/review";
import type { TutorProfile } from "@/lib/tutor-profile";

/**
 * Відгуки (Блок D.1).
 *
 * Серверна операція з двох причин. Перша — право: відгук можна лишити
 * лише репетитору, у якого справді був проведений урок, і перевірити це
 * з клієнта неможливо. Друга — рейтинг: `ratingAvg` визначає позицію в
 * каталозі, тож рахувати його має той самий код, що пише відгук, і в
 * одній транзакції з ним.
 */

export type ReviewFailure = "no-lessons" | "tutor-not-found";

export class ReviewError extends Error {
  constructor(readonly reason: ReviewFailure) {
    super(reason);
  }
}

export const REVIEW_ERROR_MESSAGES: Record<ReviewFailure, string> = {
  "no-lessons":
    "Відгук можна лишити після проведеного уроку з цим репетитором.",
  "tutor-not-found": "Репетитора не знайдено.",
};

export async function submitReview({
  studentUserId,
  tutorId,
  rating,
  text,
}: {
  studentUserId: string;
  tutorId: string;
  rating: number;
  text: string;
}): Promise<{ reviewId: string }> {
  const db = adminDb();

  const enrollment = enrollmentId(tutorId, studentUserId);
  const [profileSnap, doneLessons, userSnap] = await Promise.all([
    db.doc(`tutorProfiles/${tutorId}`).get(),
    db
      .collection(`students/${enrollment}/lessons`)
      .where("status", "==", "done")
      .limit(1)
      .get(),
    db.doc(`users/${studentUserId}`).get(),
  ]);

  if (!profileSnap.exists) throw new ReviewError("tutor-not-found");

  // Право на відгук дає факт проведеного уроку, а не бронь чи оплата:
  // інакше можна було б оцінити репетитора, у якого ще не вчився.
  if (doneLessons.empty) throw new ReviewError("no-lessons");

  const id = reviewId(tutorId, studentUserId);
  const reviewRef = db.doc(`reviews/${id}`);
  const profileRef = db.doc(`tutorProfiles/${tutorId}`);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const [existingSnap, currentProfileSnap] = await Promise.all([
      tx.get(reviewRef),
      tx.get(profileRef),
    ]);

    const existing = existingSnap.exists
      ? (existingSnap.data() as Review)
      : null;
    const profile = currentProfileSnap.data() as TutorProfile & {
      ratingSum?: number;
    };

    const next = applyRating(
      { ratingSum: profile.ratingSum, ratingCount: profile.ratingCount ?? 0 },
      rating,
      existing ? existing.rating : null
    );

    const review: Review = {
      tutorId,
      studentUserId,
      studentName:
        (userSnap.get("displayName") as string | undefined) ||
        (userSnap.get("email") as string | undefined) ||
        "Учень",
      rating,
      text,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    tx.set(reviewRef, review);
    // Поля перелічені явно: типізація `update()` в Admin SDK не приймає
    // іменований інтерфейс без індексної сигнатури.
    tx.update(profileRef, {
      ratingSum: next.ratingSum,
      ratingCount: next.ratingCount,
      ratingAvg: next.ratingAvg,
    });
  });

  return { reviewId: id };
}
