import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { reviewId, type Review, type ReviewWithId } from "@/lib/review";

/**
 * Відгуки читаються публічно — це частина вітрини, гість має бачити їх до
 * реєстрації. Пише лише сервер: право на відгук дає проведений урок.
 */

export function subscribeTutorReviews(
  tutorId: string,
  onChange: (reviews: ReviewWithId[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "reviews"),
      where("tutorId", "==", tutorId),
      orderBy("updatedAt", "desc"),
      limit(50)
    ),
    (snapshot) => {
      onChange(
        snapshot.docs.map((snap) => ({
          id: snap.id,
          ...(snap.data() as Review),
        }))
      );
    },
    onError
  );
}

/** Власний відгук учня — щоб форма відкривалася вже заповненою. */
export function subscribeMyReview(
  tutorId: string,
  studentUserId: string,
  onChange: (review: ReviewWithId | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "reviews", reviewId(tutorId, studentUserId)),
    (snap) => {
      onChange(
        snap.exists() ? { id: snap.id, ...(snap.data() as Review) } : null
      );
    },
    onError
  );
}

export async function submitReviewRequest(
  idToken: string,
  input: { tutorId: string; rating: number; text: string }
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return response.ok
    ? { ok: true }
    : { ok: false, error: data.error ?? "Не вдалося зберегти відгук." };
}
