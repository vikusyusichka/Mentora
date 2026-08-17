import type { BookingWithId } from "@/lib/booking";
import type { PaymentProviderId } from "@/lib/payment";

/**
 * Абстракція платіжного провайдера.
 *
 * Не «архітектурна краса»: ринок у нас одразу міжнародний і український,
 * а одним провайдером їх не покрити — Stripe не відкриває рахунки для
 * бізнесів в Україні, тож українським репетиторам потрібен свій.
 * Тому провайдер — властивість конкретного репетитора, а не застосунку.
 */

export interface CheckoutSession {
  /** Куди відправити учня платити. */
  url: string;
  /** Ідентифікатор сесії на боці провайдера — лягає в `payments.providerRef`. */
  reference: string;
}

/** Що провайдер повідомив вебхуком, у нашій термінології. */
export type PaymentEvent =
  | {
      type: "payment.succeeded";
      bookingId: string;
      providerRef: string;
      /** Сума в мінорних одиницях, як її бачить провайдер. */
      amountMinor: number;
    }
  | { type: "payment.failed"; bookingId: string; providerRef: string }
  | { type: "payment.refunded"; bookingId: string; providerRef: string }
  /** Подія, яка нас не стосується — але підпис валідний. */
  | { type: "ignored" };

export interface OnboardingLink {
  url: string;
  /** Ідентифікатор акаунта репетитора у провайдера. */
  accountId: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;

  /**
   * Сторінка оплати конкретної броні. Суму й комісію бере з броні —
   * жодних значень із клієнта.
   */
  createCheckout(params: {
    booking: BookingWithId;
    tutorPayoutAccountId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;

  /**
   * Перевіряє підпис і перекладає подію провайдера в нашу.
   * Кидає помилку, якщо підпис недійсний — це єдиний захист вебхука.
   */
  parseWebhook(rawBody: string, signature: string | null): PaymentEvent;

  /** Онбординг репетитора: створює акаунт і повертає посилання на анкету. */
  onboardTutor(params: {
    tutorId: string;
    email?: string;
    existingAccountId?: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<OnboardingLink>;

  /** Чи завершив репетитор онбординг і чи може приймати платежі. */
  canAcceptPayments(accountId: string): Promise<boolean>;

  refund(providerRef: string): Promise<void>;
}
