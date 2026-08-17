"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingScreen } from "@/components/loading-screen";
import { SlotList } from "@/components/tutor/slot-list";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  EMPTY_AVAILABILITY,
  findConflicts,
  materializeSlots,
  type Availability,
  type MaterializedSlot,
} from "@/lib/availability";
import {
  getAvailabilityOrEmpty,
  getSlotExceptions,
  saveAvailability,
} from "@/lib/firebase/availability-repo";
import { getTutorProfile } from "@/lib/firebase/tutor-profile-repo";
import { dateKeyInZone } from "@/lib/timezone";
import { ExceptionsEditor } from "./exceptions-editor";
import { WeeklyEditor } from "./weekly-editor";

/** На скільки днів уперед показуємо прев'ю розкладу. */
const PREVIEW_DAYS = 14;

function ScheduleEditor() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<Availability>(EMPTY_AVAILABILITY);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [previewSlots, setPreviewSlots] = useState<MaterializedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const [profile, saved] = await Promise.all([
          getTutorProfile(user.uid),
          getAvailabilityOrEmpty(user.uid),
        ]);
        if (cancelled) return;
        setTimezone(profile?.timezone ?? null);
        setAvailability(saved);
      } catch (err) {
        console.error(err);
        toast.error("Не вдалося завантажити розклад.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Прев'ю рахуємо разом із винятками — щоб репетитор бачив саме те,
  // що побачить учень, а не «чистий» шаблон.
  useEffect(() => {
    if (!user || !timezone) return;
    let cancelled = false;

    (async () => {
      const now = new Date();
      const to = new Date(now.getTime() + PREVIEW_DAYS * 86_400_000);
      const exceptions = await getSlotExceptions(
        user.uid,
        dateKeyInZone(now, timezone),
        dateKeyInZone(to, timezone)
      );
      if (cancelled) return;

      setPreviewSlots(
        materializeSlots({
          availability,
          exceptions,
          timezone,
          from: now,
          days: PREVIEW_DAYS,
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [user, timezone, availability]);

  if (loading) return <LoadingScreen label="Завантажуємо розклад…" />;
  if (!user) return null; // AuthGate не пускає сюди без користувача

  // Таймзона живе в профілі — без неї шаблон нема як розгорнути в конкретні
  // моменти, тож редактор без профілю просто не має сенсу.
  if (!timezone) {
    return (
      <div className="rounded-card border border-border bg-card p-10 text-center shadow-level1">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
          <TriangleAlert className="size-7" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="text-title-lg mb-2">Спершу заповніть профіль</h2>
        <p className="text-body-md mx-auto mb-6 max-w-md text-muted-foreground">
          Розклад спирається на ваш часовий пояс — його ви вказуєте в профілі.
        </p>
        <ButtonLink href="/tutor/profile" size="lg" className="rounded-full">
          До профілю
        </ButtonLink>
      </div>
    );
  }

  const conflicts = findConflicts(availability.weeklySlots, availability.bufferMin);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await saveAvailability(user.uid, availability);
      toast.success("Розклад збережено.");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося зберегти розклад.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <WeeklyEditor
          availability={availability}
          timezone={timezone}
          onChange={setAvailability}
        />

        <div className="flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            className="rounded-full"
            onClick={save}
            disabled={saving || conflicts.length > 0}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Зберегти шаблон
          </Button>
          {conflicts.length > 0 && (
            <span className="text-label-md text-terracotta">
              Спершу приберіть накладки — інакше учні побачать неможливі слоти.
            </span>
          )}
        </div>

        <ExceptionsEditor
          tutorId={user.uid}
          timezone={timezone}
          availability={availability}
        />
      </div>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <div className="rounded-card border border-border bg-card p-6 shadow-level1">
          <h2 className="text-title-lg mb-1">Найближчі два тижні</h2>
          <p className="text-body-md mb-5 text-muted-foreground">
            Так вільний час бачить учень.
          </p>
          <SlotList
            slots={previewSlots}
            tutorTimeZone={timezone}
            maxDays={PREVIEW_DAYS}
          />
        </div>
      </aside>
    </div>
  );
}

export default function TutorSchedulePage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Розклад доступності"
        description="Позначте, коли вам зручно проводити заняття. Учні бачитимуть цей час у власному часовому поясі."
      >
        <ScheduleEditor />
      </DashboardLayout>
    </AuthGate>
  );
}
