export const runtime = "nodejs";

/**
 * Вебхук платіжного провайдера — єдине місце, де бронь стає `confirmed`.
 *
 * Довіра тут тримається виключно на підписі: тіло читається СИРИМ рядком,
 * бо будь-яка нормалізація JSON зламала б HMAC і перевірка перестала б
 * щось означати. Ані користувач, ані клієнтський код підтвердити оплату
 * не можуть — тільки цей роут після успішної перевірки підпису.
 *
 * Через нульовий бюджет це API-роут на Vercel, а не Cloud Function;
 * модель безпеки від цього не змінюється.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  try {
    const { providerById } = await import("@/lib/payments");
    const { applyPaymentEvent } = await import("@/lib/server/payment-service");

    const provider = providerById("stripe");

    let event;
    try {
      event = provider.parseWebhook(rawBody, signature);
    } catch (err) {
      // Недійсний підпис — не помилка сервера, а відмова: 400, щоб
      // провайдер не ретраїв вічно.
      console.error("[payments/webhook] підпис не пройшов перевірку", err);
      return Response.json({ error: "Недійсний підпис." }, { status: 400 });
    }

    const result = await applyPaymentEvent(event, provider.id);

    // Провайдеру достатньо 200: подія прийнята, ретраї не потрібні.
    return Response.json({ received: true, handled: result.handled });
  } catch (err) {
    // 500 змусить провайдера повторити доставку — саме те, що треба,
    // якщо впала база, а не підпис.
    console.error("[payments/webhook]", err);
    return Response.json({ error: "Помилка обробки події." }, { status: 500 });
  }
}
