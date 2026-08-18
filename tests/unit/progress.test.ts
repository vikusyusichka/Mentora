import { describe, expect, it } from "vitest";
import {
  MIN_POINTS_FOR_CHART,
  lessonSeries,
  practiceStats,
  progressSummary,
  worthCharting,
} from "@/lib/progress";
import type { LessonWithId } from "@/lib/enrollment";

function lesson(
  id: string,
  slotStart: string,
  report: { newWordsCount: number; speakingPractice: boolean } | null
): LessonWithId {
  return {
    id,
    enrollmentId: "e1",
    slotStart,
    durationMin: 60,
    status: report ? "done" : "scheduled",
    bookingId: id,
    createdAt: "2026-09-01T00:00:00.000Z",
    report: report
      ? {
          topic: "Тема",
          newWordsCount: report.newWordsCount,
          speakingPractice: report.speakingPractice,
          noteForStudent: "",
        }
      : null,
  };
}

describe("progressSummary", () => {
  it("рахує частку шляху від A1 до цілі", () => {
    // B1 — третій рівень (індекс 2), ціль B2 (індекс 3).
    expect(progressSummary("B1", "B2").percent).toBe(67);
    expect(progressSummary("A1", "C2").percent).toBe(0);
    expect(progressSummary("C1", "C2").percent).toBe(80);
  });

  it("досягнута ціль — це 100%, а не перебір", () => {
    expect(progressSummary("B2", "B2").percent).toBe(100);
    // Ціль нижча за поточний рівень: вважаємо досягнутою.
    expect(progressSummary("C1", "B1").percent).toBe(100);
    expect(progressSummary("C1", "B1").levelsLeft).toBe(0);
  });

  it("без цілі або без рівня прогрес не рахується", () => {
    expect(progressSummary(null, "B2")).toMatchObject({
      percent: 0,
      levelsLeft: null,
    });
    expect(progressSummary("B1", null)).toMatchObject({
      percent: 0,
      levelsLeft: null,
    });
  });

  it("ціль A1 не дає ділення на нуль", () => {
    expect(progressSummary("A1", "A1").percent).toBe(0);
    expect(progressSummary("A1", "A1").levelsLeft).toBeNull();
  });

  it("рахує, скільки рівнів лишилось", () => {
    expect(progressSummary("A2", "C1").levelsLeft).toBe(3);
  });
});

describe("lessonSeries", () => {
  it("бере лише уроки зі звітом і сортує за часом", () => {
    const points = lessonSeries([
      lesson("c", "2026-09-10T10:00:00.000Z", { newWordsCount: 5, speakingPractice: false }),
      lesson("a", "2026-09-01T10:00:00.000Z", { newWordsCount: 12, speakingPractice: true }),
      lesson("b", "2026-09-05T10:00:00.000Z", null),
    ]);

    expect(points.map((p) => p.newWords)).toEqual([12, 5]);
    expect(points[0].speakingPractice).toBe(true);
  });

  it("лишає лише останні N уроків", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      lesson(`l${i}`, `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`, {
        newWordsCount: i,
        speakingPractice: false,
      })
    );
    const points = lessonSeries(many, 5);
    expect(points).toHaveLength(5);
    // Саме останні, а не перші.
    expect(points.map((p) => p.newWords)).toEqual([15, 16, 17, 18, 19]);
  });

  it("порожня історія дає порожній ряд", () => {
    expect(lessonSeries([])).toEqual([]);
  });
});

describe("practiceStats", () => {
  it("рахує частку практики й середні слова", () => {
    const stats = practiceStats([
      { slotStart: "1", newWords: 10, speakingPractice: true },
      { slotStart: "2", newWords: 20, speakingPractice: false },
      { slotStart: "3", newWords: 15, speakingPractice: true },
    ]);

    expect(stats).toEqual({
      lessonsWithReport: 3,
      practiceLessons: 2,
      practiceShare: 67,
      averageNewWords: 15,
    });
  });

  it("порожній ряд не ділить на нуль", () => {
    expect(practiceStats([])).toEqual({
      lessonsWithReport: 0,
      practiceLessons: 0,
      practiceShare: 0,
      averageNewWords: 0,
    });
  });
});

describe("worthCharting", () => {
  it("на одному-двох уроках графік не малюємо", () => {
    const point = { slotStart: "1", newWords: 5, speakingPractice: true };
    expect(worthCharting([])).toBe(false);
    expect(worthCharting([point, point])).toBe(false);
    expect(worthCharting(Array(MIN_POINTS_FOR_CHART).fill(point))).toBe(true);
  });
});
