"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  LESSON_STATUS_LABELS,
  type LessonStatus,
  type LessonWithId,
} from "@/lib/enrollment";
import {
  useLessonsInRange,
  useEnrollments,
} from "@/lib/hooks/use-enrollments";
import { browserTimeZone, dateKeyInZone } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type RangeMode = "week" | "month";

const STATUS_STYLES: Record<LessonStatus, string> = {
  scheduled: "bg-soft-gold text-secondary",
  done: "bg-sage-green/10 text-sage-green",
  cancelled: "bg-badge-neutral text-muted-foreground",
};

/**
 * Межі проміжку рахуються в зоні глядача, а не в UTC: інакше «тиждень»
 * зсувався б на кілька годин і крайні уроки потрапляли б не в той екран.
 */
function rangeFor(mode: RangeMode, offset: number, timeZone: string) {
  const now = new Date();
  const today = new Date(
    `${dateKeyInZone(now, timeZone)}T00:00:00.000Z`
  );

  if (mode === "week") {
    // Тиждень починається з понеділка.
    const weekday = (today.getUTCDay() + 6) % 7;
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - weekday + offset * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end };
  }

  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1)
  );
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset + 1, 1)
  );
  return { start, end };
}

function LessonsSchedule() {
  const timeZone = browserTimeZone();
  const [mode, setMode] = useState<RangeMode>("week");
  const [offset, setOffset] = useState(0);

  const { start, end } = useMemo(
    () => rangeFor(mode, offset, timeZone),
    [mode, offset, timeZone]
  );

  const { enrollments, error } = useEnrollments("tutor");
  const lessons = useLessonsInRange(
    enrollments,
    start.toISOString(),
    end.toISOString()
  );

  const names = useMemo(
    () => Object.fromEntries((enrollments ?? []).map((e) => [e.id, e.name])),
    [enrollments]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            aria-label="Назад"
            onClick={() => setOffset((v) => v - 1)}
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} />
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
          >
            Зараз
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            aria-label="Уперед"
            onClick={() => setOffset((v) => v + 1)}
          >
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </Button>
          <span className="text-label-md ml-2 text-secondary">
            {rangeLabel(start, end, mode, timeZone)}
          </span>
        </div>

        <div className="flex gap-2">
          {(["week", "month"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setOffset(0);
              }}
              className={cn(
                "text-label-md rounded-full border-2 px-4 py-2 transition-all",
                mode === value
                  ? "border-gold bg-soft-gold text-secondary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {value === "week" ? "Тиждень" : "Місяць"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-body-md text-terracotta">{error}</p>}

      {lessons === null ? (
        <p className="text-label-md flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Завантажуємо розклад…
        </p>
      ) : lessons.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-10 text-center shadow-level1">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
            <CalendarRange className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="text-title-lg mb-2">Уроків немає</h2>
          <p className="text-body-md mx-auto max-w-md text-muted-foreground">
            {offset === 0
              ? "На цей період занять не заплановано."
              : "У вибраному періоді занять немає."}
          </p>
        </div>
      ) : (
        <DayGroups lessons={lessons} names={names} timeZone={timeZone} />
      )}
    </div>
  );
}

function DayGroups({
  lessons,
  names,
  timeZone,
}: {
  lessons: LessonWithId[];
  names: Record<string, string>;
  timeZone: string;
}) {
  const groups = new Map<string, LessonWithId[]>();
  for (const lesson of lessons) {
    const key = dateKeyInZone(new Date(lesson.slotStart), timeZone);
    const bucket = groups.get(key);
    if (bucket) bucket.push(lesson);
    else groups.set(key, [lesson]);
  }

  const dayFormat = new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFormat = new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([dateKey, dayLessons]) => (
        <section
          key={dateKey}
          className="rounded-card border border-border bg-card shadow-level1"
        >
          <h3 className="text-label-sm bg-search-field px-6 py-3 uppercase tracking-[0.08em] text-muted-foreground">
            {dayFormat.format(new Date(dayLessons[0].slotStart))}
          </h3>

          <ul>
            {dayLessons.map((lesson) => (
              <li
                key={`${lesson.enrollmentId}/${lesson.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 first:border-t-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-title-lg text-secondary">
                    {timeFormat.format(new Date(lesson.slotStart))}
                  </span>
                  <div>
                    <Link
                      href={`/tutor/students/${lesson.enrollmentId}`}
                      className="text-label-md text-secondary hover:underline"
                    >
                      {names[lesson.enrollmentId] ?? "Учень"}
                    </Link>
                    <p className="text-label-sm text-muted-foreground">
                      {lesson.durationMin} хв
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    "text-label-sm rounded-full px-3 py-1",
                    STATUS_STYLES[lesson.status]
                  )}
                >
                  {LESSON_STATUS_LABELS[lesson.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function rangeLabel(
  start: Date,
  end: Date,
  mode: RangeMode,
  timeZone: string
): string {
  if (mode === "month") {
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone,
      month: "long",
      year: "numeric",
    }).format(start);
  }

  const last = new Date(end.getTime() - 86_400_000);
  const format = new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    day: "numeric",
    month: "short",
  });
  return `${format.format(start)} — ${format.format(last)}`;
}

export default function TutorLessonsPage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Розклад уроків"
        description="Заплановані заняття з усіма учнями. Статус змінюється в картці учня."
      >
        <LessonsSchedule />
      </DashboardLayout>
    </AuthGate>
  );
}
