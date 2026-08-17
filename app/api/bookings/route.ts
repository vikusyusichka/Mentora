// Admin SDK потребує Node.js runtime (на Edge не працює).
export const runtime = "nodejs";

/**
 * Створення броні.
 *
 * Логіка на сервері не з міркувань зручності: клієнт не має права
 * визначати ані ціну, ані комісію, ані статус броні, ані те, чи слот
 * узагалі існує в розкладі. Тіло запиту містить лише репетитора й час —
 * решту сервер обчислює сам.
 *
 * Admin SDK підвантажується динамічно всередині обробника: статичний
 * import валив би роут ще до нашого коду, і клієнт отримував би німу 500
 * замість читабельної причини.
 */

interface BookingRequest {
  tutorId?: unknown;
  slotStart?: unknown;
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!idToken) {
    return badRequest("Щоб забронювати урок, увійдіть в акаунт.", 401);
  }

  let body: BookingRequest;
  try {
    body = (await request.json()) as BookingRequest;
  } catch {
    return badRequest("Некоректний запит.");
  }

  const tutorId = typeof body.tutorId === "string" ? body.tutorId : null;
  const slotStart = typeof body.slotStart === "string" ? body.slotStart : null;

  if (!tutorId || !slotStart || Number.isNaN(Date.parse(slotStart))) {
    return badRequest("Не вказано репетитора або час уроку.");
  }

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const {
      createBooking,
      BookingError,
      BOOKING_ERROR_MESSAGES,
    } = await import("@/lib/server/booking-service");

    const auth = adminAuth();

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      return badRequest("Недійсний токен.", 401);
    }

    // Роль беремо з токена, а не з тіла запиту: claim ставить сервер,
    // підробити його з клієнта неможливо.
    if (decoded.role !== "student") {
      return badRequest("Бронювати уроки можуть лише учні.", 403);
    }

    try {
      const { bookingId, booking } = await createBooking({
        studentUserId: decoded.uid,
        tutorId,
        slotStart,
      });
      return Response.json({ bookingId, booking }, { status: 201 });
    } catch (err) {
      if (err instanceof BookingError) {
        // «Слот зайняли» — не помилка клієнта, а стан світу: 409.
        const status = err.reason === "slot-taken" ? 409 : 400;
        return badRequest(BOOKING_ERROR_MESSAGES[err.reason], status);
      }
      throw err;
    }
  } catch (err) {
    console.error("[bookings]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
