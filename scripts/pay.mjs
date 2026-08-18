/**
 * Імітує вебхук Stripe про успішну оплату броні.
 *
 * Ключів Stripe у розробці немає, тож пройти справжній checkout неможливо.
 * Але підтвердження броні залежить не від нього, а від підписаної події:
 * підпис це HMAC-SHA256 із секретом вебхука, який лежить у `.env.local`.
 * Тому валідну подію можна зібрати локально й перевірити весь ланцюжок —
 * бронь стає підтвердженою, зʼявляється платіж, народжується навчальний
 * звʼязок і урок.
 *
 * Запуск: npm run pay -- <bookingId>
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const WEBHOOK_URL = "http://localhost:3000/api/payments/webhook";

/** Секрет беремо з .env.local — щоб він гарантовано збігався з тим, що в сервера. */
function webhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const env = readFileSync(".env.local", "utf8");
    const match = /^STRIPE_WEBHOOK_SECRET=(.+)$/m.exec(env);
    if (match) return match[1].trim();
  } catch {
    // Файла немає — повідомимо нижче.
  }

  console.error(
    "Не знайдено STRIPE_WEBHOOK_SECRET у .env.local.\n" +
      "Додайте рядок: STRIPE_WEBHOOK_SECRET=whsec_local_dev_secret"
  );
  process.exit(1);
}

const bookingId = process.argv[2];
if (!bookingId) {
  console.error("Вкажіть бронь: npm run pay -- <bookingId>");
  console.error("Ідентифікатор видно в консолі емуляторів → Firestore → bookings.");
  process.exit(1);
}

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const db = getFirestore(initializeApp({ projectId: "mentora-dc251" }));

const snapshot = await db.doc(`bookings/${bookingId}`).get();
if (!snapshot.exists) {
  console.error(`Броні ${bookingId} немає в базі.`);
  process.exit(1);
}
const booking = snapshot.data();

const payload = JSON.stringify({
  id: `evt_${Date.now()}`,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_test_${bookingId}`,
      object: "checkout.session",
      payment_status: "paid",
      amount_total: Math.round(booking.amount * 100),
      currency: String(booking.currency).toLowerCase(),
      metadata: { bookingId },
      client_reference_id: bookingId,
    },
  },
});

const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac("sha256", webhookSecret())
  .update(`${timestamp}.${payload}`)
  .digest("hex");

const response = await fetch(WEBHOOK_URL, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "stripe-signature": `t=${timestamp},v1=${signature}`,
  },
  body: payload,
});

const text = await response.text();
console.log(`вебхук → HTTP ${response.status} ${text}`);

if (response.ok) {
  const after = (await db.doc(`bookings/${bookingId}`).get()).data();
  console.log(`бронь ${bookingId} → ${after.status}`);
}

process.exit(response.ok ? 0 : 1);
