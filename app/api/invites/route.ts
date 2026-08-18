export const runtime = "nodejs";

/**
 * Учень створює інвайт-код для батьків.
 *
 * Серверний роут, бо код — це право читати навчальний звʼязок. Клієнт
 * передає лише, до якого звʼязку код; що він належить саме цьому учневі,
 * перевіряє сервер.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return Response.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
  }

  let enrollmentId: string | null = null;
  try {
    const body = (await request.json()) as { enrollmentId?: unknown };
    if (typeof body.enrollmentId === "string") enrollmentId = body.enrollmentId;
  } catch {
    return Response.json({ error: "Некоректний запит." }, { status: 400 });
  }

  if (!enrollmentId) {
    return Response.json({ error: "Не вказано учня." }, { status: 400 });
  }

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const { createInvite, InviteError, INVITE_ERROR_MESSAGES } = await import(
      "@/lib/server/invite-service"
    );

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Недійсний токен." }, { status: 401 });
    }

    if (decoded.role !== "student") {
      return Response.json(
        { error: "Код для батьків створює учень." },
        { status: 403 }
      );
    }

    try {
      const invite = await createInvite({
        studentUid: decoded.uid,
        enrollmentId,
      });
      return Response.json(invite, { status: 201 });
    } catch (err) {
      if (err instanceof InviteError) {
        return Response.json(
          { error: INVITE_ERROR_MESSAGES[err.reason] },
          { status: err.reason === "not-your-enrollment" ? 403 : 400 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("[invites]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
