import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import type { TutorProfile, TutorProfileInput } from "@/lib/tutor-profile";

const COLLECTION = "tutorProfiles";

export async function getTutorProfile(
  tutorId: string
): Promise<TutorProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, tutorId));
  return snap.exists() ? (snap.data() as TutorProfile) : null;
}

/**
 * Створює або оновлює профіль.
 * Серверні поля (ratingAvg/ratingCount/payoutAccountId) НЕ надсилаються:
 * при створенні рейтинг ініціалізується нулями, при оновленні не чіпається.
 * Security Rules це підстраховують.
 */
export async function saveTutorProfile(
  tutorId: string,
  input: TutorProfileInput,
  isPublished: boolean
): Promise<void> {
  const refDoc = doc(db, COLLECTION, tutorId);
  const existing = await getDoc(refDoc);

  if (existing.exists()) {
    await updateDoc(refDoc, { ...input, isPublished });
    return;
  }

  await setDoc(refDoc, {
    ...input,
    isPublished,
    ratingAvg: 0,
    ratingCount: 0,
  });
}

/** Перемикає публікацію без повного збереження форми. */
export function setPublished(tutorId: string, isPublished: boolean) {
  return updateDoc(doc(db, COLLECTION, tutorId), { isPublished });
}

/**
 * Завантажує фото у Storage і повертає публічний URL.
 *
 * ЗАРАЗ НЕ ВИКОРИСТОВУЄТЬСЯ: Cloud Storage вимагає платного плану Blaze,
 * тож у формі профілю фото задається посиланням. Функція і `storage.rules`
 * лишаються в репозиторії — щоб увімкнути завантаження файлом, достатньо
 * перевести проєкт на Blaze й повернути файловий інпут у формі.
 */
export async function uploadTutorPhoto(
  tutorId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storageRef = ref(storage, `tutorPhotos/${tutorId}/avatar.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
