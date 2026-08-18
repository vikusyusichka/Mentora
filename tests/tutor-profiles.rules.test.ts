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
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
} from "firebase/firestore";

const PROJECT_ID = "demo-mentora-tutors";
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

/** Контекст із роллю в custom claim (як після setUserRole). */
function asTutor(uid: string) {
  return testEnv.authenticatedContext(uid, { role: "tutor" }).firestore();
}
function asStudent(uid: string) {
  return testEnv.authenticatedContext(uid, { role: "student" }).firestore();
}
function asGuest() {
  return testEnv.unauthenticatedContext().firestore();
}

function profileData(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Олена Вчителька",
    bio: "Викладаю англійську десять років, готую до IELTS та співбесід.",
    languages: ["Англійська"],
    levelsTaught: ["A2", "B1", "B2"],
    pricePerLesson: 500,
    currency: "UAH",
    format: "online",
    timezone: "Europe/Kyiv",
    trialPrice: 0,
    photoURL: "",
    ratingAvg: 0,
    ratingCount: 0,
    isPublished: false,
    ...overrides,
  };
}

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe("tutorProfiles — створення", () => {
  it("репетитор створює власний профіль", async () => {
    await assertSucceeds(
      setDoc(doc(asTutor("olena"), "tutorProfiles/olena"), profileData())
    );
  });

  it("не можна створити профіль за іншого користувача", async () => {
    await assertFails(
      setDoc(doc(asTutor("olena"), "tutorProfiles/petro"), profileData())
    );
  });

  it("учень не може створити профіль репетитора", async () => {
    await assertFails(
      setDoc(doc(asStudent("marko"), "tutorProfiles/marko"), profileData())
    );
  });

  it("гість не може створити профіль", async () => {
    await assertFails(
      setDoc(doc(asGuest(), "tutorProfiles/anon"), profileData())
    );
  });

  it("не можна стартувати з накрученим рейтингом", async () => {
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({ ratingAvg: 5, ratingCount: 99 })
      )
    );
  });

  it("не можна самому призначити payoutAccountId", async () => {
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({ payoutAccountId: "acct_hacked" })
      )
    );
  });

  it("відхиляє профіль без мов", async () => {
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({ languages: [] })
      )
    );
  });

  it("відхиляє нульову ціну", async () => {
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({ pricePerLesson: 0 })
      )
    );
  });

  it("відхиляє невідомий формат", async () => {
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({ format: "telepathy" })
      )
    );
  });

  it("приймає теги каталогу в межах ліміту", async () => {
    await assertSucceeds(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({
          filterTags: ["l:Англійська", "v:B1", "l:Англійська~v:B1~f:online"],
          cityKey: null,
        })
      )
    );
  });

  it("відхиляє роздутий filterTags (спроба потрапити в кожну видачу)", async () => {
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({
          filterTags: Array.from({ length: 401 }, (_, i) => `spam:${i}`),
        })
      )
    );
  });

  it("відхиляє filterTags не-списком", async () => {
    await assertFails(
      setDoc(
        doc(asTutor("olena"), "tutorProfiles/olena"),
        profileData({ filterTags: "l:Англійська" })
      )
    );
  });
});

describe("tutorProfiles — читання", () => {
  it("гість читає опублікований профіль", async () => {
    await seed("tutorProfiles/olena", profileData({ isPublished: true }));
    await assertSucceeds(getDoc(doc(asGuest(), "tutorProfiles/olena")));
  });

  it("гість НЕ читає чернетку", async () => {
    await seed("tutorProfiles/olena", profileData({ isPublished: false }));
    await assertFails(getDoc(doc(asGuest(), "tutorProfiles/olena")));
  });

  it("власник читає свою чернетку", async () => {
    await seed("tutorProfiles/olena", profileData({ isPublished: false }));
    await assertSucceeds(getDoc(doc(asTutor("olena"), "tutorProfiles/olena")));
  });

  it("інший репетитор НЕ читає чужу чернетку", async () => {
    await seed("tutorProfiles/olena", profileData({ isPublished: false }));
    await assertFails(getDoc(doc(asTutor("petro"), "tutorProfiles/olena")));
  });

  it("каталог: гість перелічує лише опубліковані", async () => {
    await seed("tutorProfiles/olena", profileData({ isPublished: true }));
    await seed("tutorProfiles/petro", profileData({ isPublished: true }));
    const q = query(
      collection(asGuest(), "tutorProfiles"),
      where("isPublished", "==", true)
    );
    await assertSucceeds(getDocs(q));
  });

  it("каталог без фільтра isPublished відхиляється", async () => {
    await seed("tutorProfiles/olena", profileData({ isPublished: true }));
    await seed("tutorProfiles/draft", profileData({ isPublished: false }));
    await assertFails(getDocs(collection(asGuest(), "tutorProfiles")));
  });
});

describe("tutorProfiles — оновлення й видалення", () => {
  it("власник редагує ціну та публікує профіль", async () => {
    await seed("tutorProfiles/olena", profileData());
    await assertSucceeds(
      updateDoc(doc(asTutor("olena"), "tutorProfiles/olena"), {
        pricePerLesson: 650,
        isPublished: true,
      })
    );
  });

  it("не можна підмінити суму оцінок", async () => {
    await seed("tutorProfiles/olena", profileData({ ratingSum: 10, ratingCount: 2, ratingAvg: 5 }));
    await assertFails(
      updateDoc(doc(asTutor("olena"), "tutorProfiles/olena"), {
        ratingSum: 100,
      })
    );
  });

  it("не можна змінити власний рейтинг", async () => {
    await seed("tutorProfiles/olena", profileData());
    await assertFails(
      updateDoc(doc(asTutor("olena"), "tutorProfiles/olena"), {
        ratingAvg: 5,
        ratingCount: 42,
      })
    );
  });

  it("не можна підмінити payoutAccountId", async () => {
    await seed("tutorProfiles/olena", profileData());
    await assertFails(
      updateDoc(doc(asTutor("olena"), "tutorProfiles/olena"), {
        payoutAccountId: "acct_attacker",
      })
    );
  });

  it("чужий профіль редагувати не можна", async () => {
    await seed("tutorProfiles/olena", profileData());
    await assertFails(
      updateDoc(doc(asTutor("petro"), "tutorProfiles/olena"), {
        pricePerLesson: 1,
      })
    );
  });

  it("видалення заборонено", async () => {
    await seed("tutorProfiles/olena", profileData());
    await assertFails(
      deleteDoc(doc(asTutor("olena"), "tutorProfiles/olena"))
    );
  });
});
