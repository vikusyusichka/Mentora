// firebase-admin потребує Node.js runtime (на Edge не працює).
export const runtime = "nodejs";

/**
 * Admin SDK підвантажується динамічно всередині обробника.
 *
 * Статичний import означав би, що будь-яка проблема із завантаженням
 * модуля (брак змінної оточення, несумісність пакета) валить увесь роут
 * ще до нашого коду — і клієнт отримує німу 500 без пояснення.
 * З динамічним import така помилка потрапляє в наш catch і повертається
 * читабельним JSON.
 */
async function admin() {
  return import("@/lib/firebase/admin");
}

const ROLES = ["tutor", "student", "parent"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Перевірка конфігурації сервера. Не віддає жодних секретів — лише
 * чи вдалося ініціалізувати Admin SDK, і якщо ні, то чого бракує.
 * Потрібна, щоб діагностувати деплой без доступу до логів хостингу.
 */
export async function GET() {
  try {
    const { adminAuth } = await admin();
    adminAuth();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Невідома помилка.",
      },
      { status: 500 }
    );
  }
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

  try {
    const { adminAuth, adminDb } = await admin();
    // Ініціалізація ЗЗОВНІ внутрішнього try: інакше помилка конфігурації
    // (напр. відсутній ключ) видавалася б за «недійсний токен».
    const auth = adminAuth();
    const db = adminDb();

    let uid: string;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return Response.json({ error: "Недійсний токен." }, { status: 401 });
    }

    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) {
      return Response.json(
        { error: "Профіль користувача не створено." },
        { status: 409 }
      );
    }

    const role = snap.get("role");
    if (!isRole(role)) {
      return Response.json(
        { error: "Невідома роль у профілі." },
        { status: 400 }
      );
    }

    const user = await auth.getUser(uid);
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

    await auth.setCustomUserClaims(uid, { role });
    return Response.json({ role });
  } catch (err) {
    // Помилки конфігурації сервера — не секрети, а підказки, чого бракує.
    console.error("[set-role]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
