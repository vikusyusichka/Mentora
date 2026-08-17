import type { Currency } from "@/lib/tutor-profile";

/**
 * Платежі (Блок B.3) — чиста доменна частина, без SDK провайдера.
 * Виділена окремо, щоб її можна було покрити тестами без мережі й ключів.
 */

export const PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["stripe", "wayforpay"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export interface Payment {
  bookingId: string;
  provider: PaymentProviderId;
  /** Ідентифікатор платежу на боці провайдера. */
  providerRef: string;
  studentUserId: string;
  tutorId: string;
  amount: number;
  currency: Currency;
  platformFee: number;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Кількість мінорних одиниць у гривні, доларі та євро — сто.
 *
 * Stripe приймає суми цілими в мінорних одиницях, і це не дрібниця:
 * передати 480 замість 48000 означає списати 4.80 замість 480.
 * Для валют без копійок (JPY, KRW) множник був би 1 — коли такі
 * зʼявляться, це єдине місце, яке доведеться змінити.
 */
const MINOR_UNITS: Record<Currency, number> = {
  UAH: 100,
  USD: 100,
  EUR: 100,
};

export function toMinorUnits(amount: number, currency: Currency): number {
  return Math.round(amount * MINOR_UNITS[currency]);
}

export function fromMinorUnits(minor: number, currency: Currency): number {
  return minor / MINOR_UNITS[currency];
}

/**
 * Скільки з платежу дістається репетитору.
 *
 * Комісія утримується платформою, решта йде на його рахунок у провайдера.
 * Рахуємо відніманням, а не другим множенням на ставку: інакше через
 * округлення сума частин могла б не зійтися з платежем.
 */
export function tutorPayout(amount: number, platformFee: number): number {
  return amount - platformFee;
}
