import { CEFR_LEVELS } from "@/lib/tutor-profile";
import type { ProgressSummary } from "@/lib/progress";

/**
 * Прогрес-бар CEFR: скільки пройдено від A1 до цільового рівня.
 *
 * Це не графік, а одне число з контекстом — тож малюється розміткою, без
 * бібліотеки. Заливка sage-green по треку soft-gold, як в еталоні.
 *
 * Позначки рівнів підписані текстом: колір сам по собі нічого не каже,
 * а підписи роблять шкалу читомою й без нього.
 */
export function CefrProgress({ summary }: { summary: ProgressSummary }) {
  const { percent, currentLevel, goalLevel, levelsLeft } = summary;

  if (!currentLevel || !goalLevel) {
    return (
      <div className="rounded-input bg-beige-card p-4">
        <p className="text-body-md text-muted-foreground">
          {currentLevel
            ? "Цільовий рівень ще не задано — репетитор вкаже його в картці."
            : "Рівень ще не визначено. Він зʼявиться після перших занять."}
        </p>
      </div>
    );
  }

  const goalIndex = CEFR_LEVELS.indexOf(goalLevel);
  const marks = CEFR_LEVELS.slice(0, goalIndex + 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-display-lg text-secondary">{currentLevel}</p>
        <p className="text-label-md text-muted-foreground">
          ціль <span className="text-secondary">{goalLevel}</span>
          {levelsLeft !== null && levelsLeft > 0 && (
            <> · лишилось рівнів: {levelsLeft}</>
          )}
        </p>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-soft-gold"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Прогрес від A1 до ${goalLevel}`}
      >
        <div
          className="h-full rounded-full bg-[#1F7A50] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="text-label-sm mt-2 flex justify-between text-outline">
        {marks.map((level) => (
          <span key={level} className={level === currentLevel ? "text-secondary" : ""}>
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}
