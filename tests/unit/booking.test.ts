import { describe, expect, it } from "vitest";
import {
  BOOKING_HOLD_MINUTES,
  holdIsActive,
  platformFeeFor,
  slotLockId,
} from "@/lib/booking";

describe("slotLockId", () => {
  it("детермінований для одного моменту", () => {
    expect(slotLockId("2026-09-07T15:00:00.000Z")).toBe(
      slotLockId("2026-09-07T15:00:00.000Z")
    );
  });

  it("той самий момент у різному записі дає той самий замок", () => {
    // Саме це й захищає від подвійного бронювання: клієнт може надіслати
    // час зі зсувом, але замок усе одно один.
    expect(slotLockId("2026-09-07T18:00:00.000+03:00")).toBe(
      slotLockId("2026-09-07T15:00:00.000Z")
    );
  });

  it("різні моменти — різні замки", () => {
    expect(slotLockId("2026-09-07T15:00:00.000Z")).not.toBe(
      slotLockId("2026-09-07T16:00:00.000Z")
    );
  });
});

describe("holdIsActive", () => {
  const now = new Date("2026-09-01T10:10:00.000Z");

  it("свіже утримання займає слот", () => {
    expect(
      holdIsActive(
        { status: "pending_payment", holdUntil: "2026-09-01T10:20:00.000Z" },
        now
      )
    ).toBe(true);
  });

  it("прострочене утримання слот звільняє", () => {
    expect(
      holdIsActive(
        { status: "pending_payment", holdUntil: "2026-09-01T10:05:00.000Z" },
        now
      )
    ).toBe(false);
  });

  it("підтверджена бронь займає слот назавжди", () => {
    expect(holdIsActive({ status: "confirmed", holdUntil: null }, now)).toBe(true);
  });

  it("скасована й відхилена не займають", () => {
    expect(holdIsActive({ status: "cancelled", holdUntil: null }, now)).toBe(false);
    expect(holdIsActive({ status: "declined", holdUntil: null }, now)).toBe(false);
  });

  it("утримання без строку не діє", () => {
    expect(
      holdIsActive({ status: "pending_payment", holdUntil: null }, now)
    ).toBe(false);
  });
});

describe("platformFeeFor", () => {
  it("рахує 5% цілими одиницями валюти", () => {
    expect(platformFeeFor(500)).toBe(25);
    expect(platformFeeFor(480)).toBe(24);
    expect(platformFeeFor(495)).toBe(25); // 24.75 → округлення
    expect(platformFeeFor(0)).toBe(0);
  });

  it("комісія ніколи не більша за суму", () => {
    for (const amount of [1, 7, 33, 999, 10000]) {
      expect(platformFeeFor(amount)).toBeLessThanOrEqual(amount);
    }
  });
});

describe("BOOKING_HOLD_MINUTES", () => {
  it("утримання скінченне — інакше слот блокувався б назавжди", () => {
    expect(BOOKING_HOLD_MINUTES).toBeGreaterThan(0);
    expect(BOOKING_HOLD_MINUTES).toBeLessThanOrEqual(60);
  });
});
