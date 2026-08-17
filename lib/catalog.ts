/**
 * Публічний каталог репетиторів (Блок A.2).
 *
 * Модуль свідомо ізоморфний: тими самими функціями сторінка рендериться на
 * сервері (SSR, щоб її індексував Google) і догортається в браузері
 * («Показати ще»). Один будівник запиту — отже, серверна й клієнтська
 * видача не можуть розійтися.
 */
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  CEFR_LEVELS,
  CURRENCIES,
  LANGUAGES,
  type CefrLevel,
  type Currency,
  type Language,
  type LessonFormat,
  type TutorProfile,
} from "@/lib/tutor-profile";

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
function catalogTag({ language, level, format }: TagParts): string | null {
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

// ── Фільтри ───────────────────────────────────────────────────────────

export interface CatalogFilters {
  language?: Language;
  level?: CefrLevel;
  format?: CatalogFormat;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Діє лише разом із межами ціни — див. `priceCurrency()`. */
  currency?: Currency;
}

/** Назви параметрів в URL. Короткі — посилання на каталог люди шлють одне одному. */
const PARAM = {
  language: "lang",
  level: "level",
  format: "format",
  city: "city",
  minPrice: "min",
  maxPrice: "max",
  currency: "cur",
} as const;

type RawParams = Record<string, string | string[] | undefined>;

function one(raw: RawParams, key: string): string | undefined {
  const value = raw[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

function oneOf<T extends string>(
  raw: RawParams,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = one(raw, key);
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function positiveNumber(raw: RawParams, key: string): number | undefined {
  const value = Number(one(raw, key));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Розбирає `searchParams` у фільтри. Усе невідоме мовчки відкидається:
 * URL приходить ззовні, і будь-яке сміття в ньому не має валити сторінку.
 */
export function parseCatalogFilters(raw: RawParams): CatalogFilters {
  return {
    language: oneOf(raw, PARAM.language, LANGUAGES),
    level: oneOf(raw, PARAM.level, CEFR_LEVELS),
    format: oneOf(raw, PARAM.format, CATALOG_FORMATS),
    city: one(raw, PARAM.city),
    minPrice: positiveNumber(raw, PARAM.minPrice),
    maxPrice: positiveNumber(raw, PARAM.maxPrice),
    currency: oneOf(raw, PARAM.currency, CURRENCIES),
  };
}

/** Зворотне перетворення — для посилань і для `router.replace`. */
export function catalogSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  };

  set(PARAM.language, filters.language);
  set(PARAM.level, filters.level);
  set(PARAM.format, filters.format);
  set(PARAM.city, filters.city?.trim());
  set(PARAM.minPrice, filters.minPrice);
  set(PARAM.maxPrice, filters.maxPrice);
  // Валюта без меж ціни нічого не означає — і в URL її тоді не тримаємо.
  if (hasPriceBound(filters)) set(PARAM.currency, filters.currency);

  return params;
}

function hasPriceBound(filters: CatalogFilters): boolean {
  return filters.minPrice !== undefined || filters.maxPrice !== undefined;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return catalogSearchParams(filters).size > 0;
}

/**
 * Валюта, у якій рахується діапазон ціни.
 *
 * Порівнювати 500 ₴ і 500 $ безглуздо, тому межі ціни завжди звужені до
 * однієї валюти. Поки жодної межі не задано — обмеження немає взагалі,
 * і в каталозі видно всіх незалежно від валюти.
 */
export function priceCurrency(filters: CatalogFilters): Currency | null {
  if (!hasPriceBound(filters)) return null;
  return filters.currency ?? "UAH";
}

// ── Запит ─────────────────────────────────────────────────────────────

export const CATALOG_PAGE_SIZE = 12;

export interface CatalogItem extends TutorProfile {
  id: string;
}

/**
 * Курсор пагінації — значення полів сортування, а не снапшот документа.
 * Так його можна віддати з сервера в браузер звичайним JSON і продовжити
 * гортання без повторного читання останнього документа.
 */
export interface CatalogCursor {
  price: number;
  id: string;
}

export interface CatalogPage {
  items: CatalogItem[];
  /** `null` — сторінка остання. */
  cursor: CatalogCursor | null;
}

/**
 * Читає одну сторінку каталогу.
 *
 * `where("isPublished","==",true)` тут не косметика: Security Rules
 * відхиляють будь-який list-запит без цього фільтра, бо інакше гість міг би
 * зачепити чужі чернетки.
 */
export async function fetchCatalogPage(
  filters: CatalogFilters,
  cursor?: CatalogCursor | null
): Promise<CatalogPage> {
  const constraints: QueryConstraint[] = [where("isPublished", "==", true)];

  const cityKey = cityKeyOf(filters.city);
  if (cityKey) constraints.push(where("cityKey", "==", cityKey));

  const currency = priceCurrency(filters);
  if (currency) constraints.push(where("currency", "==", currency));

  const tag = catalogTag(filters);
  if (tag) constraints.push(where("filterTags", "array-contains", tag));

  if (filters.minPrice !== undefined) {
    constraints.push(where("pricePerLesson", ">=", filters.minPrice));
  }
  if (filters.maxPrice !== undefined) {
    constraints.push(where("pricePerLesson", "<=", filters.maxPrice));
  }

  // Сортування за ціною — не примха: діапазон ціни це inequality-фільтр,
  // а Firestore вимагає, щоб перший orderBy збігався з його полем.
  // Другим ключем іде id — без нього курсор неоднозначний на однакових цінах.
  constraints.push(orderBy("pricePerLesson", "asc"), orderBy(documentId(), "asc"));

  if (cursor) constraints.push(startAfter(cursor.price, cursor.id));

  // Беремо на один більше, ніж показуємо: зайвий документ — це відповідь
  // на питання «чи є ще сторінка», без окремого count-запиту.
  constraints.push(limit(CATALOG_PAGE_SIZE + 1));

  const snapshot = await getDocs(
    query(collection(db, "tutorProfiles"), ...constraints)
  );

  const hasMore = snapshot.docs.length > CATALOG_PAGE_SIZE;
  const items = snapshot.docs.slice(0, CATALOG_PAGE_SIZE).map((snap) => ({
    id: snap.id,
    ...(snap.data() as TutorProfile),
  }));

  const last = items.at(-1);
  return {
    items,
    cursor: hasMore && last ? { price: last.pricePerLesson, id: last.id } : null,
  };
}

/**
 * Ідентифікатори опублікованих профілів — для sitemap.
 * Без orderBy: типового індексу за `isPublished` вистачає, документи й так
 * приходять упорядкованими за id. Ліміт свідомий — sitemap не має
 * перетворюватись на вивантаження всієї колекції.
 */
export async function fetchPublishedTutorIds(max = 1000): Promise<string[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "tutorProfiles"),
      where("isPublished", "==", true),
      limit(max)
    )
  );
  return snapshot.docs.map((snap) => snap.id);
}
