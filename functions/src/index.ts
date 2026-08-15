/**
 * Firebase Cloud Functions для Mentora.
 *
 * ⚠️ НЕ РОЗГОРНУТО. Cloud Functions вимагають платного плану Blaze, тож
 * видача ролей живе в `app/api/set-role/route.ts` (Next.js на Vercel) —
 * логіка та модель безпеки ідентичні. Ця функція лишається як референс
 * і буде задіяна, коли проєкт перейде на Blaze.
 *
 * Майбутні функції (теж потребуватимуть Blaze):
 *  - Блок B.3/B.4: платіжні вебхуки, створення enrollment
 *  - Блок C.2/D.1: денормалізовані лічильники, рейтинг
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

const auth = getAuth();
const db = getFirestore();

const ROLES = ["tutor", "student", "parent"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Ставить custom claim `role` на основі документа users/{uid}.
 * Джерело істини — Firestore-документ (створюється при онбордингу під
 * правилами, які фіксують роль після створення). Функція лише мірорить
 * роль у токен, щоб авторизація в правилах спиралася на claim.
 *
 * Роль незмінна: якщо claim уже призначено й він відрізняється — відмова.
 */
export const setUserRole = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Потрібно увійти в акаунт.");
  }

  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Профіль користувача не створено."
    );
  }

  const role = snap.get("role");
  if (!isRole(role)) {
    throw new HttpsError("invalid-argument", "Невідома роль у профілі.");
  }

  const user = await auth.getUser(uid);
  const existing = user.customClaims?.role as string | undefined;
  if (existing && existing !== role) {
    throw new HttpsError(
      "failed-precondition",
      "Роль уже призначена й не може бути змінена з клієнта."
    );
  }

  await auth.setCustomUserClaims(uid, { role });
  return { role };
});
