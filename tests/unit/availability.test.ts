import { describe, expect, it } from "vitest";
import {
  EMPTY_AVAILABILITY,
  findConflicts,
  groupByViewerDate,
  materializeSlots,
  sortWeeklySlots,
  type Availability,
  type SlotException,
} from "@/lib/availability";
import { formatTimeInZone } from "@/lib/timezone";

const KYIV = "Europe/Kyiv";

/** Пн 18:00 і Ср 09:30, обидва по годині. */
const availability: Availability = {
  ...EMPTY_AVAILABILITY,
  weeklySlots: [
    { dayOfWeek: 1, startTime: "18:00", durationMin: 60 },
    { dayOfWeek: 3, startTime: "09:30", durationMin: 60 },
  ],
};

const noExceptions: Record<string, SlotException> = {};

describe("materializeSlots", () => {
  it("розгортає шаблон на тиждень уперед", () => {
    // Неділя, 12 липня 2026, 00:00 за Києвом.
    const from = new Date("2026-07-11T21:00:00.000Z");
    const slots = materializeSlots({
      availability,
      exceptions: noExceptions,
      timezone: KYIV,
      from,
      days: 7,
    });

    expect(slots.map((s) => s.startUtc)).toEqual([
      "2026-07-13T15:00:00.000Z", // Пн 18:00 за Києвом (літо, UTC+3)
      "2026-07-15T06:30:00.000Z", // Ср 09:30
    ]);
  });

  it("узимку той самий слот дає інший UTC — шаблон живе в зоні репетитора", () => {
    const from = new Date("2026-01-11T22:00:00.000Z"); // Нд, 12 січня, Київ
    const slots = materializeSlots({
      availability,
      exceptions: noExceptions,
      timezone: KYIV,
      from,
      days: 7,
    });

    expect(slots[0].startUtc).toBe("2026-01-12T16:00:00.000Z"); // UTC+2
    expect(formatTimeInZone(new Date(slots[0].startUtc), KYIV)).toBe("18:00");
  });

  it("минулі слоти не потрапляють у видачу", () => {
    // Понеділок, 19:00 за Києвом — слот 18:00 уже минув.
    const from = new Date("2026-07-13T16:00:00.000Z");
    const slots = materializeSlots({
      availability,
      exceptions: noExceptions,
      timezone: KYIV,
      from,
      days: 7,
    });

    expect(slots.map((s) => s.startUtc)).toEqual(["2026-07-15T06:30:00.000Z"]);
  });

  it("виняток прибирає слот шаблону", () => {
    const from = new Date("2026-07-11T21:00:00.000Z");
    const slots = materializeSlots({
      availability,
      exceptions: {
        "2026-07-13": { blocked: ["2026-07-13T15:00:00.000Z"], extra: [] },
      },
      timezone: KYIV,
      from,
      days: 7,
    });

    expect(slots.map((s) => s.startUtc)).toEqual(["2026-07-15T06:30:00.000Z"]);
  });

  it("виняток додає разовий слот понад шаблон", () => {
    const from = new Date("2026-07-11T21:00:00.000Z");
    const slots = materializeSlots({
      availability,
      exceptions: {
        "2026-07-14": {
          blocked: [],
          extra: [{ start: "2026-07-14T12:00:00.000Z", durationMin: 45 }],
        },
      },
      timezone: KYIV,
      from,
      days: 7,
    });

    expect(slots.map((s) => s.startUtc)).toEqual([
      "2026-07-13T15:00:00.000Z",
      "2026-07-14T12:00:00.000Z",
      "2026-07-15T06:30:00.000Z",
    ]);
    expect(slots[1].source).toBe("extra");
  });

  it("порожній шаблон дає порожню видачу", () => {
    const slots = materializeSlots({
      availability: EMPTY_AVAILABILITY,
      exceptions: noExceptions,
      timezone: KYIV,
      from: new Date("2026-07-11T21:00:00.000Z"),
      days: 14,
    });
    expect(slots).toEqual([]);
  });
});

describe("показ у зоні глядача", () => {
  it("слот репетитора з Києва в Нью-Йорку — той самий момент, інший час", () => {
    const from = new Date("2026-07-11T21:00:00.000Z");
    const [slot] = materializeSlots({
      availability,
      exceptions: noExceptions,
      timezone: KYIV,
      from,
      days: 7,
    });

    expect(formatTimeInZone(new Date(slot.startUtc), KYIV)).toBe("18:00");
    expect(formatTimeInZone(new Date(slot.startUtc), "America/New_York")).toBe(
      "11:00"
    );
  });

  it("групування бере дату в зоні глядача", () => {
    const slots = [
      { startUtc: "2026-07-15T21:30:00.000Z", durationMin: 60, source: "weekly" as const },
    ];

    // 21:30 UTC — це вже 16 липня в Києві, але ще 15-те в Нью-Йорку.
    expect(groupByViewerDate(slots, KYIV)[0].dateKey).toBe("2026-07-16");
    expect(groupByViewerDate(slots, "America/New_York")[0].dateKey).toBe(
      "2026-07-15"
    );
  });
});

describe("findConflicts", () => {
  it("не бачить проблем у коректному дні", () => {
    const slots = [
      { dayOfWeek: 1, startTime: "10:00", durationMin: 60 },
      { dayOfWeek: 1, startTime: "11:15", durationMin: 60 },
    ];
    expect(findConflicts(slots, 15)).toEqual([]);
  });

  it("ловить перетин слотів", () => {
    const slots = [
      { dayOfWeek: 1, startTime: "10:00", durationMin: 60 },
      { dayOfWeek: 1, startTime: "10:30", durationMin: 60 },
    ];
    expect(findConflicts(slots, 0)[0].message).toContain("перетинаються");
  });

  it("ловить замалу перерву між уроками", () => {
    const slots = [
      { dayOfWeek: 1, startTime: "10:00", durationMin: 60 },
      { dayOfWeek: 1, startTime: "11:05", durationMin: 60 },
    ];
    expect(findConflicts(slots, 15)[0].message).toContain("перерви");
  });

  it("слоти різних днів не конфліктують", () => {
    const slots = [
      { dayOfWeek: 1, startTime: "10:00", durationMin: 60 },
      { dayOfWeek: 2, startTime: "10:00", durationMin: 60 },
    ];
    expect(findConflicts(slots, 60)).toEqual([]);
  });
});

describe("sortWeeklySlots", () => {
  it("тиждень починається з понеділка, неділя остання", () => {
    const sorted = sortWeeklySlots([
      { dayOfWeek: 0, startTime: "10:00", durationMin: 60 },
      { dayOfWeek: 1, startTime: "12:00", durationMin: 60 },
      { dayOfWeek: 1, startTime: "08:00", durationMin: 60 },
    ]);
    expect(sorted.map((s) => `${s.dayOfWeek}@${s.startTime}`)).toEqual([
      "1@08:00",
      "1@12:00",
      "0@10:00",
    ]);
  });
});
