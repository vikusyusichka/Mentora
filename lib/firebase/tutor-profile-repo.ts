import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { buildFilterTags, cityKeyOf } from "@/lib/catalog";
import type { TutorProfile, TutorProfileInput } from "@/lib/tutor-profile";

const COLLECTION = "tutorProfiles";

export async function getTutorProfile(
  tutorId: string
): Promise<TutorProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, tutorId));
  return snap.exists() ? (snap.data() as TutorProfile) : null;
}

/**
 * Профіль для публічної сторінки. Повертає `null` і коли документа немає,
 * і коли він не опублікований: у другому випадку Security Rules самі
 * відхиляють читання, і для гостя ці два стани нерозрізненні за задумом —
 * чернетка не має «світитися» навіть фактом свого існування.
 */
export async function getPublicTutorProfile(
  tutorId: string
): Promise<TutorProfile | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, tutorId));
    if (!snap.exists()) return null;
    const profile = snap.data() as TutorProfile;
    return profile.isPublished ? profile : null;
  } catch (err) {
    // Відмова правил на чернетці — очікуваний сценарій, але мережеві збої
    // й проблеми конфігурації виглядають так само. Лишаємо слід у логах.
    console.error("[tutor-profile] read", tutorId, err);
    return null;
  }
}

/**
 * Поля, які існують лише заради фільтрів каталогу. Похідні від форми,
 * тож перераховуються при кожному збереженні — інакше профіль знайдеться
 * за старою мовою або старим містом.
 */
function catalogFields(input: TutorProfileInput) {
  return {
    filterTags: buildFilterTags(input),
    cityKey: cityKeyOf(input.city),
  };
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
    await updateDoc(refDoc, { ...input, ...catalogFields(input), isPublished });
    return;
  }

  await setDoc(refDoc, {
    ...input,
    ...catalogFields(input),
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
