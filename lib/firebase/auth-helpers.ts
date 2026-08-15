import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

const googleProvider = new GoogleAuthProvider();

export function registerWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Вхід із вибором тривалості сесії:
 *  remember=true  → browserLocalPersistence (сесія живе між перезапусками)
 *  remember=false → browserSessionPersistence (лише поточна вкладка)
 */
export async function loginWithEmail(
  email: string,
  password: string,
  remember = false
) {
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence
  );
  return signInWithEmailAndPassword(auth, email, password);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

/** Надсилає лист для скидання пароля. */
export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function logout() {
  return signOut(auth);
}

/** Повертає документ users/{uid} або null, якщо профіль ще не створено. */
export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Завершує онбординг:
 *  1) створює users/{uid} з роллю та профілем (під Security Rules),
 *  2) викликає /api/set-role, що мірорить роль у custom claim,
 *  3) оновлює токен, щоб claim одразу став доступним клієнту.
 *
 * Роут на Vercel, а не Cloud Function: функції потребують платного
 * плану Blaze, а модель безпеки тут ідентична.
 */
export async function completeOnboarding(
  user: User,
  role: Role,
  displayName: string
): Promise<Role> {
  const name = displayName.trim();

  if (name && user.displayName !== name) {
    await updateProfile(user, { displayName: name });
  }

  await setDoc(doc(db, "users", user.uid), {
    role,
    displayName: name || user.displayName || "",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    createdAt: serverTimestamp(),
  });

  // ID-токен доводить серверу, хто ми, — uid він бере лише звідти.
  const idToken = await user.getIdToken();
  const res = await fetch("/api/set-role", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? "Не вдалося призначити роль.");
  }

  const data = (await res.json()) as { role: Role };

  await user.getIdToken(true); // оновити claims у поточному токені
  return data.role;
}
