"use client";

import { useState } from "react";
import { CopyPlus, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BUFFER_OPTIONS,
  LESSON_DURATIONS,
  WEEKDAY_LABELS,
  WEEK_ORDER,
  findConflicts,
  slotEndLabel,
  type Availability,
  type WeeklySlot,
} from "@/lib/availability";
import { parseTimeOfDay } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const selectClass =
  "text-body-md h-10 rounded-input border border-input bg-card px-3";

/** Пн–Пт: куди копіюється день одним кліком. */
const WORKDAYS = [1, 2, 3, 4, 5];

export function WeeklyEditor({
  availability,
  timezone,
  onChange,
}: {
  availability: Availability;
  timezone: string;
  onChange: (next: Availability) => void;
}) {
  const conflicts = findConflicts(availability.weeklySlots, availability.bufferMin);

  function addSlot(dayOfWeek: number, startTime: string) {
    const minutes = parseTimeOfDay(startTime);
    if (minutes === null) return;

    const exists = availability.weeklySlots.some(
      (s) => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );
    if (exists) return;

    onChange({
      ...availability,
      weeklySlots: [
        ...availability.weeklySlots,
        {
          dayOfWeek,
          startTime,
          durationMin: availability.lessonDurationMin,
        },
      ],
    });
  }

  function removeSlot(slot: WeeklySlot) {
    onChange({
      ...availability,
      weeklySlots: availability.weeklySlots.filter(
        (s) => !(s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime)
      ),
    });
  }

  /** Замінює слоти всіх робочих днів слотами обраного — типовий графік. */
  function copyToWorkdays(dayOfWeek: number) {
    const source = availability.weeklySlots.filter(
      (s) => s.dayOfWeek === dayOfWeek
    );
    const untouched = availability.weeklySlots.filter(
      (s) => !WORKDAYS.includes(s.dayOfWeek)
    );
    const copied = WORKDAYS.flatMap((day) =>
      source.map((s) => ({ ...s, dayOfWeek: day }))
    );
    onChange({ ...availability, weeklySlots: [...untouched, ...copied] });
  }

  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
      <h2 className="text-title-lg mb-1">Тижневий шаблон</h2>
      <p className="text-body-md mb-6 text-muted-foreground">
        Час указуєте у своєму поясі ({timezone}). Учням він перерахується
        автоматично.
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="duration">Тривалість уроку</Label>
          <select
            id="duration"
            className={cn(selectClass, "w-full")}
            value={availability.lessonDurationMin}
            onChange={(e) =>
              onChange({
                ...availability,
                lessonDurationMin: Number(e.target.value),
              })
            }
          >
            {LESSON_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} хв
              </option>
            ))}
          </select>
          <p className="text-label-sm text-outline">
            Підставляється новим слотам. Уже додані не змінюються.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="buffer">Перерва між уроками</Label>
          <select
            id="buffer"
            className={cn(selectClass, "w-full")}
            value={availability.bufferMin}
            onChange={(e) =>
              onChange({ ...availability, bufferMin: Number(e.target.value) })
            }
          >
            {BUFFER_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b === 0 ? "Без перерви" : `${b} хв`}
              </option>
            ))}
          </select>
          <p className="text-label-sm text-outline">
            Використовується для перевірки, чи слоти не стоять впритул.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {WEEK_ORDER.map((dayOfWeek) => (
          <DayRow
            key={dayOfWeek}
            dayOfWeek={dayOfWeek}
            slots={availability.weeklySlots.filter(
              (s) => s.dayOfWeek === dayOfWeek
            )}
            conflicts={conflicts.filter((c) => c.dayOfWeek === dayOfWeek)}
            onAdd={(time) => addSlot(dayOfWeek, time)}
            onRemove={removeSlot}
            onCopyToWorkdays={() => copyToWorkdays(dayOfWeek)}
          />
        ))}
      </div>
    </section>
  );
}

function DayRow({
  dayOfWeek,
  slots,
  conflicts,
  onAdd,
  onRemove,
  onCopyToWorkdays,
}: {
  dayOfWeek: number;
  slots: WeeklySlot[];
  conflicts: { message: string }[];
  onAdd: (time: string) => void;
  onRemove: (slot: WeeklySlot) => void;
  onCopyToWorkdays: () => void;
}) {
  const [time, setTime] = useState("18:00");
  const sorted = [...slots].sort(
    (a, b) => (parseTimeOfDay(a.startTime) ?? 0) - (parseTimeOfDay(b.startTime) ?? 0)
  );

  return (
    <div className="rounded-input border border-border bg-search-field/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-label-md w-28 shrink-0 text-secondary">
          {WEEKDAY_LABELS[dayOfWeek]}
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {sorted.length === 0 && (
            <span className="text-label-md text-outline">Вихідний</span>
          )}
          {sorted.map((slot) => (
            <span
              key={slot.startTime}
              className="text-label-md flex items-center gap-2 rounded-full bg-soft-gold px-3 py-1.5 text-secondary"
            >
              {slot.startTime}–{slotEndLabel(slot)}
              <button
                type="button"
                onClick={() => onRemove(slot)}
                aria-label={`Прибрати слот ${slot.startTime}`}
                className="rounded-full text-secondary/60 transition-colors hover:text-terracotta"
              >
                <X className="size-4" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label={`Час для ${WEEKDAY_LABELS[dayOfWeek]}`}
            className="text-body-md h-10 rounded-input border border-input bg-card px-2"
          />
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            aria-label={`Додати слот у ${WEEKDAY_LABELS[dayOfWeek]}`}
            onClick={() => onAdd(time)}
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </Button>
          {sorted.length > 0 && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="rounded-full"
              aria-label={`Скопіювати ${WEEKDAY_LABELS[dayOfWeek]} на Пн–Пт`}
              title="Скопіювати на Пн–Пт"
              onClick={onCopyToWorkdays}
            >
              <CopyPlus className="size-4" strokeWidth={2} />
            </Button>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {conflicts.map((c) => (
            <li key={c.message} className="text-label-sm text-terracotta">
              {c.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
