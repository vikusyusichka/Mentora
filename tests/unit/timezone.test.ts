import { describe, expect, it } from "vitest";
import {
  dateKeyInZone,
  formatMinutesOfDay,
  formatTimeInZone,
  parseTimeOfDay,
  utcToZonedParts,
  zoneOffsetMs,
  zonedTimeToUtc,
} from "../../lib/timezone";

const KYIV = "Europe/Kyiv";
const NY = "America/New_York";

describe("zonedTimeToUtc", () => {
  it("узимку Київ = UTC+2", () => {
    const utc = zonedTimeToUtc(
      { year: 2026, month: 1, day: 15, hour: 18, minute: 0 },
      KYIV
    );
    expect(utc.toISOString()).toBe("2026-01-15T16:00:00.000Z");
  });

  it("улітку Київ = UTC+3", () => {
    const utc = zonedTimeToUtc(
      { year: 2026, month: 7, day: 15, hour: 18, minute: 0 },
      KYIV
    );
    expect(utc.toISOString()).toBe("2026-07-15T15:00:00.000Z");
  });

  // Головна причина, чому тижневий шаблон зберігається в зоні репетитора,
  // а не в UTC: те саме «18:00 щопонеділка» — це різні UTC-моменти
  // до і після переходу на літній час.
  it("однакове локальне 18:00 дає різні UTC до і після переходу", () => {
    const before = zonedTimeToUtc(
      { year: 2026, month: 3, day: 23, hour: 18, minute: 0 },
      KYIV
    );
    const after = zonedTimeToUtc(
      { year: 2026, month: 3, day: 30, hour: 18, minute: 0 },
      KYIV
    );
    expect(before.toISOString()).toBe("2026-03-23T16:00:00.000Z");
    expect(after.toISOString()).toBe("2026-03-30T15:00:00.000Z");
  });

  it("Нью-Йорк узимку = UTC−5", () => {
    const utc = zonedTimeToUtc(
      { year: 2026, month: 1, day: 15, hour: 9, minute: 30 },
      NY
    );
    expect(utc.toISOString()).toBe("2026-01-15T14:30:00.000Z");
  });

  it("перетворення туди й назад не змінює локальний час", () => {
    for (const month of [1, 4, 7, 10]) {
      const parts = { year: 2026, month, day: 12, hour: 7, minute: 45 };
      const back = utcToZonedParts(zonedTimeToUtc(parts, KYIV), KYIV);
      expect({
        year: back.year,
        month: back.month,
        day: back.day,
        hour: back.hour,
        minute: back.minute,
      }).toEqual(parts);
    }
  });
});

describe("zoneOffsetMs", () => {
  it("рахує зсув у обидва боки від Гринвіча", () => {
    const instant = new Date("2026-07-15T12:00:00.000Z");
    expect(zoneOffsetMs(instant, KYIV)).toBe(3 * 3600_000);
    expect(zoneOffsetMs(instant, NY)).toBe(-4 * 3600_000);
    expect(zoneOffsetMs(instant, "UTC")).toBe(0);
  });
});

describe("показ у зоні глядача", () => {
  it("той самий момент — різний час у різних зонах", () => {
    const instant = new Date("2026-07-15T15:00:00.000Z");
    expect(formatTimeInZone(instant, KYIV)).toBe("18:00");
    expect(formatTimeInZone(instant, NY)).toBe("11:00");
    expect(formatTimeInZone(instant, "Asia/Tokyo")).toBe("00:00");
  });

  it("ключ дати береться в потрібній зоні, а не в UTC", () => {
    // Опівночі в Токіо ще попередня доба за UTC.
    const instant = new Date("2026-07-15T15:30:00.000Z");
    expect(dateKeyInZone(instant, "Asia/Tokyo")).toBe("2026-07-16");
    expect(dateKeyInZone(instant, KYIV)).toBe("2026-07-15");
  });

  it("день тижня рахується за локальною датою", () => {
    // 2026-07-16 у Токіо — четвер, хоча за UTC ще середа.
    const instant = new Date("2026-07-15T15:30:00.000Z");
    expect(utcToZonedParts(instant, "Asia/Tokyo").weekday).toBe(4);
    expect(utcToZonedParts(instant, KYIV).weekday).toBe(3);
  });
});

describe("час доби", () => {
  it("розбирає коректні значення", () => {
    expect(parseTimeOfDay("18:00")).toBe(18 * 60);
    expect(parseTimeOfDay("09:05")).toBe(9 * 60 + 5);
    expect(parseTimeOfDay(" 7:30 ")).toBe(7 * 60 + 30);
  });

  it("відхиляє сміття", () => {
    expect(parseTimeOfDay("25:00")).toBeNull();
    expect(parseTimeOfDay("18:60")).toBeNull();
    expect(parseTimeOfDay("вісімнадцята")).toBeNull();
    expect(parseTimeOfDay("")).toBeNull();
  });

  it("форматує назад", () => {
    expect(formatMinutesOfDay(0)).toBe("00:00");
    expect(formatMinutesOfDay(18 * 60 + 5)).toBe("18:05");
  });
});
