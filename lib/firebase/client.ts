// Клієнтський Firebase SDK (браузер). Ініціалізується один раз.
// У dev-режимі з NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true під'єднується до Emulator Suite.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from "firebase/storage";
import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions,
} from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);

/**
 * Під'єднання до емуляторів.
 *
 * Свідомо БЕЗ перевірки `typeof window`: цим самим SDK серверні компоненти
 * рендерять публічний каталог. Якби емулятори підключались лише в браузері,
 * `npm run emulators:dev` показував би каталог із бойового Firestore.
 *
 * Ознака «вже підключено» живе НА ОБ'ЄКТІ застосунку, а не на globalThis.
 * Next обчислює цей модуль кілька разів (окремі бандли під різні маршрути,
 * перекомпіляція в dev), і кожна копія має власний реєстр firebase/app —
 * тобто власні app і Firestore. Глобальний прапорець тоді «з'їдав» виклик
 * connect… для другої копії, і вона тихо йшла в бойовий проєкт. Спільний же
 * кеш самих інстансів дає гіршу біду: `doc()` з іншої копії SDK не впізнає
 * чужий Firestore і падає з invalid-argument. Прапорець на app коректний в
 * обох випадках: у межах однієї копії HMR не під'єднає емулятор двічі, а
 * різні копії налаштовують кожна свої інстанси.
 */
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
  const marker = app as unknown as { __mentoraEmulators?: boolean };
  if (!marker.__mentoraEmulators) {
    marker.__mentoraEmulators = true;
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
}

export { app, auth, db, storage, functions };
