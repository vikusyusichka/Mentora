import "server-only";
import Stripe from "stripe";

import { toMinorUnits } from "@/lib/payment";
import type {
  CheckoutSession,
  OnboardingLink,
  PaymentEvent,
  PaymentProvider,
} from "@/lib/payments/provider";

/**
 * Stripe Connect — destination charges.
 *
 * Платником-мерчантом виступає платформа: гроші приходять на її акаунт,
 * `application_fee_amount` лишається платформі, решта переказується на
 * connected account репетитора. Саме тому комісія не «домовленість»,
 * а параметр платежу — учень не може її обійти, а репетитор не може
 * отримати більше, ніж належить.
 *
 * ⚠️ Stripe не відкриває акаунти для бізнесів в Україні, тож українські
 * репетитори цим провайдером виплати не отримають — для них потрібен
 * окремий (WayForPay/Fondy). Провайдер зберігається в профілі поруч із
 * `payoutAccountId`.
 */

let cached: Stripe | undefined;

/**
 * Ініціалізація лінива й навмисно не на рівні модуля: під час збірки Next
 * виконує імпорти, і відсутній ключ валив би весь білд замість одного
 * ендпоінта.
 */
function stripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Не задано STRIPE_SECRET_KEY. Додайте його у змінні оточення " +
        "(Vercel → Settings → Environment Variables) — без нього оплата не працює."
    );
  }

  // Версію API не фіксуємо: беремо ту, що прив'язана до акаунта, щоб
  // оновлення пакета не міняло поведінку платежів мовчки.
  cached = new Stripe(key);
  return cached;
}

function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Не задано STRIPE_WEBHOOK_SECRET. Без нього неможливо перевірити, " +
        "що вебхук справді від Stripe."
    );
  }
  return secret;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async createCheckout({
    booking,
    tutorPayoutAccountId,
    successUrl,
    cancelUrl,
  }): Promise<CheckoutSession> {
    const currency = booking.currency.toLowerCase();
    const lessonLabel = booking.isTrial
      ? "Пробний урок"
      : `Урок ${booking.durationMin} хв`;

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: toMinorUnits(booking.amount, booking.currency),
            product_data: { name: lessonLabel },
          },
        },
      ],
      payment_intent_data: {
        // Комісія платформи утримується Stripe автоматично.
        application_fee_amount: toMinorUnits(
          booking.platformFee,
          booking.currency
        ),
        transfer_data: { destination: tutorPayoutAccountId },
        metadata: { bookingId: booking.id },
      },
      // Дублюємо в метаданих сесії: вебхук приходить саме про сесію.
      metadata: { bookingId: booking.id },
      client_reference_id: booking.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: expiresAt(booking.holdUntil),
    });

    if (!session.url) {
      throw new Error("Stripe не повернув посилання на оплату.");
    }

    return { url: session.url, reference: session.id };
  },

  parseWebhook(rawBody: string, signature: string | null): PaymentEvent {
    if (!signature) throw new Error("Вебхук без підпису.");

    // Кидає, якщо підпис або тіло не збігаються — це і є захист ендпоінта.
    const event = Stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret()
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const bookingId = bookingIdOf(session.metadata, session.client_reference_id);
        if (!bookingId) return { type: "ignored" };

        // `completed` ще не означає «оплачено»: для відкладених способів
        // оплати статус буде `unpaid`, і бронь підтверджувати рано.
        if (session.payment_status !== "paid") return { type: "ignored" };

        return {
          type: "payment.succeeded",
          bookingId,
          providerRef: session.id,
          amountMinor: session.amount_total ?? 0,
        };
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const bookingId = bookingIdOf(session.metadata, session.client_reference_id);
        if (!bookingId) return { type: "ignored" };
        return {
          type: "payment.succeeded",
          bookingId,
          providerRef: session.id,
          amountMinor: session.amount_total ?? 0,
        };
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        const bookingId = bookingIdOf(session.metadata, session.client_reference_id);
        if (!bookingId) return { type: "ignored" };
        return { type: "payment.failed", bookingId, providerRef: session.id };
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const bookingId = bookingIdOf(charge.metadata, null);
        if (!bookingId) return { type: "ignored" };
        return { type: "payment.refunded", bookingId, providerRef: charge.id };
      }

      default:
        return { type: "ignored" };
    }
  },

  async onboardTutor({
    tutorId,
    email,
    existingAccountId,
    returnUrl,
    refreshUrl,
  }): Promise<OnboardingLink> {
    const client = stripe();

    const accountId =
      existingAccountId ??
      (
        await client.accounts.create({
          type: "express",
          email,
          metadata: { tutorId },
        })
      ).id;

    const link = await client.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return { url: link.url, accountId };
  },

  async canAcceptPayments(accountId: string): Promise<boolean> {
    const account = await stripe().accounts.retrieve(accountId);
    return account.charges_enabled === true;
  },

  async refund(providerRef: string): Promise<void> {
    const client = stripe();
    const session = await client.checkout.sessions.retrieve(providerRef);
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntent) {
      throw new Error("У сесії немає платежу, який можна повернути.");
    }

    await client.refunds.create({ payment_intent: paymentIntent });
  },
};

function bookingIdOf(
  metadata: Stripe.Metadata | null | undefined,
  clientReferenceId: string | null
): string | null {
  return metadata?.bookingId ?? clientReferenceId ?? null;
}

/**
 * Сесія оплати не має жити довше за утримання слоту — інакше учень
 * заплатив би за час, який уже віддали іншому.
 * Stripe вимагає щонайменше 30 хвилин від створення.
 */
function expiresAt(holdUntil: string | null): number | undefined {
  if (!holdUntil) return undefined;
  const minimum = Math.floor(Date.now() / 1000) + 31 * 60;
  return Math.max(Math.floor(Date.parse(holdUntil) / 1000), minimum);
}
