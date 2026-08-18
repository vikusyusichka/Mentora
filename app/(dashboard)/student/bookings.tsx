"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  type BookingWithId,
} from "@/lib/booking";
import { getStudentBookings } from "@/lib/firebase/booking-repo";
import { getPublicTutorProfile } from "@/lib/firebase/tutor-profile-repo";
import { browserTimeZone } from "@/lib/timezone";
import { formatPrice } from "@/lib/tutor-profile";
import { useAuth } from "@/lib/hooks/use-auth";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_payment: "bg-soft-gold text-secondary",
  confirmed: "bg-sage-green/10 text-sage-green",
  declined: "bg-terracotta/10 text-terracotta",
  cancelled: "bg-badge-neutral text-muted-foreground",
};

/**
 * Броні учня. Компонент рендериться лише за AuthGate, тобто завжди в
 * браузері — тому час можна одразу форматувати в зоні глядача.
 */
export function StudentBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithId[] | null>(null);
  const [tutorNames, setTutorNames] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);

  /**
   * Оплата — це перехід на сторінку провайдера. Підтвердження броні
   * прийде окремо, вебхуком: повернення учня в браузері нічого не
   * підтверджує й підтверджувати не має.
   */
  async function pay(bookingId: string) {
    if (!user) return;
    setPayingId(bookingId);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId }),
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        toast.error(data.error ?? "Не вдалося перейти до оплати.");
        setPayingId(null);
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося звʼязатися з сервером.");
      setPayingId(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const found = await getStudentBookings(user.uid);
        if (cancelled) return;
        setBookings(found);

        // Імена репетиторів читаються окремо: у броні лежить лише id,
        // а денормалізувати ім'я в бронь означало б тримати його свіжим.
        const ids = [...new Set(found.map((b) => b.tutorId))];
        const profiles = await Promise.all(ids.map(getPublicTutorProfile));
        if (cancelled) return;

        const names: Record<string, string> = {};
        ids.forEach((id, index) => {
          const name = profiles[index]?.displayName;
          if (name) names[id] = name;
        });
        setTutorNames(names);
      } catch (err) {
        console.error("[student] bookings", err);
        if (!cancelled) setBookings([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (bookings === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо бронювання…
      </p>
    );
  }

  if (bookings.length === 0) {
    return (
      <p className="text-body-md text-muted-foreground">
        Бронювань ще немає. Оберіть репетитора в каталозі й забронюйте зручний
        час.
      </p>
    );
  }

  const timeZone = browserTimeZone();
  const formatter = new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {bookings.map((booking) => (
          <li
            key={booking.id}
            className="rounded-input border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-label-md flex items-center gap-2 text-secondary">
                  <CalendarClock className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                  {formatter.format(new Date(booking.slotStart))}
                </p>
                <p className="text-label-sm mt-1 text-muted-foreground">
                  <Link
                    href={`/tutor/${booking.tutorId}`}
                    className="hover:text-secondary"
                  >
                    {tutorNames[booking.tutorId] ?? "Репетитор"}
                  </Link>
                  {" · "}
                  {booking.durationMin} хв
                  {booking.isTrial && " · пробний"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-label-md text-secondary">
                  {formatPrice(booking.amount, booking.currency)}
                </span>
                <span
                  className={`text-label-sm rounded-full px-3 py-1 ${STATUS_STYLES[booking.status]}`}
                >
                  {BOOKING_STATUS_LABELS[booking.status]}
                </span>
                {booking.status === "pending_payment" && (
                  <Button
                    size="lg"
                    className="rounded-full"
                    onClick={() => pay(booking.id)}
                    disabled={payingId !== null}
                  >
                    {payingId === booking.id && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Оплатити
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-label-sm text-outline">
        Час показано у вашому поясі ({timeZone}).
        {bookings.some((b) => b.status === "pending_payment") && (
          <> Слот тримається за вами обмежений час — неоплачена бронь звільняється.</>
        )}
      </p>
    </div>
  );
}
