import { adminAuth, adminDb } from "@/lib/firebase/admin";

// firebase-admin потребує Node.js runtime (на Edge не працює).
export const runtime = "nodejs";

const ROLES = ["tutor", "student", "parent"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Видає custom claim `role` на основі документа users/{uid}.
 *
 * Раніше це була Cloud Function, але вона потребує платного плану Blaze.
 * Тут та сама логіка на Vercel (безкоштовно). Модель безпеки не змінилась:
 *
 *  - uid беремо ВИКЛЮЧНО з перевіреного ID-токена, ніколи з тіла запиту;
 *  - джерело істини — документ users/{uid}, створений під Security Rules,
 *    які фіксують роль після створення;
 *  - роль незмінна: якщо claim уже стоїть і відрізняється — відмова.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!idToken) {
    return Response.json(
      { error: "Потрібно увійти в акаунт." },
      { status: 401 }
    );
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return Response.json({ error: "Недійсний токен." }, { status: 401 });
  }

  const snap = await adminDb.doc(`users/${uid}`).get();
  if (!snap.exists) {
    return Response.json(
      { error: "Профіль користувача не створено." },
      { status: 409 }
    );
  }

  const role = snap.get("role");
  if (!isRole(role)) {
    return Response.json({ error: "Невідома роль у профілі." }, { status: 400 });
  }

  const user = await adminAuth.getUser(uid);
  const existing = user.customClaims?.role as string | undefined;

  if (existing === role) {
    return Response.json({ role }); // ідемпотентно
  }
  if (existing) {
    return Response.json(
      { error: "Роль уже призначена й не може бути змінена." },
      { status: 409 }
    );
  }

  await adminAuth.setCustomUserClaims(uid, { role });
  return Response.json({ role });
}
