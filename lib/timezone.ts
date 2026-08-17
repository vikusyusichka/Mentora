/**
 * Перетворення між UTC і локальним часом довільної таймзони.
 *
 * Без зовнішніх залежностей — усе рахується через `Intl.DateTimeFormat`,
 * який знає актуальну базу IANA (разом із переходами на літній час).
 */

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  hour: number; // 0–23
  minute: number;
  /** День тижня за угодою JS: 0 = неділя. */
  weekday: number;
}

const PARTS_FORMAT = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = PARTS_FORMAT.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PARTS_FORMAT.set(timeZone, formatter);
  }
  return formatter;
}

/** Розкладає UTC-момент на компоненти локального часу в зоні. */
export function utcToZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const year = get("year");
  const month = get("month");
  const day = get("day");

  return {
    year,
    month,
    day,
    hour: get("hour"),
    minute: get("minute"),
    // Дата вже локальна, тож день тижня беремо з «UTC-двійника» цих чисел.
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/**
 * Зсув зони від UTC у мілісекундах на конкретний момент.
 * Додатний для зон на схід від Гринвіча (Київ улітку → +3 год).
 */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = utcToZonedParts(instant, timeZone);
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const seconds = Number(parts.find((x) => x.type === "second")?.value ?? "0");
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, seconds);
  // Мілісекунди Intl не віддає — прибираємо їх з обох боків.
  return asIfUtc - (instant.getTime() - instant.getMilliseconds());
}

/**
 * Локальний час у зоні → UTC-момент.
 *
 * Рахується у два проходи: перший зсув беремо в припущенні, що числа вже
 * UTC, і виправляємо ним; якщо в новій точці зсув інший (а це рівно те, що
 * стається на межі переходу на літній час) — перераховуємо ще раз.
 */
export function zonedTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
  timeZone: string
): Date {
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );

  const firstGuess = asIfUtc - zoneOffsetMs(new Date(asIfUtc), timeZone);
  const refined = asIfUtc - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(refined);
}

/** `"HH:mm"` у зоні глядача. */
export function formatTimeInZone(instant: Date, timeZone: string): string {
  const { hour, minute } = utcToZonedParts(instant, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Ключ дати `YYYY-MM-DD` у зоні — під документи `slotExceptions`. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  const { year, month, day } = utcToZonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateKey(key: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** `"18:00"` → хвилини від опівночі. `null`, якщо формат не той. */
export function parseTimeOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatMinutesOfDay(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Таймзона браузера; на сервері та за збоїв — київська. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
  } catch {
    return "Europe/Kyiv";
  }
}

/** Чи знає середовище таку зону — вводиться руками у профілі. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
