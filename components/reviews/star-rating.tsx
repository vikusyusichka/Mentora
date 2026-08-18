import { Star } from "lucide-react";

import { MAX_RATING } from "@/lib/review";
import { cn } from "@/lib/utils";

/**
 * Оцінка зірками. Поруч завжди є число — саме воно, а не колір чи форма,
 * лишається читомим за будь-якого зору.
 */
export function StarRating({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  const filled = Math.round(rating);
  const box = size === "sm" ? "size-3.5" : "size-4";

  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Оцінка ${rating} з ${MAX_RATING}`}
    >
      {Array.from({ length: MAX_RATING }, (_, index) => (
        <Star
          key={index}
          className={cn(
            box,
            index < filled ? "fill-gold text-gold" : "text-outline/40"
          )}
          strokeWidth={2}
          aria-hidden
        />
      ))}
    </span>
  );
}
