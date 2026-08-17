export const runtime = "nodejs";

import { z } from "zod";

/**
 * Звіт після уроку.
 *
 * Роут потрібен саме через лічильники учня: правила забороняють клієнту
 * їх писати, бо це підсумок навчання, а не поле форми. Усе інше в звіті
 * репетитор міг би записати й напряму — але тоді звіт і лічильники
 * оновлювалися б різними операціями, і невдача другої лишала б цифри
 * розсинхронізованими.
 */

const bodySchema = z.object({
  enrollmentId: z.string().min(1),
  lessonId: z.string().min(1),
  report: z.object({
    topic: z.string().trim().min(2, "Вкажіть тему").max(200),
    newWordsCount: z.number().int().min(0).max(1000),
    speakingPractice: z.boolean(),
    noteForStudent: z.string().trim().max(2000),
  }),
  homework: z
    .object({
      text: z.string().trim().min(3).max(2000),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата у форматі РРРР-ММ-ДД"),
    })
    .nullish(),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return Response.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Некоректні дані звіту." },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return Response.json({ error: "Некоректний запит." }, { status: 400 });
  }

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const { applyLessonReport, ReportError, REPORT_ERROR_MESSAGES } =
      await import("@/lib/server/lesson-service");

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Недійсний токен." }, { status: 401 });
    }

    if (decoded.role !== "tutor") {
      return Response.json(
        { error: "Звіт може лишити лише репетитор." },
        { status: 403 }
      );
    }

    try {
      await applyLessonReport({
        tutorUid: decoded.uid,
        enrollmentId: body.enrollmentId,
        lessonId: body.lessonId,
        report: body.report,
        homework: body.homework ?? null,
      });
      return Response.json({ ok: true });
    } catch (err) {
      if (err instanceof ReportError) {
        return Response.json(
          { error: REPORT_ERROR_MESSAGES[err.reason] },
          { status: err.reason === "not-your-student" ? 403 : 400 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("[lessons/report]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
