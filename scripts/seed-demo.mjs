/**
 * Демо-дані для локальної перевірки.
 *
 * Створює репетитора з опублікованим профілем і розкладом, двох учнів,
 * а одному з них — оплачений урок зі звітом і домашнім завданням. Другий
 * учень лишається «чистим»: на ньому зручно проходити шлях бронювання
 * руками з нуля.
 *
 * Пише напряму через Admin SDK, обходячи Security Rules — це демо-дані,
 * а не перевірка правил. Правила покриті тестами (`npm run test:rules`).
 *
 * Запуск: npm run seed   (емулятори мають бути запущені)
 */
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "mentora-dc251";
const PASSWORD = "demo-12345";
const TZ = "Europe/Kyiv";
const TUTOR_ID = "demo-tutor";

// ── Похідні поля каталогу ─────────────────────────────────────────────
//
// Дублює lib/catalog.ts свідомо: скрипт має запускатися звичайним node,
// без збірки й аліасів шляхів. Щоб копія не розійшлася з оригіналом,
// її звіряє тест tests/unit/seed-tags.test.ts.

export function offeredFormats(format) {
  return format === "both" ? ["online", "offline"] : [format];
}

export function buildFilterTags({ languages, levelsTaught, format }) {
  const tags = [];
  for (const language of [undefined, ...languages]) {
    for (const level of [undefined, ...levelsTaught]) {
      for (const f of [undefined, ...offeredFormats(format)]) {
        const parts = [];
        if (language) parts.push(`l:${language}`);
        if (level) parts.push(`v:${level}`);
        if (f) parts.push(`f:${f}`);
        if (parts.length > 0) tags.push(parts.join("~"));
      }
    }
  }
  return tags;
}

export function cityKeyOf(city) {
  const key = city?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  return key.length > 0 ? key : null;
}

// ── Таймзони ──────────────────────────────────────────────────────────

function zoneOffsetMs(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

function zonedToUtc(year, month, day, hour, minute, timeZone) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = asUtc - zoneOffsetMs(new Date(asUtc), timeZone);
  return new Date(asUtc - zoneOffsetMs(new Date(first), timeZone));
}

/** Найближчі робочі дні з указаною годиною за часом репетитора. */
function upcomingSlots(hour, minute, count) {
  const now = new Date();
  const slots = [];
  for (let i = 0; i < 21 && slots.length < count; i += 1) {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i)
    );
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const at = zonedToUtc(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      hour,
      minute,
      TZ
    );
    if (at.getTime() > now.getTime()) slots.push(at.toISOString());
  }
  return slots;
}

// ── Дані ──────────────────────────────────────────────────────────────

const PROFILE = {
  displayName: "Надія Литвин",
  bio: "Іспанська для подорожей і роботи. Багато розмовної практики з першого заняття, граматику даю дозовано й одразу в контексті живих діалогів.",
  languages: ["Іспанська", "Англійська"],
  levelsTaught: ["A2", "B1", "B2"],
  pricePerLesson: 480,
  currency: "UAH",
  format: "both",
  city: "Львів",
  timezone: TZ,
  trialPrice: 200,
  photoURL: "",
  isPublished: true,
};

const STUDENTS = [
  {
    uid: "demo-marko",
    email: "marko@example.com",
    name: "Марко Кравець",
    withHistory: true,
  },
  {
    uid: "demo-olha",
    email: "olha@example.com",
    name: "Ольга Шевчук",
    withHistory: false,
  },
];

/**
 * Прибирає попередній прогін.
 *
 * Без цього повторний `npm run seed` лишає уроки зі старими датами, і
 * лічильники розходяться з тим, що видно на графіку. Скрипт має бути
 * ідемпотентним: скільки разів не запусти — стан однаковий.
 */
async function clearDemoData(db, enrollmentId) {
  const enrollment = db.doc(`students/${enrollmentId}`);
  for (const name of ["lessons", "homework"]) {
    const docs = await enrollment.collection(name).get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
  }
  await enrollment.delete();

  for (const path of ["bookings", "payments"]) {
    const docs = await db.collection(path).where("tutorId", "==", TUTOR_ID).get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
  }

  const locks = await db.collection(`tutorProfiles/${TUTOR_ID}/busySlots`).get();
  await Promise.all(locks.docs.map((d) => d.ref.delete()));
}

async function main() {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

  const app = initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore(app);
  const auth = getAuth(app);
  const now = new Date().toISOString();

  async function upsertUser(uid, email, displayName, role) {
    try {
      await auth.deleteUser(uid);
    } catch {
      // Користувача ще немає — це нормально при першому запуску.
    }
    await auth.createUser({ uid, email, password: PASSWORD, displayName });
    await auth.setCustomUserClaims(uid, { role });
    await db
      .doc(`users/${uid}`)
      .set({ role, displayName, email, photoURL: "", createdAt: now });
  }

  await upsertUser(TUTOR_ID, "nadia@example.com", PROFILE.displayName, "tutor");
  for (const student of STUDENTS) {
    await upsertUser(student.uid, student.email, student.name, "student");
  }

  await db.doc(`tutorProfiles/${TUTOR_ID}`).set({
    ...PROFILE,
    filterTags: buildFilterTags(PROFILE),
    cityKey: cityKeyOf(PROFILE.city),
    ratingAvg: 0,
    ratingCount: 0,
  });

  await db.doc(`tutorProfiles/${TUTOR_ID}/availability/weekly`).set({
    weeklySlots: [1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
      { dayOfWeek, startTime: "18:00", durationMin: 60 },
      { dayOfWeek, startTime: "19:15", durationMin: 60 },
    ]),
    lessonDurationMin: 60,
    bufferMin: 15,
  });

  // Учень з історією: минулий урок зі звітом + майбутній оплачений.
  const student = STUDENTS.find((s) => s.withHistory);
  const [nextSlot] = upcomingSlots(18, 0, 1);
  const enrollmentId = `${TUTOR_ID}__${student.uid}`;

  await clearDemoData(db, enrollmentId);

  await db.doc(`students/${enrollmentId}`).set({
    tutorId: TUTOR_ID,
    studentUid: student.uid,
    parentUids: [],
    name: student.name,
    languages: ["Іспанська"],
    currentLevel: "A2",
    goalLevel: "B2",
    goalText: "Вільно спілкуватися в подорожах",
    totalNewWords: 58,
    lessonsCount: 5,
    createdAt: now,
  });

  // Кілька минулих уроків зі звітами: щоб на дашборді учня було видно
  // і підсумки, і графік (він з'являється від третього звіту).
  const HISTORY = [
    { daysAgo: 21, words: 8, practice: true, topic: "Знайомство й побутові фрази" },
    { daysAgo: 14, words: 11, practice: false, topic: "Теперішній час, розпорядок дня" },
    { daysAgo: 10, words: 16, practice: true, topic: "Їжа, замовлення в кафе" },
    { daysAgo: 7, words: 9, practice: true, topic: "Дорога, транспорт, напрямки" },
    { daysAgo: 3, words: 14, practice: true, topic: "Минулий час і подорожі" },
  ];

  const lessons = [
    ...HISTORY.map((h, index) => ({
      id: `demo-lesson-${index + 1}`,
      slotStart: new Date(Date.now() - h.daysAgo * 86_400_000).toISOString(),
      status: "done",
      isTrial: index === 0,
      amount: index === 0 ? 200 : 480,
      platformFee: index === 0 ? 10 : 24,
      report: {
        topic: h.topic,
        newWordsCount: h.words,
        speakingPractice: h.practice,
        noteForStudent:
          index === HISTORY.length - 1
            ? "Добре тримає темп. Попрацювати над артиклями."
            : "",
      },
    })),
    {
      id: "demo-lesson-next",
      slotStart: nextSlot,
      status: "scheduled",
      isTrial: false,
      amount: 480,
      platformFee: 24,
      report: null,
    },
  ];

  for (const lesson of lessons) {
    await db.doc(`students/${enrollmentId}/lessons/${lesson.id}`).set({
      slotStart: lesson.slotStart,
      durationMin: 60,
      status: lesson.status,
      bookingId: lesson.id,
      report: lesson.report,
      createdAt: now,
    });

    await db.doc(`bookings/${lesson.id}`).set({
      studentUserId: student.uid,
      tutorId: TUTOR_ID,
      slotStart: lesson.slotStart,
      durationMin: 60,
      isTrial: lesson.isTrial,
      status: "confirmed",
      amount: lesson.amount,
      currency: "UAH",
      platformFee: lesson.platformFee,
      paymentId: `demo-payment-${lesson.id}`,
      createdAt: now,
      holdUntil: null,
    });
  }

  // Слот майбутнього уроку має лишатись зайнятим у публічному календарі.
  await db
    .doc(`tutorProfiles/${TUTOR_ID}/busySlots/${Date.parse(nextSlot)}`)
    .set({
      bookingId: "demo-lesson-next",
      status: "confirmed",
      holdUntil: null,
      slotStart: nextSlot,
    });

  await db.doc(`students/${enrollmentId}/homework/demo-homework`).set({
    text: "Написати 10 речень у минулому часі про свою подорож.",
    deadline: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
    status: "assigned",
    submissionFileUrl: "",
    lessonId: "demo-lesson-5",
    createdAt: now,
  });

  console.log("Демо-дані створено.\n");
  console.log(`  Репетитор  nadia@example.com   / ${PASSWORD}`);
  for (const s of STUDENTS) {
    const note = s.withHistory
      ? "урок зі звітом і ДЗ"
      : "чистий — для бронювання з нуля";
    console.log(`  Учень      ${s.email.padEnd(20)}/ ${PASSWORD}   (${note})`);
  }
  console.log("\n  Каталог:   http://localhost:3000/catalog");
  console.log("  Емулятори: http://127.0.0.1:4000");
}

// Запускаємо лише при прямому виклику: тест імпортує звідси функції тегів.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
  process.exit(0);
}
