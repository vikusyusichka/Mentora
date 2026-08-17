export const runtime = "nodejs";

/**
 * Створює сторінку оплати для вже існуючої броні.
 *
 * У тілі — лише `bookingId`. Суму, комісію й провайдера сервер бере з
 * броні та профілю репетитора: клієнт не може ані здешевити урок, ані
 * обнулити комісію платформи.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!idToken) {
    return Response.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
  }

  let bookingId: string | null = null;
  try {
    const body = (await request.json()) as { bookingId?: unknown };
    if (typeof body.bookingId === "string") bookingId = body.bookingId;
  } catch {
    return Response.json({ error: "Некоректний запит." }, { status: 400 });
  }

  if (!bookingId) {
    return Response.json({ error: "Не вказано бронь." }, { status: 400 });
  }

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const { startCheckout, CheckoutError, CHECKOUT_ERROR_MESSAGES } =
      await import("@/lib/server/payment-service");

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Недійсний токен." }, { status: 401 });
    }

    try {
      const { url } = await startCheckout({
        bookingId,
        studentUserId: decoded.uid,
        origin: new URL(request.url).origin,
      });
      return Response.json({ url });
    } catch (err) {
      if (err instanceof CheckoutError) {
        return Response.json(
          { error: CHECKOUT_ERROR_MESSAGES[err.reason] },
          { status: err.reason === "not-your-booking" ? 403 : 400 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("[payments/checkout]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
