import type { Currency } from "@/lib/tutor-profile";

/**
 * Бронювання слоту (Блок B.2).
 *
 * Клієнт ніколи не пише в `bookings` — ані статус, ані суми. Броню створює
 * серверний роут через Admin SDK, а Security Rules дають клієнтові лише
 * читання власних записів. Це та сама модель, що й для ролей: джерело
 * істини — сервер, клієнт лише відображає.
 */

export const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "declined",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Очікує оплати",
  confirmed: "Підтверджено",
  declined: "Відхилено",
  cancelled: "Скасовано",
};

/**
 * Скільки слот тримається за учнем до оплати.
 *
 * Прострочені брони не прибирає жоден фоновий процес — Cloud Scheduler
 * потребує платного плану. Замість цього прострочення враховується там,
 * де воно має значення: слот із протухлим утриманням знову вважається
 * вільним і його можна забронювати поверх.
 */
export const BOOKING_HOLD_MINUTES = 20;

/**
 * Комісія платформи — 5% від суми уроку.
 *
 * Ставку затвердив автор проєкту. Живе однією константою, бо крім
 * розрахунку броні знадобиться ще й при розщепленні платежу (Блок B.3):
 * два місця з різними числами розійшлися б рано чи пізно.
 */
export const PLATFORM_FEE_RATE = 0.05;

export function platformFeeFor(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_RATE);
}

export interface Booking {
  studentUserId: string;
  tutorId: string;
  /** Момент початку в UTC (ISO) — той самий формат, що й у розкладі. */
  slotStart: string;
  durationMin: number;
  isTrial: boolean;
  status: BookingStatus;
  amount: number;
  currency: Currency;
  platformFee: number;
  paymentId: string | null;
  createdAt: string;
  /** Доки слот утримується за учнем; `null` після підтвердження. */
  holdUntil: string | null;
}

export interface BookingWithId extends Booking {
  id: string;
}

/**
 * Ідентифікатор замка слоту — мілісекунди епохи.
 *
 * Саме детермінованість тут і захищає від подвійного бронювання: два
 * одночасні запити на той самий слот б'ються за один документ, і
 * транзакція пропускає лише перший.
 */
export function slotLockId(slotStartIso: string): string {
  return String(Date.parse(slotStartIso));
}

/** Чи ще діє утримання слоту. Прострочене утримання слот не займає. */
export function holdIsActive(
  lock: { status: BookingStatus; holdUntil: string | null },
  now: Date = new Date()
): boolean {
  if (lock.status === "confirmed") return true;
  if (lock.status !== "pending_payment") return false;
  return lock.holdUntil !== null && Date.parse(lock.holdUntil) > now.getTime();
}

/**
 * Публічна проєкція зайнятості: жодних персональних даних, лише «зайнято».
 *
 * Потрібна саме як окрема колекція: самі `bookings` читають лише учасники,
 * а гість має бачити, що слот уже не вільний — інакше він обирав би час,
 * який усе одно відхилить сервер.
 */
export interface BusySlot {
  bookingId: string;
  status: BookingStatus;
  holdUntil: string | null;
  /** Дублює ідентифікатор документа, щоб фільтрувати діапазоном по полю. */
  slotStart: string;
}
