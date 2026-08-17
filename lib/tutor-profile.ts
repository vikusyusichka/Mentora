import { z } from "zod";

/** Рівні CEFR — використовуються і в профілі репетитора, і в картці учня. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Мови викладання. Розширюємо за потреби. */
export const LANGUAGES = [
  "Англійська",
  "Німецька",
  "Французька",
  "Іспанська",
  "Італійська",
  "Польська",
  "Українська",
] as const;
export type Language = (typeof LANGUAGES)[number];

export const LESSON_FORMATS = ["online", "offline", "both"] as const;
export type LessonFormat = (typeof LESSON_FORMATS)[number];

export const FORMAT_LABELS: Record<LessonFormat, string> = {
  online: "Онлайн",
  offline: "Офлайн",
  both: "Онлайн і офлайн",
};

export const CURRENCIES = ["UAH", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  UAH: "₴",
  USD: "$",
  EUR: "€",
};

/**
 * Форма профілю репетитора. Поля, які пише лише сервер
 * (ratingAvg, ratingCount, payoutAccountId), тут відсутні свідомо —
 * клієнт їх не надсилає, а Security Rules це підстраховують.
 */
export const tutorProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Вкажіть ім'я (мінімум 2 символи)")
      .max(80, "Занадто довге ім'я"),
    bio: z
      .string()
      .trim()
      .min(40, "Розкажіть про себе — мінімум 40 символів")
      .max(1500, "Максимум 1500 символів"),
    languages: z
      .array(z.enum(LANGUAGES))
      .min(1, "Оберіть хоча б одну мову"),
    levelsTaught: z
      .array(z.enum(CEFR_LEVELS))
      .min(1, "Оберіть хоча б один рівень"),
    pricePerLesson: z
      .number({ invalid_type_error: "Вкажіть ціну числом" })
      .positive("Ціна має бути більшою за нуль")
      .max(100000, "Занадто велика ціна"),
    currency: z.enum(CURRENCIES),
    format: z.enum(LESSON_FORMATS),
    city: z.string().trim().max(80).optional(),
    timezone: z.string().min(1, "Вкажіть часовий пояс"),
    /** 0 = пробного уроку немає; >0 = ціна пробного. */
    trialPrice: z
      .number({ invalid_type_error: "Вкажіть ціну числом" })
      .min(0, "Не може бути відʼємною")
      .max(100000, "Занадто велика ціна"),
    photoURL: z.string().url().or(z.literal("")).optional(),
  })
  // Для офлайн/змішаного формату місто обовʼязкове — інакше учень
  // не зрозуміє, куди приходити, а фільтр по місту не працюватиме.
  .refine((v) => v.format === "online" || !!v.city?.trim(), {
    path: ["city"],
    message: "Для офлайн-занять вкажіть місто",
  });

export type TutorProfileInput = z.infer<typeof tutorProfileSchema>;

/** Документ у Firestore: дані форми + серверні поля. */
export interface TutorProfile extends TutorProfileInput {
  ratingAvg: number;
  ratingCount: number;
  /** Акаунт у платіжного провайдера. Пише лише сервер. */
  payoutAccountId?: string;
  /**
   * У якого саме провайдера цей акаунт. Зберігається поруч, бо ринок у нас
   * і міжнародний, і український: репетитори з різних країн неминуче
   * працюють через різні провайдери. Пише лише сервер.
   */
  payoutProvider?: "stripe" | "wayforpay";
  /** Чи завершив репетитор онбординг і чи може приймати платежі. */
  payoutsEnabled?: boolean;
  isPublished: boolean;
}

export function formatPrice(amount: number, currency: Currency): string {
  return `${amount} ${CURRENCY_SYMBOLS[currency]}`;
}

/** Компактний підпис рівнів: A1–B2 замість перелічування всіх. */
export function levelsRange(levels: readonly CefrLevel[]): string {
  if (levels.length === 0) return "";
  const ordered = CEFR_LEVELS.filter((l) => levels.includes(l));
  if (ordered.length === 1) return ordered[0];
  return `${ordered[0]}–${ordered[ordered.length - 1]}`;
}
