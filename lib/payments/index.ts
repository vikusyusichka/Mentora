import "server-only";

import type { PaymentProviderId } from "@/lib/payment";
import type { PaymentProvider } from "@/lib/payments/provider";
import { stripeProvider } from "@/lib/payments/stripe-provider";

/**
 * Реєстр провайдерів. Конкретний обирається за полем `payoutProvider`
 * у профілі репетитора, а не глобально: міжнародні репетитори працюють
 * через Stripe, українські — через локального провайдера, і в каталозі
 * вони стоять поруч.
 */
const PROVIDERS: Partial<Record<PaymentProviderId, PaymentProvider>> = {
  stripe: stripeProvider,
};

export function providerById(id: PaymentProviderId): PaymentProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(
      `Провайдер «${id}» ще не реалізовано. Наразі доступний лише Stripe.`
    );
  }
  return provider;
}

/** Провайдер за замовчуванням для нових онбордингів. */
export const DEFAULT_PROVIDER: PaymentProviderId = "stripe";
