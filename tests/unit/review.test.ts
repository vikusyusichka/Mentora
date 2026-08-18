import { describe, expect, it } from "vitest";
import { applyRating, isValidRating, reviewId } from "@/lib/review";

describe("reviewId", () => {
  it("детермінований для пари — тому другий відгук неможливий", () => {
    expect(reviewId("olena", "marko")).toBe(reviewId("olena", "marko"));
    expect(reviewId("olena", "marko")).not.toBe(reviewId("olena", "petro"));
  });
});

describe("isValidRating", () => {
  it("приймає цілі 1–5", () => {
    for (const value of [1, 2, 3, 4, 5]) {
      expect(isValidRating(value)).toBe(true);
    }
  });

  it("відхиляє межі, дроби й сміття", () => {
    for (const value of [0, 6, -1, 4.5, NaN, Infinity]) {
      expect(isValidRating(value)).toBe(false);
    }
  });
});

describe("applyRating", () => {
  it("перший відгук", () => {
    expect(applyRating({ ratingCount: 0 }, 5, null)).toEqual({
      ratingSum: 5,
      ratingCount: 1,
      ratingAvg: 5,
    });
  });

  it("другий відгук усереднюється", () => {
    const first = applyRating({ ratingCount: 0 }, 5, null);
    expect(applyRating(first, 4, null)).toEqual({
      ratingSum: 9,
      ratingCount: 2,
      ratingAvg: 4.5,
    });
  });

  it("редагування не збільшує кількість", () => {
    const state = applyRating({ ratingSum: 9, ratingCount: 2 }, 4, null);
    // Той самий учень міняє свою 4 на 2.
    expect(applyRating(state, 2, 4)).toEqual({
      ratingSum: 11,
      ratingCount: 3,
      ratingAvg: expect.any(Number),
    });
  });

  it("редагування свого відгуку рухає лише суму", () => {
    const after = applyRating({ ratingSum: 9, ratingCount: 2 }, 2, 4);
    expect(after.ratingCount).toBe(2);
    expect(after.ratingSum).toBe(7);
    expect(after.ratingAvg).toBe(3.5);
  });

  it("середнє округлюється до сотих, а не тягне хвіст", () => {
    // 4 + 5 + 5 = 14 на трьох → 4.666…
    const state = applyRating(
      applyRating(applyRating({ ratingCount: 0 }, 4, null), 5, null),
      5,
      null
    );
    expect(state.ratingAvg).toBe(4.67);
  });

  it("сума точна навіть після багатьох правок — бо рахуємо не з середнього", () => {
    let state = { ratingSum: 0, ratingCount: 0 };
    for (let i = 0; i < 30; i += 1) {
      state = applyRating(state, (i % 5) + 1, null);
    }
    // 30 відгуків, оцінки циклічно 1..5 → сума 3·(1+2+3+4+5)·2 = 90
    expect(state.ratingSum).toBe(90);
    expect(state.ratingCount).toBe(30);
    expect(state.ratingAvg).toBe(3);
  });
});
