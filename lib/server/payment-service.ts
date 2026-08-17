import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import {
  holdIsActive,
  slotLockId,
  type Booking,
  type BookingWithId,
  type BusySlot,
} from "@/lib/booking";
import type { Payment, PaymentProviderId } from "@/lib/payment";
import { providerById } from "@/lib/payments";
import type { PaymentEvent } from "@/lib/payments/provider";
import type { TutorProfile } from "@/lib/tutor-profile";

/**
 * Серверна частина оплати: створення сесії й обробка вебхука.
 *
 * Тут же живе єдине місце, де бронь стає `confirmed`. Клієнт до цього
 * переходу не має жодного стосунку — його ініціює лише підписаний вебхук
 * провайдера.
 */

export type CheckoutFailure =
  | "booking-not-found"
  | "not-your-booking"
  | "wrong-status"
  | "hold-expired"
  | "tutor-cannot-accept";

export class CheckoutError extends Error {
  constructor(readonly reason: CheckoutFailure) {
    super(reason);
  }
}

export const CHECKOUT_ERROR_MESSAGES: Record<CheckoutFailure, string> = {
  "booking-not-found": "Бронь не знайдено.",
  "not-your-booking": "Це не ваша бронь.",
  "wrong-status": "Цю бронь уже оплачено або скасовано.",
  "hold-expired": "Час на оплату вичерпано — забронюйте слот ще раз.",
  "tutor-cannot-accept":
    "Репетитор ще не налаштував отримання платежів. Спробуйте пізніше.",
};

export async function startCheckout({
  bookingId,
  studentUserId,
  origin,
}: {
  bookingId: string;
  studentUserId: string;
  origin: string;
}): Promise<{ url: string }> {
  const db = adminDb();

  const bookingSnap = await db.doc(`bookings/${bookingId}`).get();
  if (!bookingSnap.exists) throw new CheckoutError("booking-not-found");

  const booking = { id: bookingId, ...(bookingSnap.data() as Booking) };
  if (booking.studentUserId !== studentUserId) {
    throw new CheckoutError("not-your-booking");
  }
  if (booking.status !== "pending_payment") {
    throw new CheckoutError("wrong-status");
  }
  if (!holdIsActive(booking)) throw new CheckoutError("hold-expired");

  const profileSnap = await db.doc(`tutorProfiles/${booking.tutorId}`).get();
  const profile = profileSnap.data() as TutorProfile | undefined;

  if (!profile?.payoutAccountId || !profile.payoutProvider) {
    throw new CheckoutError("tutor-cannot-accept");
  }

  const provider = providerById(profile.payoutProvider);
  const session = await provider.createCheckout({
    booking: booking as BookingWithId,
    tutorPayoutAccountId: profile.payoutAccountId,
    successUrl: `${origin}/student?payment=success`,
    cancelUrl: `${origin}/student?payment=cancelled`,
  });

  // Запис платежу з'являється ДО оплати: інакше вебхук міг би прийти
  // раніше, ніж ми взагалі дізналися про існування цієї сесії.
  await writePayment({
    providerRef: session.reference,
    payment: {
      bookingId,
      provider: profile.payoutProvider,
      providerRef: session.reference,
      studentUserId: booking.studentUserId,
      tutorId: booking.tutorId,
      amount: booking.amount,
      currency: booking.currency,
      platformFee: booking.platformFee,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  return { url: session.url };
}

/**
 * Застосовує подію провайдера.
 *
 * Ідемпотентність тримається на двох речах: документ платежу має
 * ідентифікатором `providerRef` (повторна доставка перезаписує той самий
 * запис), а перехід статусу броні захищений перевіркою поточного статусу
 * всередині транзакції.
 */
export async function applyPaymentEvent(
  event: PaymentEvent,
  providerId: PaymentProviderId
): Promise<{ handled: boolean; refundRequired?: string }> {
  if (event.type === "ignored") return { handled: false };

  const db = adminDb();
  const bookingRef = db.doc(`bookings/${event.bookingId}`);
  const paymentRef = db.doc(`payments/${event.providerRef}`);

  if (event.type === "payment.failed") {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) return;
      const booking = snap.data() as Booking;
      if (booking.status !== "pending_payment") return;

      tx.update(bookingRef, { status: "cancelled", holdUntil: null });
      tx.delete(
        db.doc(
          `tutorProfiles/${booking.tutorId}/busySlots/${slotLockId(booking.slotStart)}`
        )
      );
      tx.set(
        paymentRef,
        { status: "failed", updatedAt: new Date().toISOString() },
        { merge: true }
      );
    });
    return { handled: true };
  }

  if (event.type === "payment.refunded") {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) return;
      const booking = snap.data() as Booking;

      tx.update(bookingRef, { status: "cancelled", holdUntil: null });
      tx.delete(
        db.doc(
          `tutorProfiles/${booking.tutorId}/busySlots/${slotLockId(booking.slotStart)}`
        )
      );
      tx.set(
        paymentRef,
        { status: "refunded", updatedAt: new Date().toISOString() },
        { merge: true }
      );
    });
    return { handled: true };
  }

  // payment.succeeded
  let refundRequired: string | undefined;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) return;

    const booking = snap.data() as Booking;

    // Повторна доставка того самого вебхука — бронь уже підтверджена.
    if (booking.status === "confirmed") return;

    if (booking.status !== "pending_payment") {
      // Бронь скасували, а гроші дійшли — повертаємо.
      refundRequired = event.providerRef;
      return;
    }

    const lockRef = db.doc(
      `tutorProfiles/${booking.tutorId}/busySlots/${slotLockId(booking.slotStart)}`
    );
    const lockSnap = await tx.get(lockRef);
    const lock = lockSnap.exists ? (lockSnap.data() as BusySlot) : null;

    // Сесія Stripe живе довше за утримання слоту (мінімум 30 хв проти
    // наших 20), тож слот міг дістатися іншому учневі. Тоді підтверджувати
    // бронь не можна — гроші повертаємо.
    if (!lock || lock.bookingId !== event.bookingId) {
      refundRequired = event.providerRef;
      tx.update(bookingRef, { status: "declined", holdUntil: null });
      tx.set(
        paymentRef,
        { status: "refunded", updatedAt: new Date().toISOString() },
        { merge: true }
      );
      return;
    }

    tx.update(bookingRef, {
      status: "confirmed",
      holdUntil: null,
      paymentId: event.providerRef,
    });
    tx.set(lockRef, { ...lock, status: "confirmed", holdUntil: null });
    tx.set(
      paymentRef,
      {
        bookingId: event.bookingId,
        provider: providerId,
        providerRef: event.providerRef,
        studentUserId: booking.studentUserId,
        tutorId: booking.tutorId,
        amount: booking.amount,
        currency: booking.currency,
        platformFee: booking.platformFee,
        status: "succeeded",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  });

  // Повернення робимо після транзакції: мережевий виклик усередині неї
  // затягнув би блокування, а повторний прогін транзакції задублював би
  // запит на повернення.
  if (refundRequired) {
    try {
      await providerById(providerId).refund(refundRequired);
    } catch (err) {
      console.error("[payments] refund failed", refundRequired, err);
    }
  }

  return { handled: true, refundRequired };
}

async function writePayment({
  providerRef,
  payment,
}: {
  providerRef: string;
  payment: Payment;
}): Promise<void> {
  await adminDb().doc(`payments/${providerRef}`).set(payment, { merge: true });
}
