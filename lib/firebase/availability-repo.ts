import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  EMPTY_AVAILABILITY,
  type Availability,
  type SlotException,
} from "@/lib/availability";

/**
 * Тижневий шаблон — один документ у підколекції: розклад завжди читається
 * і пишеться цілком, тож дробити його на документи нема сенсу.
 */
const WEEKLY_DOC = "weekly";

function availabilityRef(tutorId: string) {
  return doc(db, "tutorProfiles", tutorId, "availability", WEEKLY_DOC);
}

function exceptionsRef(tutorId: string) {
  return collection(db, "tutorProfiles", tutorId, "slotExceptions");
}

/**
 * Розклад репетитора. `null` означає «недоступний»: або розкладу ще немає,
 * або профіль неопублікований і правила не дали його прочитати.
 */
export async function getAvailability(
  tutorId: string
): Promise<Availability | null> {
  try {
    const snap = await getDoc(availabilityRef(tutorId));
    return snap.exists() ? (snap.data() as Availability) : null;
  } catch (err) {
    console.error("[availability] read", tutorId, err);
    return null;
  }
}

/** Те саме, але для форми: відсутній розклад — це порожній розклад. */
export async function getAvailabilityOrEmpty(
  tutorId: string
): Promise<Availability> {
  return (await getAvailability(tutorId)) ?? EMPTY_AVAILABILITY;
}

export function saveAvailability(
  tutorId: string,
  availability: Availability
): Promise<void> {
  return setDoc(availabilityRef(tutorId), availability);
}

/**
 * Винятки за діапазоном дат. Ключі документів — `YYYY-MM-DD`, тож діапазон
 * задається порівнянням самих ідентифікаторів: лексикографічний порядок
 * для цього формату збігається з хронологічним.
 */
export async function getSlotExceptions(
  tutorId: string,
  fromKey: string,
  toKey: string
): Promise<Record<string, SlotException>> {
  try {
    const snapshot = await getDocs(
      query(
        exceptionsRef(tutorId),
        where(documentId(), ">=", fromKey),
        where(documentId(), "<=", toKey),
        limit(400)
      )
    );

    const result: Record<string, SlotException> = {};
    for (const snap of snapshot.docs) {
      const data = snap.data() as Partial<SlotException>;
      result[snap.id] = {
        blocked: data.blocked ?? [],
        extra: data.extra ?? [],
      };
    }
    return result;
  } catch (err) {
    console.error("[availability] exceptions", tutorId, err);
    return {};
  }
}

/**
 * Порожній виняток видаляємо, а не зберігаємо: інакше в підколекції
 * накопичувалися б документи-пустушки, які нічого не змінюють.
 */
export function saveSlotException(
  tutorId: string,
  dateKey: string,
  exception: SlotException
): Promise<void> {
  const ref = doc(exceptionsRef(tutorId), dateKey);
  if (exception.blocked.length === 0 && exception.extra.length === 0) {
    return deleteDoc(ref);
  }
  return setDoc(ref, exception);
}
