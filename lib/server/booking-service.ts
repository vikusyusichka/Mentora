import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import {
  materializeSlots,
  type Availability,
  type SlotException,
} from "@/lib/availability";
import {
  BOOKING_HOLD_MINUTES,
  holdIsActive,
  platformFeeFor,
  slotLockId,
  type Booking,
  type BusySlot,
} from "@/lib/booking";
import { dateKeyInZone } from "@/lib/timezone";
import type { TutorProfile } from "@/lib/tutor-profile";

/**
 * Створення броні. Живе на сервері, бо саме тут вирішується все, чому не
 * можна вірити клієнтові: чи слот справді існує в розкладі, чи він ще
 * вільний, скільки коштує урок і яка комісія платформи.
 */

/** Наскільки далеко вперед дозволяємо бронювати. */
const BOOKING_HORIZON_DAYS = 60;

export type BookingFailure =
  | "tutor-not-found"
  | "not-published"
  | "self-booking"
  | "slot-not-available"
  | "slot-taken";

export class BookingError extends Error {
  constructor(readonly reason: BookingFailure) {
    super(reason);
  }
}

export const BOOKING_ERROR_MESSAGES: Record<BookingFailure, string> = {
  "tutor-not-found": "Репетитора не знайдено.",
  "not-published": "Профіль репетитора зараз недоступний.",
  "self-booking": "Не можна забронювати урок у самого себе.",
  "slot-not-available": "Цього часу немає в розкладі репетитора.",
  "slot-taken": "Слот щойно зайняли. Оберіть інший час.",
};

export interface CreateBookingResult {
  bookingId: string;
  booking: Booking;
}

export async function createBooking({
  studentUserId,
  tutorId,
  slotStart,
}: {
  studentUserId: string;
  tutorId: string;
  slotStart: string;
}): Promise<CreateBookingResult> {
  if (studentUserId === tutorId) throw new BookingError("self-booking");

  const db = adminDb();

  const profileSnap = await db.doc(`tutorProfiles/${tutorId}`).get();
  if (!profileSnap.exists) throw new BookingError("tutor-not-found");

  const profile = profileSnap.data() as TutorProfile;
  if (!profile.isPublished) throw new BookingError("not-published");

  const slot = await findSlotInSchedule(tutorId, profile.timezone, slotStart);
  if (!slot) throw new BookingError("slot-not-available");

  const isTrial = profile.trialPrice > 0 && (await isFirstBooking(tutorId, studentUserId));
  const amount = isTrial ? profile.trialPrice : profile.pricePerLesson;

  const now = new Date();
  const booking: Booking = {
    studentUserId,
    tutorId,
    slotStart,
    durationMin: slot.durationMin,
    isTrial,
    status: "pending_payment",
    amount,
    currency: profile.currency,
    platformFee: platformFeeFor(amount),
    paymentId: null,
    createdAt: now.toISOString(),
    holdUntil: new Date(
      now.getTime() + BOOKING_HOLD_MINUTES * 60_000
    ).toISOString(),
  };

  const lockRef = db.doc(
    `tutorProfiles/${tutorId}/busySlots/${slotLockId(slotStart)}`
  );
  const bookingRef = db.collection("bookings").doc();

  // Замок і бронь пишуться однією транзакцією. Ідентифікатор замка
  // детермінований, тож два одночасні бронювання того самого слоту
  // конкурують за один документ — і другий отримує «слот зайнято».
  await db.runTransaction(async (tx) => {
    const lockSnap = await tx.get(lockRef);

    if (lockSnap.exists) {
      const lock = lockSnap.data() as BusySlot;
      if (holdIsActive(lock, now)) throw new BookingError("slot-taken");
    }

    tx.set(bookingRef, booking);
    tx.set(lockRef, {
      bookingId: bookingRef.id,
      status: booking.status,
      holdUntil: booking.holdUntil,
      slotStart: booking.slotStart,
    } satisfies BusySlot);
  });

  return { bookingId: bookingRef.id, booking };
}

/**
 * Чи є такий слот у розкладі. Перевіряємо на сервері: інакше учень міг би
 * надіслати будь-який час і забронювати урок посеред ночі.
 */
async function findSlotInSchedule(
  tutorId: string,
  timezone: string,
  slotStart: string
): Promise<{ durationMin: number } | null> {
  const db = adminDb();
  const now = new Date();
  const until = new Date(now.getTime() + BOOKING_HORIZON_DAYS * 86_400_000);

  const [availabilitySnap, exceptionsSnap] = await Promise.all([
    db.doc(`tutorProfiles/${tutorId}/availability/weekly`).get(),
    db
      .collection(`tutorProfiles/${tutorId}/slotExceptions`)
      .where("__name__", ">=", dateKeyInZone(now, timezone))
      .where("__name__", "<=", dateKeyInZone(until, timezone))
      .get(),
  ]);

  if (!availabilitySnap.exists) return null;

  const exceptions: Record<string, SlotException> = {};
  for (const snap of exceptionsSnap.docs) {
    const data = snap.data() as Partial<SlotException>;
    exceptions[snap.id] = { blocked: data.blocked ?? [], extra: data.extra ?? [] };
  }

  const slots = materializeSlots({
    availability: availabilitySnap.data() as Availability,
    exceptions,
    timezone,
    from: now,
    days: BOOKING_HORIZON_DAYS,
  });

  return slots.find((s) => s.startUtc === slotStart) ?? null;
}

/**
 * Пробний урок — лише на перше заняття з цим репетитором. Скасовані й
 * відхилені брони не рахуються: до уроку так і не дійшло.
 */
async function isFirstBooking(
  tutorId: string,
  studentUserId: string
): Promise<boolean> {
  const existing = await adminDb()
    .collection("bookings")
    .where("tutorId", "==", tutorId)
    .where("studentUserId", "==", studentUserId)
    .where("status", "in", ["pending_payment", "confirmed"])
    .limit(1)
    .get();

  return existing.empty;
}
