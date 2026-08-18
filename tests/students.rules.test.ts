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

const PROJECT_ID = "demo-mentora-students";
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

const ENROLLMENT = "olena__marko";

function as(uid: string, role: string) {
  return testEnv.authenticatedContext(uid, { role }).firestore();
}
const asTutor = () => as("olena", "tutor");
const asStudent = () => as("marko", "student");
const asParent = () => as("halyna", "parent");
const asStranger = () => as("petro", "student");
const asGuest = () => testEnv.unauthenticatedContext().firestore();

function enrollmentData(overrides: Record<string, unknown> = {}) {
  return {
    tutorId: "olena",
    studentUid: "marko",
    parentUids: ["halyna"],
    name: "Марко Кравець",
    languages: ["Англійська"],
    currentLevel: null,
    goalLevel: null,
    goalText: "",
    totalNewWords: 0,
    lessonsCount: 0,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

async function seedEnrollment(overrides: Record<string, unknown> = {}) {
  await seed(`students/${ENROLLMENT}`, enrollmentData(overrides));
}

async function seedLesson() {
  await seed(`students/${ENROLLMENT}/lessons/booking-1`, {
    slotStart: "2026-09-07T15:00:00.000Z",
    durationMin: 60,
    status: "scheduled",
    bookingId: "booking-1",
    report: null,
    createdAt: "2026-09-01T10:00:00.000Z",
  });
}

async function seedHomework() {
  await seed(`students/${ENROLLMENT}/homework/hw-1`, {
    text: "Прочитати розділ 3",
    deadline: "2026-09-10",
    status: "assigned",
    submissionFileUrl: "",
  });
}

describe("students — читання", () => {
  it("репетитор бачить свій enrollment", async () => {
    await seedEnrollment();
    await assertSucceeds(getDoc(doc(asTutor(), `students/${ENROLLMENT}`)));
  });

  it("учень бачить свій enrollment", async () => {
    await seedEnrollment();
    await assertSucceeds(getDoc(doc(asStudent(), `students/${ENROLLMENT}`)));
  });

  it("батько бачить enrollment дитини", async () => {
    await seedEnrollment();
    await assertSucceeds(getDoc(doc(asParent(), `students/${ENROLLMENT}`)));
  });

  it("сторонній не бачить нічого", async () => {
    await seedEnrollment();
    await assertFails(getDoc(doc(asStranger(), `students/${ENROLLMENT}`)));
  });

  it("гість не бачить нічого", async () => {
    await seedEnrollment();
    await assertFails(getDoc(doc(asGuest(), `students/${ENROLLMENT}`)));
  });

  it("репетитор перелічує своїх учнів", async () => {
    await seedEnrollment();
    await assertSucceeds(
      getDocs(
        query(collection(asTutor(), "students"), where("tutorId", "==", "olena"))
      )
    );
  });

  it("не можна перелічити чужих учнів", async () => {
    await seedEnrollment();
    await assertFails(
      getDocs(
        query(collection(asStranger(), "students"), where("tutorId", "==", "olena"))
      )
    );
  });
});

describe("students — запис", () => {
  it("enrollment не створюється з клієнта — лише сервером після оплати", async () => {
    await assertFails(
      setDoc(doc(asTutor(), "students/olena__novyi"), enrollmentData())
    );
  });

  it("репетитор редагує рівень і ціль учня", async () => {
    await seedEnrollment();
    await assertSucceeds(
      updateDoc(doc(asTutor(), `students/${ENROLLMENT}`), {
        currentLevel: "B1",
        goalLevel: "B2",
        goalText: "Співбесіда англійською",
      })
    );
  });

  it("репетитор не може накрутити лічильники", async () => {
    await seedEnrollment();
    await assertFails(
      updateDoc(doc(asTutor(), `students/${ENROLLMENT}`), {
        lessonsCount: 99,
      })
    );
  });

  it("репетитор не може підмінити учня", async () => {
    await seedEnrollment();
    await assertFails(
      updateDoc(doc(asTutor(), `students/${ENROLLMENT}`), {
        studentUid: "petro",
      })
    );
  });

  it("репетитор не може сам додати батька", async () => {
    await seedEnrollment();
    await assertFails(
      updateDoc(doc(asTutor(), `students/${ENROLLMENT}`), {
        parentUids: ["halyna", "petro"],
      })
    );
  });

  it("учень не редагує власну картку", async () => {
    await seedEnrollment();
    await assertFails(
      updateDoc(doc(asStudent(), `students/${ENROLLMENT}`), {
        currentLevel: "C2",
      })
    );
  });

  it("видалення заборонено", async () => {
    await seedEnrollment();
    await assertFails(deleteDoc(doc(asTutor(), `students/${ENROLLMENT}`)));
  });
});

describe("lessons", () => {
  it("усі троє бачать урок", async () => {
    await seedEnrollment();
    await seedLesson();
    for (const ctx of [asTutor(), asStudent(), asParent()]) {
      await assertSucceeds(
        getDoc(doc(ctx, `students/${ENROLLMENT}/lessons/booking-1`))
      );
    }
  });

  it("сторонній урок не бачить", async () => {
    await seedEnrollment();
    await seedLesson();
    await assertFails(
      getDoc(doc(asStranger(), `students/${ENROLLMENT}/lessons/booking-1`))
    );
  });

  it("репетитор відмічає урок проведеним", async () => {
    await seedEnrollment();
    await seedLesson();
    await assertSucceeds(
      updateDoc(doc(asTutor(), `students/${ENROLLMENT}/lessons/booking-1`), {
        status: "done",
      })
    );
  });

  it("учень не міняє статус уроку", async () => {
    await seedEnrollment();
    await seedLesson();
    await assertFails(
      updateDoc(doc(asStudent(), `students/${ENROLLMENT}/lessons/booking-1`), {
        status: "done",
      })
    );
  });

  it("урок не створюється з клієнта — його породжує оплата", async () => {
    await seedEnrollment();
    await assertFails(
      setDoc(doc(asTutor(), `students/${ENROLLMENT}/lessons/manual`), {
        slotStart: "2026-09-08T15:00:00.000Z",
        durationMin: 60,
        status: "scheduled",
        bookingId: null,
        report: null,
        createdAt: "2026-09-01T10:00:00.000Z",
      })
    );
  });
});

describe("homework", () => {
  it("репетитор видає завдання", async () => {
    await seedEnrollment();
    await assertSucceeds(
      setDoc(doc(asTutor(), `students/${ENROLLMENT}/homework/hw-2`), {
        text: "Вивчити слова",
        deadline: "2026-09-12",
        status: "assigned",
        submissionFileUrl: "",
      })
    );
  });

  it("учень позначає виконання й прикладає файл", async () => {
    await seedEnrollment();
    await seedHomework();
    await assertSucceeds(
      updateDoc(doc(asStudent(), `students/${ENROLLMENT}/homework/hw-1`), {
        status: "done",
        submissionFileUrl: "https://example.com/file.pdf",
      })
    );
  });

  it("учень не переписує текст завдання", async () => {
    await seedEnrollment();
    await seedHomework();
    await assertFails(
      updateDoc(doc(asStudent(), `students/${ENROLLMENT}/homework/hw-1`), {
        text: "Нічого не робити",
      })
    );
  });

  it("учень не зсуває дедлайн", async () => {
    await seedEnrollment();
    await seedHomework();
    await assertFails(
      updateDoc(doc(asStudent(), `students/${ENROLLMENT}/homework/hw-1`), {
        deadline: "2027-01-01",
      })
    );
  });

  it("батько лише читає", async () => {
    await seedEnrollment();
    await seedHomework();
    await assertSucceeds(
      getDoc(doc(asParent(), `students/${ENROLLMENT}/homework/hw-1`))
    );
    await assertFails(
      updateDoc(doc(asParent(), `students/${ENROLLMENT}/homework/hw-1`), {
        status: "done",
      })
    );
  });
});

describe("invites", () => {
  const inviteData = {
    enrollmentId: ENROLLMENT,
    studentUid: "marko",
    tutorId: "olena",
    role: "parent",
    createdBy: "marko",
    createdAt: "2026-09-01T10:00:00.000Z",
    expiresAt: "2026-09-08T10:00:00.000Z",
    usedBy: null,
    usedAt: null,
  };

  it("учень читає власний код", async () => {
    await seed("invites/ABCD2345", inviteData);
    await assertSucceeds(getDoc(doc(asStudent(), "invites/ABCD2345")));
  });

  it("чужий код прочитати не можна — інакше його можна було б підібрати перебором", async () => {
    await seed("invites/ABCD2345", inviteData);
    await assertFails(getDoc(doc(asStranger(), "invites/ABCD2345")));
    await assertFails(getDoc(doc(asParent(), "invites/ABCD2345")));
    await assertFails(getDoc(doc(asGuest(), "invites/ABCD2345")));
  });

  it("код не створюється з клієнта — його видає сервер", async () => {
    await assertFails(
      setDoc(doc(asStudent(), "invites/NEWCODE1"), inviteData)
    );
  });

  it("погасити код підміною документа не можна", async () => {
    await seed("invites/ABCD2345", inviteData);
    await assertFails(
      updateDoc(doc(asParent(), "invites/ABCD2345"), { usedBy: "halyna" })
    );
  });
});

describe("reviews", () => {
  const reviewData = {
    tutorId: "olena",
    studentUserId: "marko",
    studentName: "Марко Кравець",
    rating: 5,
    text: "Дуже задоволений.",
    createdAt: "2026-09-10T10:00:00.000Z",
    updatedAt: "2026-09-10T10:00:00.000Z",
  };

  it("відгуки читає будь-хто — це частина вітрини", async () => {
    await seed("reviews/olena__marko", reviewData);
    for (const ctx of [asGuest(), asStranger(), asTutor(), asParent()]) {
      await assertSucceeds(getDoc(doc(ctx, "reviews/olena__marko")));
    }
  });

  it("учень не може написати відгук напряму — право дає проведений урок", async () => {
    await assertFails(
      setDoc(doc(asStudent(), "reviews/olena__marko"), reviewData)
    );
  });

  it("репетитор не може підправити свій відгук", async () => {
    await seed("reviews/olena__marko", reviewData);
    await assertFails(
      updateDoc(doc(asTutor(), "reviews/olena__marko"), { rating: 5, text: "" })
    );
  });

  it("відгук не видаляється з клієнта", async () => {
    await seed("reviews/olena__marko", reviewData);
    await assertFails(deleteDoc(doc(asStudent(), "reviews/olena__marko")));
  });
});
