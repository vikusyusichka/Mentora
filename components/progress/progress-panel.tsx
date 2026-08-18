"use client";

import { Loader2 } from "lucide-react";

import { CefrProgress } from "@/components/progress/cefr-progress";
import { WordsChart } from "@/components/progress/words-chart";
import {
  lessonSeries,
  practiceStats,
  progressSummary,
  worthCharting,
} from "@/lib/progress";
import {
  useEnrollments,
  useLessonsInRange,
} from "@/lib/hooks/use-enrollments";
import type { Role } from "@/lib/types";

const FROM_BEGINNING = "1970-01-01T00:00:00.000Z";

/**
 * Прогрес учня: рівень CEFR, підсумкові цифри й нові слова за урок.
 *
 * Один компонент для учня й батьків — показують те саме, різниця лише
 * в тому, з якого боку читається звʼязок.
 *
 * Поки звʼязок один (у MVP учень навчається в одного репетитора), беремо
 * перший. Коли зʼявиться кілька — тут знадобиться перемикач.
 */
export function ProgressPanel({ role }: { role: Role }) {
  const { enrollments } = useEnrollments(role);
  const lessons = useLessonsInRange(enrollments, FROM_BEGINNING);

  if (enrollments === null || lessons === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо прогрес…
      </p>
    );
  }

  const enrollment = enrollments[0];
  if (!enrollment) {
    return (
      <p className="text-body-md text-muted-foreground">
        {role === "parent"
          ? "Ви ще не приєдналися до дитини."
          : "Прогрес зʼявиться після першого оплаченого уроку."}
      </p>
    );
  }

  const summary = progressSummary(enrollment.currentLevel, enrollment.goalLevel);
  const points = lessonSeries(lessons);
  const stats = practiceStats(points);

  return (
    <div className="space-y-8">
      <CefrProgress summary={summary} />

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Проведено уроків" value={enrollment.lessonsCount} />
        <Stat label="Усього нових слів" value={enrollment.totalNewWords} />
        <Stat
          label="Уроків із практикою"
          value={`${stats.practiceShare}%`}
          hint={
            stats.lessonsWithReport > 0
              ? `${stats.practiceLessons} з ${stats.lessonsWithReport}`
              : undefined
          }
        />
      </dl>

      {worthCharting(points) ? (
        <div>
          <h3 className="text-title-lg mb-1">Нові слова за урок</h3>
          <p className="text-body-md mb-4 text-muted-foreground">
            У середньому {stats.averageNewWords} за заняття.
          </p>
          <WordsChart points={points} />
        </div>
      ) : (
        <p className="text-body-md text-muted-foreground">
          Графік зʼявиться після третього уроку зі звітом — на меншій
          кількості він нічого не показує.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-input bg-beige-card p-4">
      <dt className="text-label-md text-muted-foreground">{label}</dt>
      <dd className="text-headline-lg mt-1 text-secondary">{value}</dd>
      {hint && <p className="text-label-sm text-outline">{hint}</p>}
    </div>
  );
}
