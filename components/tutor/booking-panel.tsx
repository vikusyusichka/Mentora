"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import { SlotList } from "@/components/tutor/slot-list";
import { ButtonLink } from "@/components/ui/button-link";
import { requestBooking } from "@/lib/firebase/booking-repo";
import { useAuth } from "@/lib/hooks/use-auth";
import type { MaterializedSlot } from "@/lib/availability";
import { formatTimeInZone } from "@/lib/timezone";

/**
 * Вибір слоту на публічній сторінці репетитора.
 *
 * Сам запит іде на `/api/bookings`: ціну, комісію й статус визначає сервер,
 * а браузер надсилає лише репетитора й час. Тому тут немає жодної логіки
 * про гроші — тільки те, що бачить і натискає учень.
 */
export function BookingPanel({
  tutorId,
  tutorTimeZone,
  slots,
}: {
  tutorId: string;
  tutorTimeZone: string;
  slots: MaterializedSlot[];
}) {
  const { user, role, status } = useAuth();
  const router = useRouter();
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Слот, який щойно забронювали, зникає одразу — не чекаючи перезавантаження.
  const available = slots.filter((s) => !bookedSlots.includes(s.startUtc));

  async function selectSlot(slot: MaterializedSlot) {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      toast.info("Щоб забронювати урок, увійдіть в акаунт.");
      router.push("/login");
      return;
    }

    if (role !== "student") {
      toast.error("Бронювати уроки можуть лише учні.");
      return;
    }

    if (!user) return;

    setPendingSlot(slot.startUtc);
    try {
      const idToken = await user.getIdToken();
      const result = await requestBooking(idToken, tutorId, slot.startUtc);

      if (!result.ok) {
        toast.error(result.error ?? "Не вдалося створити бронь.");
        // Слот міг зайняти хтось інший — прибираємо його зі списку,
        // щоб учень не бився в те саме місце.
        if (result.error?.includes("зайняли")) {
          setBookedSlots((prev) => [...prev, slot.startUtc]);
        }
        return;
      }

      setBookedSlots((prev) => [...prev, slot.startUtc]);
      toast.success(
        `Слот ${formatTimeInZone(new Date(slot.startUtc), tutorTimeZone)} за часом репетитора заброньовано.`
      );
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося звʼязатися з сервером.");
    } finally {
      setPendingSlot(null);
    }
  }

  return (
    <div className="space-y-5">
      <SlotList
        slots={available}
        tutorTimeZone={tutorTimeZone}
        onSelect={selectSlot}
        busySlot={pendingSlot}
      />

      {bookedSlots.length > 0 && (
        <div className="rounded-input bg-sage-green/10 p-4">
          <p className="text-label-md flex items-start gap-2 text-sage-green">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>
              Бронь створено. Слот тримається за вами обмежений час —
              завершіть оплату, щоб заняття підтвердилось.
            </span>
          </p>
          <ButtonLink href="/student" size="lg" className="mt-4 rounded-full">
            Перейти до оплати
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
