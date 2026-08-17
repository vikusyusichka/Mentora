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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const PROJECT_ID = "demo-mentora-bookings";
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

function asTutor(uid: string) {
  return testEnv.authenticatedContext(uid, { role: "tutor" }).firestore();
}
function asStudent(uid: string) {
  return testEnv.authenticatedContext(uid, { role: "student" }).firestore();
}
function asGuest() {
  return testEnv.unauthenticatedContext().firestore();
}

function bookingData(overrides: Record<string, unknown> = {}) {
  return {
    studentUserId: "marko",
    tutorId: "olena",
    slotStart: "2026-09-07T15:00:00.000Z",
    durationMin: 60,
    isTrial: false,
    status: "pending_payment",
    amount: 500,
    currency: "UAH",
    platformFee: 50,
    paymentId: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    holdUntil: "2026-09-01T10:20:00.000Z",
    ...overrides,
  };
}

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

async function seedProfile(tutorId: string, isPublished: boolean) {
  await seed(`tutorProfiles/${tutorId}`, {
    displayName: "Олена Вчителька",
    bio: "Викладаю англійську десять років.",
    languages: ["Англійська"],
    levelsTaught: ["B1"],
    pricePerLesson: 500,
    currency: "UAH",
    format: "online",
    timezone: "Europe/Kyiv",
    trialPrice: 0,
    ratingAvg: 0,
    ratingCount: 0,
    isPublished,
  });
}

describe("bookings — запис закритий для клієнта", () => {
  it("учень не може створити бронь напряму", async () => {
    await assertFails(
      setDoc(doc(asStudent("marko"), "bookings/b1"), bookingData())
    );
  });

  it("репетитор не може створити бронь напряму", async () => {
    await assertFails(
      setDoc(doc(asTutor("olena"), "bookings/b1"), bookingData())
    );
  });

  it("учасник не може підтвердити бронь сам собі", async () => {
    await seed("bookings/b1", bookingData());
    await assertFails(
      updateDoc(doc(asStudent("marko"), "bookings/b1"), { status: "confirmed" })
    );
  });

  it("репетитор не може змінити суму", async () => {
    await seed("bookings/b1", bookingData());
    await assertFails(
      updateDoc(doc(asTutor("olena"), "bookings/b1"), { amount: 1 })
    );
  });

  it("видалення заборонено", async () => {
    await seed("bookings/b1", bookingData());
    await assertFails(deleteDoc(doc(asStudent("marko"), "bookings/b1")));
  });
});

describe("bookings — читання", () => {
  it("учень читає свою бронь", async () => {
    await seed("bookings/b1", bookingData());
    await assertSucceeds(getDoc(doc(asStudent("marko"), "bookings/b1")));
  });

  it("репетитор читає адресовану йому бронь", async () => {
    await seed("bookings/b1", bookingData());
    await assertSucceeds(getDoc(doc(asTutor("olena"), "bookings/b1")));
  });

  it("сторонній не читає чужу бронь", async () => {
    await seed("bookings/b1", bookingData());
    await assertFails(getDoc(doc(asStudent("petro"), "bookings/b1")));
  });

  it("гість не читає бронь", async () => {
    await seed("bookings/b1", bookingData());
    await assertFails(getDoc(doc(asGuest(), "bookings/b1")));
  });

  it("учень перелічує свої брони", async () => {
    await seed("bookings/b1", bookingData());
    await assertSucceeds(
      getDocs(
        query(
          collection(asStudent("marko"), "bookings"),
          where("studentUserId", "==", "marko")
        )
      )
    );
  });

  it("запит без фільтра за собою відхиляється", async () => {
    await seed("bookings/b1", bookingData());
    await assertFails(getDocs(collection(asStudent("marko"), "bookings")));
  });

  it("не можна перелічити чужі брони", async () => {
    await seed("bookings/b1", bookingData());
    await assertFails(
      getDocs(
        query(
          collection(asStudent("petro"), "bookings"),
          where("studentUserId", "==", "marko")
        )
      )
    );
  });
});

describe("busySlots — публічна зайнятість", () => {
  const lock = {
    bookingId: "b1",
    status: "pending_payment",
    holdUntil: "2026-09-01T10:20:00.000Z",
    slotStart: "2026-09-07T15:00:00.000Z",
  };

  it("гість бачить зайнятість опублікованого репетитора", async () => {
    await seedProfile("olena", true);
    await seed("tutorProfiles/olena/busySlots/1757257200000", lock);
    await assertSucceeds(
      getDoc(doc(asGuest(), "tutorProfiles/olena/busySlots/1757257200000"))
    );
  });

  it("гість не бачить зайнятість чернетки", async () => {
    await seedProfile("olena", false);
    await seed("tutorProfiles/olena/busySlots/1757257200000", lock);
    await assertFails(
      getDoc(doc(asGuest(), "tutorProfiles/olena/busySlots/1757257200000"))
    );
  });

  it("навіть власник не може писати зайнятість — це робить сервер", async () => {
    await seedProfile("olena", true);
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/busySlots/1757257200000"),
        lock
      )
    );
  });

  it("учень не може звільнити зайнятий слот", async () => {
    await seedProfile("olena", true);
    await seed("tutorProfiles/olena/busySlots/1757257200000", lock);
    await assertFails(
      deleteDoc(
        doc(asStudent("marko"), "tutorProfiles/olena/busySlots/1757257200000")
      )
    );
  });
});
