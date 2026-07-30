import "server-only";
// Admin SDK для серверних частин Next.js (route handlers, server actions).
// У режимі емуляторів під'єднується автоматично через змінні
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST / STORAGE_EMULATOR_HOST.
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function createAdminApp(): App {
  if (getApps().length) return getApp();

  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Продакшн: сервісний акаунт у змінній оточення (JSON-рядок).
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  // Емулятори / середовища з ADC — досить projectId.
  return initializeApp({ projectId });
}

const adminApp = createAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
