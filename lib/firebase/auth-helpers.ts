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
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase/client";
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
 *  2) викликає Cloud Function setUserRole, що мірорить роль у custom claim,
 *  3) оновлює токен, щоб claim одразу став доступним клієнту.
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

  const setUserRole = httpsCallable<void, { role: Role }>(
    functions,
    "setUserRole"
  );
  const res = await setUserRole();

  await user.getIdToken(true); // оновити claims у поточному токені
  return res.data.role;
}
