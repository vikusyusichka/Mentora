export const runtime = "nodejs";

import { isValidCodeShape, normalizeCode } from "@/lib/invite";

/**
 * Батьки гасять код і отримують доступ на читання.
 *
 * Запис у `parentUids` — це саме те поле, за яким Security Rules
 * вирішують, кого пускати до навчального звʼязку. Тому операція серверна:
 * інакше будь-хто міг би дописати себе до будь-якої дитини.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return Response.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
  }

  let code: string | null = null;
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = normalizeCode(body.code);
  } catch {
    return Response.json({ error: "Некоректний запит." }, { status: 400 });
  }

  if (!code || !isValidCodeShape(code)) {
    return Response.json(
      { error: "Код складається з 8 символів. Перевірте, чи всі введені." },
      { status: 400 }
    );
  }

  try {
    const { adminAuth } = await import("@/lib/firebase/admin");
    const { redeemInvite, InviteError, INVITE_ERROR_MESSAGES } = await import(
      "@/lib/server/invite-service"
    );

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Недійсний токен." }, { status: 401 });
    }

    if (decoded.role !== "parent") {
      return Response.json(
        { error: "Приєднатися за кодом можуть лише батьки." },
        { status: 403 }
      );
    }

    try {
      const result = await redeemInvite({ parentUid: decoded.uid, code });
      return Response.json(result);
    } catch (err) {
      if (err instanceof InviteError) {
        return Response.json(
          { error: INVITE_ERROR_MESSAGES[err.reason] },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("[invites/redeem]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
