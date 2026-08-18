import { describe, expect, it } from "vitest";
import {
  INVITE_LENGTH,
  formatCode,
  generateCode,
  inviteProblem,
  isValidCodeShape,
  normalizeCode,
  type Invite,
} from "@/lib/invite";

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    enrollmentId: "olena__marko",
    studentUid: "marko",
    tutorId: "olena",
    role: "parent",
    createdBy: "marko",
    createdAt: "2026-09-01T10:00:00.000Z",
    expiresAt: "2026-09-08T10:00:00.000Z",
    usedBy: null,
    usedAt: null,
    ...overrides,
  };
}

describe("generateCode", () => {
  it("дає код потрібної довжини", () => {
    const bytes = new Uint8Array(INVITE_LENGTH).fill(0);
    expect(generateCode(bytes)).toHaveLength(INVITE_LENGTH);
  });

  it("не використовує символи, які плутають на слух і на вигляд", () => {
    // Перебираємо всю абетку через значення байтів.
    const bytes = new Uint8Array(INVITE_LENGTH);
    const produced = new Set<string>();
    for (let value = 0; value < 256; value += 1) {
      bytes.fill(value);
      for (const char of generateCode(bytes)) produced.add(char);
    }
    for (const forbidden of ["0", "O", "1", "I", "L"]) {
      expect(produced.has(forbidden)).toBe(false);
    }
  });
});

describe("normalizeCode", () => {
  it("прощає регістр, дефіси й пробіли", () => {
    expect(normalizeCode("abcd-2345")).toBe("ABCD2345");
    expect(normalizeCode(" ABCD 2345 ")).toBe("ABCD2345");
    expect(normalizeCode("AB-CD-23-45")).toBe("ABCD2345");
  });
});

describe("isValidCodeShape", () => {
  it("приймає коректний код", () => {
    expect(isValidCodeShape("ABCD2345")).toBe(true);
  });

  it("відхиляє неправильну довжину й заборонені символи", () => {
    expect(isValidCodeShape("ABCD234")).toBe(false);
    expect(isValidCodeShape("ABCD23450")).toBe(false);
    // Нуль і одиниця не входять в абетку.
    expect(isValidCodeShape("ABCD2340")).toBe(false);
    expect(isValidCodeShape("ABCD234I")).toBe(false);
  });
});

describe("formatCode", () => {
  it("розбиває на групи по чотири", () => {
    expect(formatCode("ABCD2345")).toBe("ABCD-2345");
  });
});

describe("inviteProblem", () => {
  const now = new Date("2026-09-02T10:00:00.000Z");

  it("свіжий невикористаний код придатний", () => {
    expect(inviteProblem(invite(), now)).toBeNull();
  });

  it("неіснуючий код", () => {
    expect(inviteProblem(null, now)).toBe("not-found");
  });

  it("уже використаний код", () => {
    expect(inviteProblem(invite({ usedBy: "halyna" }), now)).toBe("already-used");
  });

  it("протермінований код", () => {
    expect(
      inviteProblem(invite({ expiresAt: "2026-09-01T10:00:00.000Z" }), now)
    ).toBe("expired");
  });

  it("використаний важливіший за протермінований — повідомлення точніше", () => {
    const spent = invite({
      usedBy: "halyna",
      expiresAt: "2026-09-01T10:00:00.000Z",
    });
    expect(inviteProblem(spent, now)).toBe("already-used");
  });
});
