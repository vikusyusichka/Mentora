import { z } from "zod";
import {
  dateKeyInZone,
  formatMinutesOfDay,
  parseTimeOfDay,
  utcToZonedParts,
  zonedTimeToUtc,
} from "@/lib/timezone";

/**
 * Розклад доступності репетитора (Блок B.1).
 *
 * ## Чому тижневий шаблон зберігається НЕ в UTC
 *
 * Репетитор думає «щовівторка о 18:00 за моїм часом». Якщо покласти в базу
 * UTC-час, то після переходу на літній час слот поїде на годину — 18:00
 * у Києві це 16:00 UTC узимку й 15:00 улітку. Тому шаблон зберігається
 * у зоні репетитора (`dayOfWeek` + `startTime`), а UTC зʼявляється лише
 * при розгортанні шаблону на конкретні дати — і саме ці конкретні моменти
 * далі поїдуть у брони й оплати як UTC.
 */

export const LESSON_DURATIONS = [30, 45, 60, 90, 120] as const;
export type LessonDuration = (typeof LESSON_DURATIONS)[number];

export const BUFFER_OPTIONS = [0, 5, 10, 15, 30] as const;

/** Порядок показу: тиждень починається з понеділка, а не з неділі. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Індекс = день тижня за угодою JS (0 — неділя). */
export const WEEKDAY_LABELS = [
  "Неділя",
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "Пʼятниця",
  "Субота",
] as const;

export const WEEKDAY_SHORT = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

export interface WeeklySlot {
  /** 0 — неділя, як у `Date.getUTCDay()`. */
  dayOfWeek: number;
  /** `"HH:mm"` у таймзоні репетитора. */
  startTime: string;
  durationMin: number;
}

export interface Availability {
  weeklySlots: WeeklySlot[];
  /** Тривалість, яку підставляємо новим слотам. */
  lessonDurationMin: number;
  /** Мінімальна пауза між уроками. */
  bufferMin: number;
}

/** Виняток на конкретну дату (ключ документа — `YYYY-MM-DD` у зоні репетитора). */
export interface SlotException {
  /** UTC-моменти слотів шаблону, які цього дня не діють. */
  blocked: string[];
  /** Разові слоти понад шаблон. */
  extra: { start: string; durationMin: number }[];
}

export const EMPTY_AVAILABILITY: Availability = {
  weeklySlots: [],
  lessonDurationMin: 60,
  bufferMin: 15,
};

export const weeklySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().refine((v) => parseTimeOfDay(v) !== null, "Час у форматі 18:00"),
  durationMin: z.number().int().positive().max(600),
});

export const availabilitySchema = z.object({
  weeklySlots: z.array(weeklySlotSchema).max(200, "Забагато слотів"),
  lessonDurationMin: z.number().int().positive().max(600),
  bufferMin: z.number().int().min(0).max(240),
});

// ── Перевірки шаблону ─────────────────────────────────────────────────

export interface SlotConflict {
  dayOfWeek: number;
  message: string;
}

/**
 * Слоти одного дня не мають перетинатися й мають лишати паузу між уроками.
 * Перевірка тут, а не в Security Rules: правила не вміють сортувати масив,
 * а перетин слотів — питання зручності, не безпеки.
 */
export function findConflicts(
  slots: readonly WeeklySlot[],
  bufferMin: number
): SlotConflict[] {
  const conflicts: SlotConflict[] = [];

  for (const dayOfWeek of WEEK_ORDER) {
    const ofDay = slots
      .filter((s) => s.dayOfWeek === dayOfWeek)
      .map((s) => ({ ...s, start: parseTimeOfDay(s.startTime) ?? 0 }))
      .sort((a, b) => a.start - b.start);

    for (let i = 1; i < ofDay.length; i += 1) {
      const prev = ofDay[i - 1];
      const current = ofDay[i];
      const prevEnd = prev.start + prev.durationMin;

      if (current.start < prevEnd) {
        conflicts.push({
          dayOfWeek,
          message: `${prev.startTime} і ${current.startTime} перетинаються`,
        });
      } else if (current.start < prevEnd + bufferMin) {
        conflicts.push({
          dayOfWeek,
          message: `між ${prev.startTime} і ${current.startTime} менше ніж ${bufferMin} хв перерви`,
        });
      }
    }
  }

  return conflicts;
}

export function sortWeeklySlots(slots: readonly WeeklySlot[]): WeeklySlot[] {
  return [...slots].sort((a, b) => {
    const dayDiff =
      WEEK_ORDER.indexOf(a.dayOfWeek as (typeof WEEK_ORDER)[number]) -
      WEEK_ORDER.indexOf(b.dayOfWeek as (typeof WEEK_ORDER)[number]);
    if (dayDiff !== 0) return dayDiff;
    return (parseTimeOfDay(a.startTime) ?? 0) - (parseTimeOfDay(b.startTime) ?? 0);
  });
}

export function slotEndLabel(slot: WeeklySlot): string {
  const start = parseTimeOfDay(slot.startTime) ?? 0;
  return formatMinutesOfDay(start + slot.durationMin);
}

// ── Розгортання шаблону на конкретні дати ─────────────────────────────

export interface MaterializedSlot {
  /** Момент початку в UTC (ISO). Єдина форма, однакова для всіх глядачів. */
  startUtc: string;
  durationMin: number;
  source: "weekly" | "extra";
}

/** Додає дні до календарної дати, не чіпаючи час — тому арифметика точна. */
function addDays(
  date: { year: number; month: number; day: number },
  days: number
) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Перетворює тижневий шаблон і винятки на конкретні слоти:
 * шаблон − заблоковані + разові, усе в UTC, уже без минулого.
 */
export function materializeSlots({
  availability,
  exceptions,
  timezone,
  from,
  days,
}: {
  availability: Availability;
  /** Ключ — дата `YYYY-MM-DD` у зоні репетитора. */
  exceptions: Record<string, SlotException>;
  timezone: string;
  from: Date;
  days: number;
}): MaterializedSlot[] {
  const startDate = utcToZonedParts(from, timezone);
  const result: MaterializedSlot[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(startDate, offset);
    const key = `${date.year}-${String(date.month).padStart(2, "0")}-${String(
      date.day
    ).padStart(2, "0")}`;
    const exception = exceptions[key];
    const blocked = new Set(exception?.blocked ?? []);

    for (const slot of availability.weeklySlots) {
      if (slot.dayOfWeek !== date.weekday) continue;
      const minutes = parseTimeOfDay(slot.startTime);
      if (minutes === null) continue;

      const startUtc = zonedTimeToUtc(
        {
          year: date.year,
          month: date.month,
          day: date.day,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
        },
        timezone
      ).toISOString();

      if (blocked.has(startUtc)) continue;
      result.push({ startUtc, durationMin: slot.durationMin, source: "weekly" });
    }

    for (const extra of exception?.extra ?? []) {
      result.push({
        startUtc: extra.start,
        durationMin: extra.durationMin,
        source: "extra",
      });
    }
  }

  const fromMs = from.getTime();
  return result
    .filter((slot) => Date.parse(slot.startUtc) >= fromMs)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

/** Групування для показу: ключі — дати в зоні ГЛЯДАЧА, не репетитора. */
export function groupByViewerDate(
  slots: readonly MaterializedSlot[],
  viewerTimeZone: string
): { dateKey: string; slots: MaterializedSlot[] }[] {
  const groups = new Map<string, MaterializedSlot[]>();

  for (const slot of slots) {
    const key = dateKeyInZone(new Date(slot.startUtc), viewerTimeZone);
    const bucket = groups.get(key);
    if (bucket) bucket.push(slot);
    else groups.set(key, [slot]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, group]) => ({ dateKey, slots: group }));
}
