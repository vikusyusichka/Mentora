import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

const PROJECT_ID = "demo-mentora";
const rules = readFileSync(
  fileURLToPath(new URL("../firestore.rules", import.meta.url)),
  "utf8"
);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function profile(overrides: Record<string, unknown> = {}) {
  return {
    role: "student",
    displayName: "Тест",
    email: "test@example.com",
    photoURL: "",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

/** Записує документ в обхід правил (для підготовки стану). */
async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe("users — створення", () => {
  it("власник створює свій профіль із валідною роллю", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(db, "users/alice"), profile()));
  });

  it("відхиляє невідому роль", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/alice"), profile({ role: "admin" })));
  });

  it("відхиляє зайві поля", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(db, "users/alice"), profile({ isAdmin: true }))
    );
  });

  it("не можна створити чужий профіль", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "users/bob"), profile()));
  });

  it("неавторизований не може створювати", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "users/alice"), profile()));
  });
});

describe("users — читання", () => {
  it("власник читає свій профіль", async () => {
    await seed("users/alice", profile());
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "users/alice")));
  });

  it("чужий профіль читати не можна", async () => {
    await seed("users/bob", profile());
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db, "users/bob")));
  });
});

describe("users — оновлення та видалення", () => {
  it("можна оновити ім'я, не змінюючи роль", async () => {
    await seed("users/alice", { ...profile(), createdAt: new Date() });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users/alice"), {
        ...profile({ displayName: "Нове ім'я" }),
        createdAt: new Date(),
      })
    );
  });

  it("не можна змінити роль з клієнта", async () => {
    await seed("users/alice", { ...profile(), createdAt: new Date() });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(db, "users/alice"), {
        ...profile({ role: "tutor" }),
        createdAt: new Date(),
      })
    );
  });

  it("видалення заборонено", async () => {
    await seed("users/alice", { ...profile(), createdAt: new Date() });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(deleteDoc(doc(db, "users/alice")));
  });
});

describe("інші колекції закриті за замовчуванням", () => {
  it("не можна читати довільну колекцію", async () => {
    await seed("bookings/x", { foo: 1 });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db as Firestore, "bookings/x")));
  });
});
