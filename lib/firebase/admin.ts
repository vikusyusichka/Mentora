import "server-only";
// Admin SDK для серверних частин Next.js (route handlers, server actions).
// У режимі емуляторів під'єднується автоматично через змінні
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cached: App | undefined;

/**
 * Ініціалізація ЛІНИВА і навмисно не на рівні модуля.
 *
 * Next.js під час збірки збирає дані для роутів, тобто виконує імпорти.
 * Якби перевірка облікових даних жила в тілі модуля, відсутня змінна
 * оточення валила б увесь білд — і сайт не деплоївся б цілком, замість
 * того щоб зламатись лише один ендпоінт. Тому перевіряємо на першому
 * реальному запиті.
 */
function adminApp(): App {
  if (cached) return cached;
  if (getApps().length) {
    cached = getApp();
    return cached;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Продакшн: сервісний акаунт у змінній оточення (JSON-рядок).
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY містить некоректний JSON. " +
          "Має бути весь вміст .json-файлу сервісного акаунта — від { до }."
      );
    }
    cached = initializeApp({ credential: cert(serviceAccount), projectId });
    return cached;
  }

  // Емулятори: облікові дані не потрібні, достатньо projectId.
  const usingEmulators =
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (!usingEmulators) {
    throw new Error(
      "Не задано FIREBASE_SERVICE_ACCOUNT_KEY. Додай його у змінні оточення " +
        "(Vercel → Settings → Environment Variables) — без нього сервер " +
        "не може перевіряти токени й видавати ролі."
    );
  }

  cached = initializeApp({ projectId });
  return cached;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}
