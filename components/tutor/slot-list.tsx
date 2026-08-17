"use client";

import { useSyncExternalStore } from "react";
import { CalendarClock } from "lucide-react";

import { groupByViewerDate, type MaterializedSlot } from "@/lib/availability";
import { browserTimeZone, formatTimeInZone } from "@/lib/timezone";

/**
 * Найближчі вільні слоти в таймзоні ГЛЯДАЧА.
 *
 * Зона визначається лише в браузері, тож до монтування показуємо заглушку:
 * якби сервер відрендерив час у своїй зоні, гідратація або зламалася б,
 * або перший кадр показував би учневі чужий час.
 */
export function SlotList({
  slots,
  tutorTimeZone,
  maxDays = 7,
}: {
  slots: MaterializedSlot[];
  tutorTimeZone: string;
  maxDays?: number;
}) {
  // Зона глядача — зовнішні дані, яких на сервері не існує. useSyncExternalStore
  // саме для цього: серверний знімок `null` дає заглушку в HTML, клієнтський —
  // справжню зону одразу після гідратації, без зайвого рендера через ефект.
  const viewerTimeZone = useSyncExternalStore(
    subscribeToNothing,
    browserTimeZone,
    () => null
  );

  if (slots.length === 0) {
    return (
      <p className="text-body-md text-muted-foreground">
        Репетитор ще не відкрив вільний час.
      </p>
    );
  }

  if (!viewerTimeZone) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-input bg-muted" />
      </div>
    );
  }

  const groups = groupByViewerDate(slots, viewerTimeZone).slice(0, maxDays);
  const differentZone = viewerTimeZone !== tutorTimeZone;

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.dateKey}>
            <h3 className="text-label-md mb-2 text-muted-foreground">
              {formatDateLabel(group.slots[0].startUtc, viewerTimeZone)}
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.slots.map((slot) => (
                <span
                  key={slot.startUtc}
                  className="text-label-md rounded-full bg-soft-gold px-4 py-2 text-secondary"
                >
                  {formatTimeInZone(new Date(slot.startUtc), viewerTimeZone)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-label-sm flex items-start gap-2 text-outline">
        <CalendarClock className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
        <span>
          Час показано у вашому поясі ({viewerTimeZone}).
          {differentZone && ` Репетитор працює за ${tutorTimeZone}.`}
        </span>
      </p>
    </div>
  );
}

/** Таймзона браузера не змінюється за час життя сторінки — підписки не треба. */
function subscribeToNothing(): () => void {
  return () => {};
}

function formatDateLabel(startUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(startUtc));
}
