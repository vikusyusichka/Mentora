import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Вебхук — єдине місце, де оплата перетворює бронь на підтверджену.
 * Ключів Stripe у розробці немає, але підпис вебхука це HMAC-SHA256 з
 * секретом, тож валідну подію можна зібрати самому й прогнати через
 * справжній обробник проти емулятора Firestore.
 */

const WEBHOOK_SECRET = "whsec_test_secret_for_local_verification";
const PROJECT_ID = "demo-mentora-payments";

process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.GCLOUD_PROJECT = PROJECT_ID;

const { adminDb } = await import("@/lib/firebase/admin");
const { stripeProvider } = await import("@/lib/payments/stripe-provider");
const { applyPaymentEvent } = await import("@/lib/server/payment-service");
const { slotLockId } = await import("@/lib/booking");

const db = adminDb();

const BOOKING_ID = "booking-1";
const SLOT_START = "2026-09-07T15:00:00.000Z";
const TUTOR_ID = "olena";
const SESSION_ID = "cs_test_123";

function lockPath(bookingId = BOOKING_ID) {
  void bookingId;
  return `tutorProfiles/${TUTOR_ID}/busySlots/${slotLockId(SLOT_START)}`;
}

async function seedBooking(overrides: Record<string, unknown> = {}) {
  await db.doc(`bookings/${BOOKING_ID}`).set({
    studentUserId: "marko",
    tutorId: TUTOR_ID,
    slotStart: SLOT_START,
    durationMin: 60,
    isTrial: false,
    status: "pending_payment",
    amount: 480,
    currency: "UAH",
    platformFee: 24,
    paymentId: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    holdUntil: "2026-09-01T10:20:00.000Z",
    ...overrides,
  });

  await db.doc(lockPath()).set({
    bookingId: BOOKING_ID,
    status: "pending_payment",
    holdUntil: "2026-09-01T10:20:00.000Z",
    slotStart: SLOT_START,
  });
}

/** Збирає подію Stripe разом із валідним заголовком підпису. */
function signedEvent(
  type: string,
  object: Record<string, unknown>,
  secret = WEBHOOK_SECRET
) {
  const payload = JSON.stringify({
    id: "evt_test",
    object: "event",
    type,
    data: { object },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return { payload, header: `t=${timestamp},v1=${signature}` };
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 48000,
    currency: "uah",
    metadata: { bookingId: BOOKING_ID },
    client_reference_id: BOOKING_ID,
    ...overrides,
  };
}

const ENROLLMENT_ID = `${TUTOR_ID}__marko`;

async function seedParticipants() {
  await db.doc("users/marko").set({
    role: "student",
    displayName: "Марко Кравець",
    email: "marko@example.com",
  });
  await db.doc(`tutorProfiles/${TUTOR_ID}`).set({
    displayName: "Олена Вчителька",
    languages: ["Англійська"],
    isPublished: true,
  });
}

async function clearAll() {
  for (const path of [
    `bookings/${BOOKING_ID}`,
    lockPath(),
    `payments/${SESSION_ID}`,
    `students/${ENROLLMENT_ID}/lessons/${BOOKING_ID}`,
    `students/${ENROLLMENT_ID}`,
    "users/marko",
    `tutorProfiles/${TUTOR_ID}`,
  ]) {
    await db.doc(path).delete();
  }
}

beforeAll(async () => {
  await clearAll();
});

beforeEach(async () => {
  await clearAll();
});

afterAll(async () => {
  await clearAll();
});

describe("перевірка підпису", () => {
  it("приймає подію з валідним підписом", () => {
    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession()
    );
    const event = stripeProvider.parseWebhook(payload, header);
    expect(event.type).toBe("payment.succeeded");
  });

  it("відхиляє чужий секрет", () => {
    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession(),
      "whsec_wrong"
    );
    expect(() => stripeProvider.parseWebhook(payload, header)).toThrow();
  });

  it("відхиляє підмінене тіло", () => {
    const { header } = signedEvent("checkout.session.completed", paidSession());
    const tampered = JSON.stringify({
      id: "evt_test",
      object: "event",
      type: "checkout.session.completed",
      data: { object: paidSession({ amount_total: 1 }) },
    });
    expect(() => stripeProvider.parseWebhook(tampered, header)).toThrow();
  });

  it("відхиляє запит без підпису", () => {
    const { payload } = signedEvent("checkout.session.completed", paidSession());
    expect(() => stripeProvider.parseWebhook(payload, null)).toThrow();
  });

  it("сесія без оплати не вважається успішною", () => {
    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession({ payment_status: "unpaid" })
    );
    expect(stripeProvider.parseWebhook(payload, header).type).toBe("ignored");
  });

  it("невідомий тип події ігнорується", () => {
    const { payload, header } = signedEvent("invoice.created", { id: "in_1" });
    expect(stripeProvider.parseWebhook(payload, header).type).toBe("ignored");
  });
});

describe("успішна оплата підтверджує бронь", () => {
  it("бронь стає confirmed, зʼявляється платіж, слот стає зайнятим назавжди", async () => {
    await seedBooking();

    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession()
    );
    await applyPaymentEvent(
      stripeProvider.parseWebhook(payload, header),
      "stripe"
    );

    const booking = (await db.doc(`bookings/${BOOKING_ID}`).get()).data();
    expect(booking?.status).toBe("confirmed");
    expect(booking?.holdUntil).toBeNull();
    expect(booking?.paymentId).toBe(SESSION_ID);

    const payment = (await db.doc(`payments/${SESSION_ID}`).get()).data();
    expect(payment?.status).toBe("succeeded");
    expect(payment?.amount).toBe(480);
    expect(payment?.platformFee).toBe(24);
    expect(payment?.provider).toBe("stripe");

    const lock = (await db.doc(lockPath()).get()).data();
    expect(lock?.status).toBe("confirmed");
    expect(lock?.holdUntil).toBeNull();
  });

  it("повторна доставка нічого не змінює (ідемпотентність)", async () => {
    await seedBooking();
    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession()
    );

    const event = stripeProvider.parseWebhook(payload, header);
    await applyPaymentEvent(event, "stripe");
    const first = (await db.doc(`bookings/${BOOKING_ID}`).get()).data();

    await applyPaymentEvent(event, "stripe");
    await applyPaymentEvent(event, "stripe");
    const after = (await db.doc(`bookings/${BOOKING_ID}`).get()).data();

    expect(after).toEqual(first);
  });
});

describe("гроші дійшли, а слот уже втрачено", () => {
  it("бронь відхиляється, платіж позначається на повернення", async () => {
    await seedBooking();
    // Слот встиг дістатися іншому учневі: сесія Stripe живе довше за
    // наше утримання, тож така гонка реальна.
    await db.doc(lockPath()).set({
      bookingId: "booking-other",
      status: "confirmed",
      holdUntil: null,
      slotStart: SLOT_START,
    });

    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession()
    );
    const result = await applyPaymentEvent(
      stripeProvider.parseWebhook(payload, header),
      "stripe"
    );

    expect(result.refundRequired).toBe(SESSION_ID);

    const booking = (await db.doc(`bookings/${BOOKING_ID}`).get()).data();
    expect(booking?.status).toBe("declined");

    const payment = (await db.doc(`payments/${SESSION_ID}`).get()).data();
    expect(payment?.status).toBe("refunded");

    // Чужу бронь не чіпаємо.
    const lock = (await db.doc(lockPath()).get()).data();
    expect(lock?.bookingId).toBe("booking-other");
  });
});

describe("оплата породжує навчальний звʼязок (B.4)", () => {
  it("зʼявляється enrollment і перший урок", async () => {
    await seedParticipants();
    await seedBooking();

    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession()
    );
    await applyPaymentEvent(
      stripeProvider.parseWebhook(payload, header),
      "stripe"
    );

    const enrollment = (await db.doc(`students/${ENROLLMENT_ID}`).get()).data();
    expect(enrollment?.tutorId).toBe(TUTOR_ID);
    expect(enrollment?.studentUid).toBe("marko");
    expect(enrollment?.parentUids).toEqual([]);
    expect(enrollment?.name).toBe("Марко Кравець");
    // Репетитор викладає одну мову — її й підставляємо.
    expect(enrollment?.languages).toEqual(["Англійська"]);
    expect(enrollment?.lessonsCount).toBe(0);

    const lesson = (
      await db.doc(`students/${ENROLLMENT_ID}/lessons/${BOOKING_ID}`).get()
    ).data();
    expect(lesson?.slotStart).toBe(SLOT_START);
    expect(lesson?.status).toBe("scheduled");
    expect(lesson?.bookingId).toBe(BOOKING_ID);
    expect(lesson?.report).toBeNull();
  });

  it("повторна оплата не дублює звʼязок і не плодить уроки", async () => {
    await seedParticipants();
    await seedBooking();

    const { payload, header } = signedEvent(
      "checkout.session.completed",
      paidSession()
    );
    const event = stripeProvider.parseWebhook(payload, header);

    await applyPaymentEvent(event, "stripe");
    await applyPaymentEvent(event, "stripe");

    const lessons = await db
      .collection(`students/${ENROLLMENT_ID}/lessons`)
      .get();
    expect(lessons.size).toBe(1);
  });

  it("друга оплата тій самій парі додає урок у той самий звʼязок", async () => {
    await seedParticipants();
    await seedBooking();

    const first = signedEvent("checkout.session.completed", paidSession());
    await applyPaymentEvent(
      stripeProvider.parseWebhook(first.payload, first.header),
      "stripe"
    );

    // Друга бронь тієї самої пари — інший слот, інша сесія.
    const secondSlot = "2026-09-14T15:00:00.000Z";
    await db.doc("bookings/booking-2").set({
      studentUserId: "marko",
      tutorId: TUTOR_ID,
      slotStart: secondSlot,
      durationMin: 60,
      isTrial: false,
      status: "pending_payment",
      amount: 480,
      currency: "UAH",
      platformFee: 24,
      paymentId: null,
      createdAt: "2026-09-08T10:00:00.000Z",
      holdUntil: "2026-09-08T10:20:00.000Z",
    });
    await db
      .doc(`tutorProfiles/${TUTOR_ID}/busySlots/${slotLockId(secondSlot)}`)
      .set({
        bookingId: "booking-2",
        status: "pending_payment",
        holdUntil: "2026-09-08T10:20:00.000Z",
        slotStart: secondSlot,
      });

    const second = signedEvent(
      "checkout.session.completed",
      paidSession({ id: "cs_test_456", metadata: { bookingId: "booking-2" } })
    );
    await applyPaymentEvent(
      stripeProvider.parseWebhook(second.payload, second.header),
      "stripe"
    );

    const enrollments = await db
      .collection("students")
      .where("studentUid", "==", "marko")
      .get();
    expect(enrollments.size).toBe(1);

    const lessons = await db
      .collection(`students/${ENROLLMENT_ID}/lessons`)
      .get();
    expect(lessons.size).toBe(2);

    // Прибираємо за собою те, що не входить у clearAll().
    await db.doc("bookings/booking-2").delete();
    await db.doc(`payments/cs_test_456`).delete();
    await db.doc(`students/${ENROLLMENT_ID}/lessons/booking-2`).delete();
    await db
      .doc(`tutorProfiles/${TUTOR_ID}/busySlots/${slotLockId(secondSlot)}`)
      .delete();
  });
});

describe("невдала оплата звільняє слот", () => {
  it("сесія протермінована → бронь скасовано, замок знято", async () => {
    await seedBooking();

    const { payload, header } = signedEvent(
      "checkout.session.expired",
      paidSession({ payment_status: "unpaid" })
    );
    await applyPaymentEvent(
      stripeProvider.parseWebhook(payload, header),
      "stripe"
    );

    const booking = (await db.doc(`bookings/${BOOKING_ID}`).get()).data();
    expect(booking?.status).toBe("cancelled");

    const lock = await db.doc(lockPath()).get();
    expect(lock.exists).toBe(false);
  });

  it("невдача після підтвердження не скасовує оплачену бронь", async () => {
    await seedBooking({ status: "confirmed", holdUntil: null });

    const { payload, header } = signedEvent(
      "checkout.session.expired",
      paidSession({ payment_status: "unpaid" })
    );
    await applyPaymentEvent(
      stripeProvider.parseWebhook(payload, header),
      "stripe"
    );

    const booking = (await db.doc(`bookings/${BOOKING_ID}`).get()).data();
    expect(booking?.status).toBe("confirmed");
  });
});
