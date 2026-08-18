/**
 * Відгуки й рейтинг репетитора (Блок D.1).
 *
 * Рейтинг — це те, за чим учні обирають репетитора, тож він рахується
 * виключно сервером: поля `ratingAvg`, `ratingCount` і `ratingSum`
 * Security Rules закривають від клієнта ще з блоку A.1.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export interface Review {
  tutorId: string;
  studentUserId: string;
  /** Імʼя на момент відгуку: у відгуках воно не оновлюється заднім числом. */
  studentName: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewWithId extends Review {
  id: string;
}

/**
 * Ідентифікатор відгуку — пара «репетитор + учень».
 *
 * Саме детермінованість не дає лишити два відгуки одному репетитору:
 * повторне надсилання не додає новий запис, а редагує наявний.
 */
export function reviewId(tutorId: string, studentUserId: string): string {
  return `${tutorId}__${studentUserId}`;
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

export interface RatingState {
  ratingSum: number;
  ratingCount: number;
  ratingAvg: number;
}

/**
 * Новий стан рейтингу після відгуку.
 *
 * Тримаємо суму, а не лише середнє: перераховувати середнє з попереднього
 * середнього означало б накопичувати похибку округлення з кожним відгуком.
 * `previousRating` задано — відгук редагують, і кількість не змінюється.
 */
export function applyRating(
  current: { ratingSum?: number; ratingCount: number },
  rating: number,
  previousRating: number | null
): RatingState {
  const sum = current.ratingSum ?? 0;
  const count = current.ratingCount ?? 0;

  const nextSum = previousRating === null ? sum + rating : sum - previousRating + rating;
  const nextCount = previousRating === null ? count + 1 : count;

  return {
    ratingSum: nextSum,
    ratingCount: nextCount,
    // Округлення до сотих: зберігати «4.333333333333333» немає сенсу,
    // а показуємо все одно з одним знаком.
    ratingAvg: nextCount === 0 ? 0 : Math.round((nextSum / nextCount) * 100) / 100,
  };
}
