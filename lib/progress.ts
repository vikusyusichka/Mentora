import { CEFR_LEVELS, type CefrLevel } from "@/lib/tutor-profile";
import type { LessonWithId } from "@/lib/enrollment";

/**
 * Прогрес учня (Блок C.3) — чиста арифметика, без Firebase й React.
 * Винесена окремо, щоб покриватися тестами без емуляторів.
 */

export interface ProgressSummary {
  /** Скільки шляху пройдено від поточного рівня до цільового, 0–100. */
  percent: number;
  currentLevel: CefrLevel | null;
  goalLevel: CefrLevel | null;
  /** Скільки рівнів лишилось; `null`, якщо ціль не задана. */
  levelsLeft: number | null;
}

/**
 * Прогрес рахується від A1, а не від рівня на старті навчання.
 *
 * Так шкала не «стрибає» назад, коли репетитор виправляє поточний рівень
 * учневі вниз, і учень бачить свій рівень на всій шкалі CEFR, а не всередині
 * довільно обраного відрізка.
 */
export function progressSummary(
  currentLevel: CefrLevel | null,
  goalLevel: CefrLevel | null
): ProgressSummary {
  const current = currentLevel ? CEFR_LEVELS.indexOf(currentLevel) : -1;
  const goal = goalLevel ? CEFR_LEVELS.indexOf(goalLevel) : -1;

  if (current < 0 || goal < 0 || goal <= 0) {
    return { percent: 0, currentLevel, goalLevel, levelsLeft: null };
  }

  // Ціль нижча за поточний рівень — вважаємо досягнутою, а не відʼємною.
  const percent = Math.min(100, Math.max(0, Math.round((current / goal) * 100)));

  return {
    percent,
    currentLevel,
    goalLevel,
    levelsLeft: Math.max(0, goal - current),
  };
}

export interface LessonPoint {
  /** Момент уроку в UTC (ISO) — форматується при показі. */
  slotStart: string;
  newWords: number;
  speakingPractice: boolean;
}

/**
 * Ряд для графіка: лише уроки зі звітом, у хронологічному порядку.
 * Урок без звіту не «нульовий результат», а невідомість — його не малюємо.
 */
export function lessonSeries(
  lessons: readonly LessonWithId[],
  max = 12
): LessonPoint[] {
  return lessons
    .filter((lesson) => lesson.report !== null)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
    .slice(-max)
    .map((lesson) => ({
      slotStart: lesson.slotStart,
      newWords: lesson.report?.newWordsCount ?? 0,
      speakingPractice: lesson.report?.speakingPractice ?? false,
    }));
}

export interface PracticeStats {
  lessonsWithReport: number;
  practiceLessons: number;
  /** Частка уроків із розмовною практикою, 0–100. */
  practiceShare: number;
  averageNewWords: number;
}

export function practiceStats(points: readonly LessonPoint[]): PracticeStats {
  if (points.length === 0) {
    return {
      lessonsWithReport: 0,
      practiceLessons: 0,
      practiceShare: 0,
      averageNewWords: 0,
    };
  }

  const practiceLessons = points.filter((p) => p.speakingPractice).length;
  const words = points.reduce((sum, p) => sum + p.newWords, 0);

  return {
    lessonsWithReport: points.length,
    practiceLessons,
    practiceShare: Math.round((practiceLessons / points.length) * 100),
    averageNewWords: Math.round(words / points.length),
  };
}

/**
 * Чи є сенс малювати графік.
 *
 * На одному-двох уроках стовпчикова діаграма не показує ані тренду, ані
 * порівняння — самі цифри інформативніші. Тому нижче цього порогу
 * показуємо лише підсумки.
 */
export const MIN_POINTS_FOR_CHART = 3;

export function worthCharting(points: readonly LessonPoint[]): boolean {
  return points.length >= MIN_POINTS_FOR_CHART;
}
