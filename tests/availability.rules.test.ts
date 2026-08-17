import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

const PROJECT_ID = "demo-mentora-availability";
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

function availabilityData(overrides: Record<string, unknown> = {}) {
  return {
    weeklySlots: [{ dayOfWeek: 1, startTime: "18:00", durationMin: 60 }],
    lessonDurationMin: 60,
    bufferMin: 15,
    ...overrides,
  };
}

async function seedProfile(tutorId: string, isPublished: boolean) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `tutorProfiles/${tutorId}`), {
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
  });
}

async function seedAvailability(tutorId: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `tutorProfiles/${tutorId}/availability/weekly`),
      availabilityData()
    );
  });
}

describe("availability — запис", () => {
  it("репетитор зберігає власний розклад", async () => {
    await seedProfile("olena", false);
    await assertSucceeds(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/availability/weekly"),
        availabilityData()
      )
    );
  });

  it("чужий розклад редагувати не можна", async () => {
    await seedProfile("olena", true);
    await assertFails(
      setDoc(
        doc(asTutor("petro"), "tutorProfiles/olena/availability/weekly"),
        availabilityData()
      )
    );
  });

  it("учень не може писати розклад репетитора", async () => {
    await seedProfile("olena", true);
    await assertFails(
      setDoc(
        doc(asStudent("marko"), "tutorProfiles/olena/availability/weekly"),
        availabilityData()
      )
    );
  });

  it("відхиляє відʼємну перерву", async () => {
    await seedProfile("olena", false);
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/availability/weekly"),
        availabilityData({ bufferMin: -10 })
      )
    );
  });

  it("відхиляє нульову тривалість уроку", async () => {
    await seedProfile("olena", false);
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/availability/weekly"),
        availabilityData({ lessonDurationMin: 0 })
      )
    );
  });

  it("відхиляє роздутий шаблон", async () => {
    await seedProfile("olena", false);
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/availability/weekly"),
        availabilityData({
          weeklySlots: Array.from({ length: 201 }, () => ({
            dayOfWeek: 1,
            startTime: "18:00",
            durationMin: 60,
          })),
        })
      )
    );
  });
});

describe("availability — читання", () => {
  it("гість читає розклад опублікованого репетитора", async () => {
    await seedProfile("olena", true);
    await seedAvailability("olena");
    await assertSucceeds(
      getDoc(doc(asGuest(), "tutorProfiles/olena/availability/weekly"))
    );
  });

  it("гість НЕ читає розклад чернетки", async () => {
    await seedProfile("olena", false);
    await seedAvailability("olena");
    await assertFails(
      getDoc(doc(asGuest(), "tutorProfiles/olena/availability/weekly"))
    );
  });

  it("власник читає свій розклад до публікації", async () => {
    await seedProfile("olena", false);
    await seedAvailability("olena");
    await assertSucceeds(
      getDoc(doc(asTutor("olena"), "tutorProfiles/olena/availability/weekly"))
    );
  });

  it("розклад неіснуючого профілю недоступний гостю", async () => {
    await assertFails(
      getDoc(doc(asGuest(), "tutorProfiles/nobody/availability/weekly"))
    );
  });
});

describe("slotExceptions", () => {
  it("репетитор блокує дату у своєму розкладі", async () => {
    await seedProfile("olena", true);
    await assertSucceeds(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/slotExceptions/2026-09-03"),
        { blocked: ["2026-09-03T15:00:00.000Z"], extra: [] }
      )
    );
  });

  it("репетитор скасовує виняток видаленням", async () => {
    await seedProfile("olena", true);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "tutorProfiles/olena/slotExceptions/2026-09-03"),
        { blocked: [], extra: [] }
      );
    });
    await assertSucceeds(
      deleteDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/slotExceptions/2026-09-03")
      )
    );
  });

  it("гість читає винятки опублікованого репетитора", async () => {
    await seedProfile("olena", true);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "tutorProfiles/olena/slotExceptions/2026-09-03"),
        { blocked: [], extra: [] }
      );
    });
    await assertSucceeds(
      getDoc(doc(asGuest(), "tutorProfiles/olena/slotExceptions/2026-09-03"))
    );
  });

  it("гість не може блокувати чужі слоти", async () => {
    await seedProfile("olena", true);
    await assertFails(
      setDoc(
        doc(asGuest(), "tutorProfiles/olena/slotExceptions/2026-09-03"),
        { blocked: [], extra: [] }
      )
    );
  });

  it("відхиляє виняток без потрібних полів", async () => {
    await seedProfile("olena", true);
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena/slotExceptions/2026-09-03"),
        { blocked: "усе" }
      )
    );
  });
});
