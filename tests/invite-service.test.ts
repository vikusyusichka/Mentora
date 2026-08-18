import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Погашення коду — це видача доступу до чужих даних, тож перевіряємо саме
 * межі: чужий звʼязок, використаний код, протермінований, повторне
 * приєднання.
 */

const PROJECT_ID = "demo-mentora-invites";
process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.GCLOUD_PROJECT = PROJECT_ID;

const { adminDb } = await import("@/lib/firebase/admin");
const { createInvite, redeemInvite, InviteError } = await import(
  "@/lib/server/invite-service"
);

const db = adminDb();

const ENROLLMENT = "olena__marko";
const STUDENT = "marko";
const PARENT = "halyna";

async function seedEnrollment(parentUids: string[] = []) {
  await db.doc(`students/${ENROLLMENT}`).set({
    tutorId: "olena",
    studentUid: STUDENT,
    parentUids,
    name: "Марко Кравець",
    languages: ["Англійська"],
    currentLevel: "A2",
    goalLevel: "B2",
    goalText: "",
    totalNewWords: 0,
    lessonsCount: 0,
    createdAt: "2026-09-01T10:00:00.000Z",
  });
}

async function clearAll() {
  const invites = await db.collection("invites").get();
  await Promise.all(invites.docs.map((d) => d.ref.delete()));
  await db.doc(`students/${ENROLLMENT}`).delete();
}

beforeAll(clearAll);
beforeEach(clearAll);
afterAll(clearAll);

describe("створення коду", () => {
  it("учень створює код для свого звʼязку", async () => {
    await seedEnrollment();

    const { code, expiresAt } = await createInvite({
      studentUid: STUDENT,
      enrollmentId: ENROLLMENT,
    });

    expect(code).toHaveLength(8);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());

    const invite = (await db.doc(`invites/${code}`).get()).data();
    expect(invite?.enrollmentId).toBe(ENROLLMENT);
    expect(invite?.role).toBe("parent");
    expect(invite?.usedBy).toBeNull();
  });

  it("чужий звʼязок закритий", async () => {
    await seedEnrollment();
    await expect(
      createInvite({ studentUid: "petro", enrollmentId: ENROLLMENT })
    ).rejects.toBeInstanceOf(InviteError);
  });

  it("неіснуючий звʼязок дає помилку", async () => {
    await expect(
      createInvite({ studentUid: STUDENT, enrollmentId: "no-such" })
    ).rejects.toBeInstanceOf(InviteError);
  });

  it("два коди поспіль різні", async () => {
    await seedEnrollment();
    const first = await createInvite({ studentUid: STUDENT, enrollmentId: ENROLLMENT });
    const second = await createInvite({ studentUid: STUDENT, enrollmentId: ENROLLMENT });
    expect(first.code).not.toBe(second.code);
  });
});

describe("погашення коду", () => {
  it("батьки отримують доступ", async () => {
    await seedEnrollment();
    const { code } = await createInvite({
      studentUid: STUDENT,
      enrollmentId: ENROLLMENT,
    });

    const result = await redeemInvite({ parentUid: PARENT, code });
    expect(result.enrollmentId).toBe(ENROLLMENT);

    const enrollment = (await db.doc(`students/${ENROLLMENT}`).get()).data();
    expect(enrollment?.parentUids).toEqual([PARENT]);

    const invite = (await db.doc(`invites/${code}`).get()).data();
    expect(invite?.usedBy).toBe(PARENT);
    expect(invite?.usedAt).toBeTruthy();
  });

  it("код одноразовий", async () => {
    await seedEnrollment();
    const { code } = await createInvite({
      studentUid: STUDENT,
      enrollmentId: ENROLLMENT,
    });

    await redeemInvite({ parentUid: PARENT, code });
    await expect(
      redeemInvite({ parentUid: "inshyi-batko", code })
    ).rejects.toBeInstanceOf(InviteError);

    // Другий не потрапив у доступ.
    const enrollment = (await db.doc(`students/${ENROLLMENT}`).get()).data();
    expect(enrollment?.parentUids).toEqual([PARENT]);
  });

  it("неіснуючий код відхиляється", async () => {
    await seedEnrollment();
    await expect(
      redeemInvite({ parentUid: PARENT, code: "ZZZZ9999" })
    ).rejects.toBeInstanceOf(InviteError);
  });

  it("протермінований код відхиляється", async () => {
    await seedEnrollment();
    await db.doc("invites/EXPIRED1").set({
      enrollmentId: ENROLLMENT,
      studentUid: STUDENT,
      tutorId: "olena",
      role: "parent",
      createdBy: STUDENT,
      createdAt: "2026-01-01T10:00:00.000Z",
      expiresAt: "2026-01-08T10:00:00.000Z",
      usedBy: null,
      usedAt: null,
    });

    await expect(
      redeemInvite({ parentUid: PARENT, code: "EXPIRED1" })
    ).rejects.toBeInstanceOf(InviteError);
  });

  it("уже приєднаний батько не додається вдруге", async () => {
    await seedEnrollment([PARENT]);
    const { code } = await createInvite({
      studentUid: STUDENT,
      enrollmentId: ENROLLMENT,
    });

    await expect(
      redeemInvite({ parentUid: PARENT, code })
    ).rejects.toBeInstanceOf(InviteError);

    // Код лишився невикористаним — його ще можна віддати іншому.
    const invite = (await db.doc(`invites/${code}`).get()).data();
    expect(invite?.usedBy).toBeNull();
  });

  it("двоє батьків приєднуються різними кодами", async () => {
    await seedEnrollment();
    const first = await createInvite({ studentUid: STUDENT, enrollmentId: ENROLLMENT });
    const second = await createInvite({ studentUid: STUDENT, enrollmentId: ENROLLMENT });

    await redeemInvite({ parentUid: "mama", code: first.code });
    await redeemInvite({ parentUid: "tato", code: second.code });

    const enrollment = (await db.doc(`students/${ENROLLMENT}`).get()).data();
    expect(enrollment?.parentUids).toEqual(["mama", "tato"]);
  });
});
