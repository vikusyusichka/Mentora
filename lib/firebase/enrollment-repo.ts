import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  Enrollment,
  EnrollmentWithId,
  Lesson,
  LessonWithId,
} from "@/lib/enrollment";

/**
 * Навчальні звʼязки та уроки. Читаються під Security Rules: доступ дає
 * сам документ enrollment (`tutorId` / `studentUid` / `parentUids`).
 */

async function enrollmentsWhere(
  field: "tutorId" | "studentUid",
  uid: string
): Promise<EnrollmentWithId[]> {
  const snapshot = await getDocs(
    query(collection(db, "students"), where(field, "==", uid), limit(100))
  );
  return snapshot.docs.map((snap) => ({
    id: snap.id,
    ...(snap.data() as Enrollment),
  }));
}

export function getTutorEnrollments(tutorId: string) {
  return enrollmentsWhere("tutorId", tutorId);
}

export function getStudentEnrollments(studentUid: string) {
  return enrollmentsWhere("studentUid", studentUid);
}

/** Батьки бачать дитину через `parentUids`. */
export async function getParentEnrollments(
  parentUid: string
): Promise<EnrollmentWithId[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "students"),
      where("parentUids", "array-contains", parentUid),
      limit(100)
    )
  );
  return snapshot.docs.map((snap) => ({
    id: snap.id,
    ...(snap.data() as Enrollment),
  }));
}

/**
 * Найближчі уроки за всіма звʼязками.
 *
 * Запити йдуть по кожному enrollment окремо: collection group зажадав би
 * окремого індексу й окремих правил, а звʼязків у одного користувача
 * одиниці — вигоди не було б.
 */
export async function getUpcomingLessons(
  enrollmentIds: readonly string[],
  perEnrollment = 20
): Promise<LessonWithId[]> {
  const nowIso = new Date().toISOString();

  const results = await Promise.all(
    enrollmentIds.map(async (enrollmentId) => {
      const snapshot = await getDocs(
        query(
          collection(db, "students", enrollmentId, "lessons"),
          where("slotStart", ">=", nowIso),
          orderBy("slotStart", "asc"),
          limit(perEnrollment)
        )
      );
      return snapshot.docs.map((snap) => ({
        id: snap.id,
        enrollmentId,
        ...(snap.data() as Lesson),
      }));
    })
  );

  return results
    .flat()
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
}
