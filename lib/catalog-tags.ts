import type {
  CefrLevel,
  Language,
  LessonFormat,
} from "@/lib/tutor-profile";

/**
 * Чиста частина каталогу: формати, теги фільтрів, нормалізація міста.
 *
 * Винесена окремо від `lib/catalog.ts` тому, що той тягне за собою
 * Firebase SDK. Ця ж логіка потрібна там, де Firebase недоречний —
 * у демо-скрипті `scripts/seed-demo.mjs` і в юніт-тестах без емуляторів.
 */

/**
 * Формат, який шукає гість. Це НЕ те саме, що `TutorProfile.format`:
 * репетитор із форматом `both` має знаходитись і за «онлайн», і за «офлайн».
 */
export const CATALOG_FORMATS = ["online", "offline"] as const;
export type CatalogFormat = (typeof CATALOG_FORMATS)[number];

export const CATALOG_FORMAT_LABELS: Record<CatalogFormat, string> = {
  online: "Онлайн",
  offline: "Офлайн",
};

/** Які формати фактично пропонує репетитор. */
export function offeredFormats(format: LessonFormat): CatalogFormat[] {
  return format === "both" ? ["online", "offline"] : [format];
}

// ── Денормалізація під фільтри ────────────────────────────────────────
//
// Firestore дозволяє лише ОДИН `array-contains` на запит, тож фільтрувати
// одночасно за `languages` і `levelsTaught` неможливо. Тому при збереженні
// профілю розкладаємо мову × рівень × формат у плаский масив тегів: будь-яка
// комбінація цих трьох фільтрів звужується до одного точного `array-contains`.
//
// Кількість тегів обмежена: (мов+1)·(рівнів+1)·(форматів+1)−1, тобто
// максимум 8·7·3−1 = 167 на профіль.

interface TagParts {
  language?: Language;
  level?: CefrLevel;
  format?: CatalogFormat;
}

/** Канонічний тег. Порядок вимірів фіксований — інакше теги не збігатимуться. */
export function catalogTag({ language, level, format }: TagParts): string | null {
  const parts: string[] = [];
  if (language) parts.push(`l:${language}`);
  if (level) parts.push(`v:${level}`);
  if (format) parts.push(`f:${format}`);
  return parts.length > 0 ? parts.join("~") : null;
}

/** Усі теги профілю — записується у поле `filterTags`. */
export function buildFilterTags(profile: {
  languages: readonly Language[];
  levelsTaught: readonly CefrLevel[];
  format: LessonFormat;
}): string[] {
  // `undefined` у кожному вимірі = «цей фільтр не заданий».
  const languages: (Language | undefined)[] = [undefined, ...profile.languages];
  const levels: (CefrLevel | undefined)[] = [undefined, ...profile.levelsTaught];
  const formats: (CatalogFormat | undefined)[] = [
    undefined,
    ...offeredFormats(profile.format),
  ];

  const tags: string[] = [];
  for (const language of languages) {
    for (const level of levels) {
      for (const format of formats) {
        const tag = catalogTag({ language, level, format });
        if (tag) tags.push(tag);
      }
    }
  }
  return tags;
}

/**
 * Ключ міста для точного збігу. Місто гість вводить руками, тож зводимо
 * до спільного вигляду: без регістру, без кінцевих пробілів і подвійних
 * пробілів усередині. Порожнє місто → `null` (поле в документ не пишемо).
 */
export function cityKeyOf(city: string | undefined | null): string | null {
  const key = city?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  return key.length > 0 ? key : null;
}
