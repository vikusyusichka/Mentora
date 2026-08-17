"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  materializeSlots,
  type Availability,
  type SlotException,
} from "@/lib/availability";
import {
  dateKeyInZone,
  formatTimeInZone,
  parseDateKey,
  parseTimeOfDay,
  zonedTimeToUtc,
} from "@/lib/timezone";
import {
  getSlotExceptions,
  saveSlotException,
} from "@/lib/firebase/availability-repo";
import { cn } from "@/lib/utils";

const EMPTY: SlotException = { blocked: [], extra: [] };

/**
 * Винятки на конкретну дату: зняти слот шаблону або додати разовий.
 *
 * Заблоковані слоти зберігаються UTC-моментами, а не часом «18:00»:
 * шаблон може змінитися, а виняток має лишатись привʼязаним саме до того
 * заняття, яке репетитор скасував.
 */
export function ExceptionsEditor({
  tutorId,
  timezone,
  availability,
}: {
  tutorId: string;
  timezone: string;
  availability: Availability;
}) {
  const today = dateKeyInZone(new Date(), timezone);
  const [dateKey, setDateKey] = useState(today);
  const [exception, setException] = useState<SlotException>(EMPTY);
  const [extraTime, setExtraTime] = useState("18:00");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Стан завантаження виводимо з даних, а не тримаємо окремим прапорцем:
  // щойно дата змінилась, показане ще не відповідає обраному дню.
  const loading = loadedKey !== dateKey;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const found = await getSlotExceptions(tutorId, dateKey, dateKey);
      if (cancelled) return;
      setException(found[dateKey] ?? EMPTY);
      setLoadedKey(dateKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [tutorId, dateKey]);

  const date = parseDateKey(dateKey);

  // Слоти шаблону на обрану дату — без урахування винятків, щоб бачити
  // й ті, що вже заблоковані, і мати змогу зняти блокування.
  const daySlots = date
    ? materializeSlots({
        availability,
        exceptions: {},
        timezone,
        from: zonedTimeToUtc({ ...date, hour: 0, minute: 0 }, timezone),
        days: 1,
      })
    : [];

  const blocked = new Set(exception.blocked);

  function toggleBlocked(startUtc: string) {
    setException((prev) => ({
      ...prev,
      blocked: prev.blocked.includes(startUtc)
        ? prev.blocked.filter((s) => s !== startUtc)
        : [...prev.blocked, startUtc],
    }));
  }

  function addExtra() {
    const minutes = parseTimeOfDay(extraTime);
    if (minutes === null || !date) return;

    const start = zonedTimeToUtc(
      { ...date, hour: Math.floor(minutes / 60), minute: minutes % 60 },
      timezone
    ).toISOString();

    if (exception.extra.some((e) => e.start === start)) return;

    setException((prev) => ({
      ...prev,
      extra: [
        ...prev.extra,
        { start, durationMin: availability.lessonDurationMin },
      ],
    }));
  }

  function removeExtra(start: string) {
    setException((prev) => ({
      ...prev,
      extra: prev.extra.filter((e) => e.start !== start),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await saveSlotException(tutorId, dateKey, exception);
      toast.success("Виняток збережено.");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося зберегти виняток.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
      <h2 className="text-title-lg mb-1">Винятки на дату</h2>
      <p className="text-body-md mb-6 text-muted-foreground">
        Разові зміни: скасувати заняття у відпустку або, навпаки, відкрити
        додатковий час.
      </p>

      <div className="mb-6 max-w-xs space-y-2">
        <Label htmlFor="exception-date">Дата</Label>
        <input
          id="exception-date"
          type="date"
          min={today}
          value={dateKey}
          onChange={(e) => setDateKey(e.target.value)}
          className="text-body-md h-10 w-full rounded-input border border-input bg-card px-3"
        />
      </div>

      {loading ? (
        <p className="text-label-md flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Завантажуємо…
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            <span className="text-label-md mb-2 block text-muted-foreground">
              Слоти з шаблону
            </span>
            {daySlots.length === 0 ? (
              <p className="text-body-md text-outline">
                Цього дня шаблон не має занять.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => {
                  const off = blocked.has(slot.startUtc);
                  return (
                    <button
                      key={slot.startUtc}
                      type="button"
                      aria-pressed={off}
                      onClick={() => toggleBlocked(slot.startUtc)}
                      className={cn(
                        "text-label-md rounded-full border-2 px-4 py-2 transition-all",
                        off
                          ? "border-terracotta bg-terracotta/10 text-terracotta line-through"
                          : "border-border bg-card text-secondary hover:bg-muted"
                      )}
                    >
                      {formatTimeInZone(new Date(slot.startUtc), timezone)}
                    </button>
                  );
                })}
              </div>
            )}
            {daySlots.length > 0 && (
              <p className="text-label-sm mt-2 text-outline">
                Натисніть на час, щоб скасувати заняття саме цього дня.
              </p>
            )}
          </div>

          <div>
            <span className="text-label-md mb-2 block text-muted-foreground">
              Додатковий час
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {exception.extra.map((extra) => (
                <span
                  key={extra.start}
                  className="text-label-md flex items-center gap-2 rounded-full bg-sage-green/10 px-3 py-1.5 text-sage-green"
                >
                  {formatTimeInZone(new Date(extra.start), timezone)}
                  <button
                    type="button"
                    onClick={() => removeExtra(extra.start)}
                    aria-label="Прибрати додатковий слот"
                    className="transition-colors hover:text-terracotta"
                  >
                    <X className="size-4" strokeWidth={2.5} />
                  </button>
                </span>
              ))}

              <input
                type="time"
                value={extraTime}
                onChange={(e) => setExtraTime(e.target.value)}
                aria-label="Час додаткового слоту"
                className="text-body-md h-10 rounded-input border border-input bg-card px-2"
              />
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-full"
                aria-label="Додати додатковий слот"
                onClick={addExtra}
              >
                <Plus className="size-4" strokeWidth={2.5} />
              </Button>
            </div>
          </div>

          <Button
            className="rounded-full"
            size="lg"
            onClick={save}
            disabled={saving}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Зберегти виняток
          </Button>
        </div>
      )}
    </section>
  );
}
