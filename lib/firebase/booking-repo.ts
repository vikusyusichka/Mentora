import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  holdIsActive,
  type Booking,
  type BookingWithId,
  type BusySlot,
} from "@/lib/booking";

/**
 * Зайняті слоти репетитора за проміжком часу.
 *
 * Читається публічно (правила дозволяють для опублікованих профілів), бо
 * без цього гість бачив би в календарі вже зайнятий час. Прострочені
 * утримання відсіюємо тут: фонового прибирання немає, тож «протухла»
 * бронь просто перестає займати слот.
 */
export async function getBusySlotStarts(
  tutorId: string,
  fromIso: string,
  toIso: string,
  now: Date = new Date()
): Promise<Set<string>> {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "tutorProfiles", tutorId, "busySlots"),
        where("slotStart", ">=", fromIso),
        where("slotStart", "<=", toIso),
        limit(500)
      )
    );

    const busy = new Set<string>();
    for (const snap of snapshot.docs) {
      const lock = snap.data() as BusySlot;
      if (holdIsActive(lock, now)) busy.add(lock.slotStart);
    }
    return busy;
  } catch (err) {
    console.error("[bookings] busy slots", tutorId, err);
    return new Set();
  }
}

/** Броні учня — від найближчої. */
export async function getStudentBookings(
  studentUserId: string,
  max = 20
): Promise<BookingWithId[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "bookings"),
      where("studentUserId", "==", studentUserId),
      orderBy("slotStart", "asc"),
      limit(max)
    )
  );

  return snapshot.docs.map((snap) => ({
    id: snap.id,
    ...(snap.data() as Booking),
  }));
}

export interface BookingRequestResult {
  ok: boolean;
  bookingId?: string;
  error?: string;
}

/**
 * Просить сервер створити бронь. Тіло навмисно мінімальне — ціну, комісію
 * й статус визначає виключно сервер.
 */
export async function requestBooking(
  idToken: string,
  tutorId: string,
  slotStart: string
): Promise<BookingRequestResult> {
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ tutorId, slotStart }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    bookingId?: string;
    error?: string;
  };

  if (!response.ok) {
    return { ok: false, error: data.error ?? "Не вдалося створити бронь." };
  }
  return { ok: true, bookingId: data.bookingId };
}
