import "server-only";

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import type { Enrollment } from "@/lib/enrollment";
import {
  INVITE_LENGTH,
  INVITE_TTL_DAYS,
  generateCode,
  inviteProblem,
  type Invite,
  type InviteProblem,
} from "@/lib/invite";

/**
 * Створення й погашення інвайт-кодів (Блок C.4).
 *
 * Обидві операції серверні, бо обидві торкаються доступу: код — це право
 * читати чужий навчальний звʼязок, а `parentUids` — те саме поле, за яким
 * Security Rules вирішують, кого пускати. Дозволити клієнту писати його
 * означало б дозволити приєднатися до будь-якої дитини.
 */

export type InviteFailure =
  | "enrollment-not-found"
  | "not-your-enrollment"
  | InviteProblem
  | "already-joined";

export class InviteError extends Error {
  constructor(readonly reason: InviteFailure) {
    super(reason);
  }
}

export const INVITE_ERROR_MESSAGES: Record<InviteFailure, string> = {
  "enrollment-not-found": "Навчальний звʼязок не знайдено.",
  "not-your-enrollment": "Це не ваш навчальний звʼязок.",
  "not-found": "Такого коду не існує. Перевірте, чи правильно він введений.",
  "already-used": "Цим кодом уже скористалися. Попросіть новий.",
  expired: "Термін дії коду минув. Попросіть новий.",
  "already-joined": "Ви вже приєднані до цього учня.",
};

/** Учень створює код для свого звʼязку. */
export async function createInvite({
  studentUid,
  enrollmentId,
}: {
  studentUid: string;
  enrollmentId: string;
}): Promise<{ code: string; expiresAt: string }> {
  const db = adminDb();

  const snapshot = await db.doc(`students/${enrollmentId}`).get();
  if (!snapshot.exists) throw new InviteError("enrollment-not-found");

  const enrollment = snapshot.data() as Enrollment;
  if (enrollment.studentUid !== studentUid) {
    throw new InviteError("not-your-enrollment");
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + INVITE_TTL_DAYS * 86_400_000
  ).toISOString();

  const code = await reserveCode(async (candidate) => {
    const invite: Invite = {
      enrollmentId,
      studentUid,
      tutorId: enrollment.tutorId,
      role: "parent",
      createdBy: studentUid,
      createdAt: now.toISOString(),
      expiresAt,
      usedBy: null,
      usedAt: null,
    };

    // `create` падає, якщо документ уже існує — саме так і виявляється
    // збіг згенерованих кодів, без окремої перевірки-читання.
    await db.doc(`invites/${candidate}`).create(invite);
  });

  return { code, expiresAt };
}

/**
 * Кодів мало (8 символів із 31-символьної абетки), але збіг теоретично
 * можливий. Кілька спроб дешевші за складнішу схему.
 */
async function reserveCode(
  write: (candidate: string) => Promise<void>
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateCode(randomBytes(INVITE_LENGTH));
    try {
      await write(candidate);
      return candidate;
    } catch (err) {
      const code = (err as { code?: number | string }).code;
      const alreadyExists = code === 6 || code === "already-exists";
      if (!alreadyExists) throw err;
    }
  }
  throw new Error("Не вдалося згенерувати унікальний код.");
}

/** Батьки гасять код і отримують доступ на читання. */
export async function redeemInvite({
  parentUid,
  code,
}: {
  parentUid: string;
  code: string;
}): Promise<{ enrollmentId: string }> {
  const db = adminDb();
  const inviteRef = db.doc(`invites/${code}`);

  // Транзакція, бо код одноразовий: два одночасні погашення мають
  // розійтися так, щоб доступ отримав рівно один.
  const enrollmentId = await db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    const invite = inviteSnap.exists ? (inviteSnap.data() as Invite) : null;

    const problem = inviteProblem(invite);
    if (problem) throw new InviteError(problem);

    const enrollmentRef = db.doc(`students/${invite!.enrollmentId}`);
    const enrollmentSnap = await tx.get(enrollmentRef);
    if (!enrollmentSnap.exists) throw new InviteError("enrollment-not-found");

    const enrollment = enrollmentSnap.data() as Enrollment;
    if (enrollment.parentUids.includes(parentUid)) {
      throw new InviteError("already-joined");
    }

    tx.update(enrollmentRef, {
      parentUids: FieldValue.arrayUnion(parentUid),
    });
    tx.update(inviteRef, {
      usedBy: parentUid,
      usedAt: new Date().toISOString(),
    });

    return invite!.enrollmentId;
  });

  return { enrollmentId };
}
