import type { CefrLevel, Language } from "@/lib/tutor-profile";

/**
 * Enrollment — навчальний звʼязок між репетитором і учнем (Блок B.4).
 *
 * Документ не створюється вручну: він народжується з першої підтвердженої
 * оплати. Це вузол доступу — поля `tutorId`, `studentUid`, `parentUids`
 * керують правилами читання всіх підколекцій.
 */

export interface Enrollment {
  tutorId: string;
  studentUid: string;
  /** Батьки приєднуються за інвайт-кодом (Блок C.4). */
  parentUids: string[];
  name: string;
  languages: Language[];
  currentLevel: CefrLevel | null;
  goalLevel: CefrLevel | null;
  goalText: string;
  /** Денормалізовані лічильники — пише лише сервер. */
  totalNewWords: number;
  lessonsCount: number;
  createdAt: string;
}

export interface EnrollmentWithId extends Enrollment {
  id: string;
}

export const LESSON_STATUSES = ["scheduled", "done", "cancelled"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  scheduled: "Заплановано",
  done: "Проведено",
  cancelled: "Скасовано",
};

export interface LessonReport {
  topic: string;
  newWordsCount: number;
  speakingPractice: boolean;
  noteForStudent: string;
}

export interface Lesson {
  /**
   * Момент початку в UTC (ISO) — той самий формат, що в розкладі й броні.
   *
   * У початковій схемі тут стояли окремі `date` і `time`. Свідомо не так:
   * розділення дати й часу повернуло б неоднозначність таймзон, від якої
   * ми пішли ще в B.1. Локальний час рахується при показі.
   */
  slotStart: string;
  durationMin: number;
  status: LessonStatus;
  bookingId: string | null;
  report: LessonReport | null;
  createdAt: string;
}

export interface LessonWithId extends Lesson {
  id: string;
  enrollmentId: string;
}

/**
 * Ідентифікатор enrollment детермінований — пара «репетитор + учень».
 *
 * Саме це й робить створення ідемпотентним: скільки б разів не прийшло
 * підтвердження оплати, другий навчальний звʼязок для тієї самої пари
 * не зʼявиться.
 */
export function enrollmentId(tutorId: string, studentUid: string): string {
  return `${tutorId}__${studentUid}`;
}

/**
 * Мова, яку припускаємо для нового учня.
 *
 * Якщо репетитор викладає одну мову — вона очевидна. Якщо кілька,
 * вгадувати не беремося: хай заповнить у картці учня.
 */
export function guessLanguages(tutorLanguages: readonly Language[]): Language[] {
  return tutorLanguages.length === 1 ? [tutorLanguages[0]] : [];
}
