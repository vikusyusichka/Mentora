"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { StarRating } from "@/components/reviews/star-rating";
import { subscribeTutorReviews } from "@/lib/firebase/review-repo";
import type { ReviewWithId } from "@/lib/review";

/**
 * Відгуки на публічній сторінці репетитора.
 *
 * Підписка, а не разове читання: щойно учень лишив відгук, він зʼявляється
 * і на відкритій сторінці — без перезавантаження.
 */
export function ReviewList({ tutorId }: { tutorId: string }) {
  const [reviews, setReviews] = useState<ReviewWithId[] | null>(null);

  useEffect(
    () =>
      subscribeTutorReviews(tutorId, setReviews, (err) => {
        console.error("[reviews]", err);
        setReviews([]);
      }),
    [tutorId]
  );

  if (reviews === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо…
      </p>
    );
  }

  if (reviews.length === 0) {
    return (
      <p className="text-body-md text-muted-foreground">
        Відгуків ще немає. Їх лишають учні після проведених уроків.
      </p>
    );
  }

  const formatter = new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <ul className="space-y-4">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-input border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-label-md text-secondary">
              {review.studentName}
            </span>
            <span className="flex items-center gap-2">
              <StarRating rating={review.rating} size="sm" />
              <span className="text-label-sm text-outline">
                {formatter.format(new Date(review.updatedAt))}
              </span>
            </span>
          </div>

          {review.text && (
            <p className="text-body-md mt-2 whitespace-pre-line text-muted-foreground">
              {review.text}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
