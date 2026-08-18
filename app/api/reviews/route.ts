export const runtime = "nodejs";

import { isValidRating } from "@/lib/review";

/**
 * Учень лишає або оновлює відгук.
 *
 * Клієнт надсилає лише репетитора, оцінку й текст. Чи має він право
 * оцінювати (був проведений урок) і як це впливає на рейтинг — вирішує
 * сервер: `ratingAvg` визначає позицію в каталозі.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return Response.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
  }

  let tutorId: string | null = null;
  let rating = 0;
  let text = "";

  try {
    const body = (await request.json()) as {
      tutorId?: unknown;
      rating?: unknown;
      text?: unknown;
    };
    if (typeof body.tutorId === "string") tutorId = body.tutorId;
    if (typeof body.rating === "number") rating = body.rating;
    if (typeof body.text === "string") text = body.text.trim();
  } catch {
    return Response.json({ error: "Некоректний запит." }, { status: 400 });
  }

  if (!tutorId) {
    return Response.json({ error: "Не вказано репетитора." }, { status: 400 });
  }
  if (!isValidRating(rating)) {
    return Response.json(
      { error: "Оцінка — ціле число від 1 до 5." },
      { status: 400 }
    );
  }
  if (text.length > 1500) {
    return Response.json({ error: "Занадто довгий відгук." }, { status: 400 });
  }

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const { submitReview, ReviewError, REVIEW_ERROR_MESSAGES } = await import(
      "@/lib/server/review-service"
    );

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Недійсний токен." }, { status: 401 });
    }

    if (decoded.role !== "student") {
      return Response.json(
        { error: "Відгук лишає учень." },
        { status: 403 }
      );
    }

    try {
      const result = await submitReview({
        studentUserId: decoded.uid,
        tutorId,
        rating,
        text,
      });
      return Response.json(result);
    } catch (err) {
      if (err instanceof ReviewError) {
        return Response.json(
          { error: REVIEW_ERROR_MESSAGES[err.reason] },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("[reviews]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
