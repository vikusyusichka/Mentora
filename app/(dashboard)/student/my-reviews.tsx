"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_RATING, MIN_RATING, type ReviewWithId } from "@/lib/review";
import {
  submitReviewRequest,
  subscribeMyReview,
} from "@/lib/firebase/review-repo";
import { getPublicTutorProfile } from "@/lib/firebase/tutor-profile-repo";
import { useEnrollments } from "@/lib/hooks/use-enrollments";
import { useAuth } from "@/lib/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Відгук про репетитора.
 *
 * Показуємо лише коли є навчальний звʼязок: право на відгук дає
 * проведений урок, і сервер перевіряє це ще раз. Відгук один на
 * репетитора — повторне надсилання редагує наявний.
 */
export function MyReviews() {
  const { enrollments } = useEnrollments("student");
  const enrollment = enrollments?.[0];

  if (enrollments === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо…
      </p>
    );
  }

  if (!enrollment) {
    return (
      <p className="text-body-md text-muted-foreground">
        Відгук можна лишити після проведеного уроку.
      </p>
    );
  }

  return <ReviewForm tutorId={enrollment.tutorId} />;
}

function ReviewForm({ tutorId }: { tutorId: string }) {
  const { user } = useAuth();
  const [existing, setExisting] = useState<ReviewWithId | null | "loading">(
    "loading"
  );

  useEffect(() => {
    if (!user) return;
    return subscribeMyReview(
      tutorId,
      user.uid,
      (review) => setExisting(review),
      (err) => {
        console.error("[reviews] mine", err);
        setExisting(null);
      }
    );
  }, [tutorId, user]);

  if (existing === "loading") {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо…
      </p>
    );
  }

  // Поля монтуються вже із збереженим відгуком у початковому стані.
  // Далі це чернетка користувача: підписка може оновити документ будь-коли,
  // і затирати нею недописаний текст не можна.
  return <ReviewFields tutorId={tutorId} existing={existing} />;
}

function ReviewFields({
  tutorId,
  existing,
}: {
  tutorId: string;
  existing: ReviewWithId | null;
}) {
  const { user } = useAuth();
  const [tutorName, setTutorName] = useState("репетитора");
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicTutorProfile(tutorId).then((profile) => {
      if (!cancelled && profile) setTutorName(profile.displayName);
    });
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  async function submit() {
    if (!user) return;
    if (rating < MIN_RATING) {
      toast.error("Поставте оцінку від 1 до 5.");
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const result = await submitReviewRequest(token, { tutorId, rating, text });
      if (!result.ok) {
        toast.error(result.error ?? "Не вдалося зберегти відгук.");
        return;
      }
      toast.success(existing ? "Відгук оновлено." : "Дякуємо за відгук!");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося звʼязатися з сервером.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <p className="text-body-md text-muted-foreground">
        Як пройшли заняття з {tutorName}? Відгук бачитимуть інші учні
        в каталозі.
      </p>

      <div className="space-y-2">
        <span className="text-label-md block text-muted-foreground">Оцінка</span>
        <div className="flex gap-1" role="group" aria-label="Оцінка">
          {Array.from({ length: MAX_RATING }, (_, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} з ${MAX_RATING}`}
                aria-pressed={rating === value}
                onClick={() => setRating(value)}
                className="rounded-full p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/40"
              >
                <Star
                  className={cn(
                    "size-7",
                    value <= rating ? "fill-gold text-gold" : "text-outline/40"
                  )}
                  strokeWidth={2}
                />
              </button>
            );
          })}
          {rating > 0 && (
            <span className="text-label-md ml-2 self-center text-secondary">
              {rating} з {MAX_RATING}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-text">Коментар (необовʼязково)</Label>
        <Textarea
          id="review-text"
          rows={3}
          placeholder="Що сподобалось, що варто знати іншим"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <Button
        size="lg"
        className="rounded-full"
        onClick={submit}
        disabled={saving}
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        {existing ? "Оновити відгук" : "Лишити відгук"}
      </Button>
    </div>
  );
}
