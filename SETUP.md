# Налаштування Mentora — покроково

Це те, що **треба зробити руками** (потребує твоїх акаунтів Google / GitHub / Vercel).
Роби по порядку, не перестрибуй. Після кожного кроку є «як перевірити».

Поки цього немає — розробка все одно працює локально на емуляторах.
Це потрібно, щоб застосунок жив у інтернеті.

---

## Крок 1. Постав Java 21

Firebase-емулятори не працюють зі старою Java. Зараз у системі Java 8.

У терміналі:

```bash
winget install --id EclipseAdoptium.Temurin.21.JDK -e
```

⚠️ **Найважливіше:** після встановлення **закрий термінал і відкрий новий**.
Вікно, у якому ти запускав `winget`, тримає старий PATH — у ньому `java -version`
й далі показуватиме стару версію, хоча все встановилось правильно.

**Як перевірити (обов'язково у НОВОМУ вікні):**
```bash
java -version
```
Має показати `21.x`, а не `1.8`.

> Якщо у новому вікні все ще `1.8` — значить, стара Java стоїть у PATH раніше.
> Перевір порядок: Win → «Змінні середовища» → Path → рядок
> `C:\Program Files\Eclipse Adoptium\...\bin` має бути **вище** за
> `C:\ProgramData\Oracle\Java\javapath`.

---

## Крок 2. Увійди у Firebase з терміналу

```bash
npx firebase login
```

Відкриється браузер → обери свій Google-акаунт → дозволь доступ.

**Як перевірити:**
```bash
npx firebase login:list
```
Має показати твою пошту.

---

## Крок 3. Створи проєкт у Firebase

1. Відкрий https://console.firebase.google.com
2. Натисни **Add project** (Додати проєкт)
3. Назва: `mentora` (якщо зайнято — `mentora-app`, будь-яка)
4. Google Analytics — можеш **вимкнути**, зараз не потрібен
5. **Create project** → зачекай → **Continue**

**Запиши собі Project ID** — він під назвою проєкту, виглядає як `mentora-a1b2c`.

---

## Крок 4. Додай Web App і скопіюй ключі

1. На головній сторінці проєкту натисни іконку **`</>`** (Web)
2. App nickname: `Mentora Web` → **Register app**
3. З'явиться блок коду `const firebaseConfig = { ... }`

**Не закривай цю сторінку** — ключі потрібні на кроці 7.

---

## Крок 5. Увімкни вхід (Authentication)

1. Ліве меню → **Build** → **Authentication** → **Get started**
2. Вкладка **Sign-in method**
3. **Email/Password** → Enable → Save
4. **Google** → Enable → обери support email → Save

---

## Крок 6. Створи базу

1. Build → **Firestore Database** → **Create database**
2. Обери **Production mode** (правила ми вже написали свої)
3. Локація: `europe-west3` або `eur3` — ближче до України
4. Enable

> **Storage НЕ створюємо.** Google вимагає за нього платний план Blaze
> із карткою. Тому фото профілю задається посиланням, а не завантаженням
> файлу. Так само ми **не деплоїмо Cloud Functions** — видача ролей
> працює через `/api/set-role` на Vercel, безкоштовно.

---

## Крок 7. Впиши ключі у проєкт

Відкрий файл `.env.local` у папці проєкту й заміни значення на свої
(зі сторінки з кроку 4):

```
NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
NEXT_PUBLIC_FIREBASE_APP_ID=<appId>
```

⚠️ **Важливо.** Щоб і далі розробляти локально на емуляторах,
залиш ці рядки як є:
```
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
```
Вони діють тільки локально. На Vercel їх не буде — там застосунок
автоматично піде у справжній Firebase.

Далі відкрий `.firebaserc` і встав свій Project ID:

```json
{
  "projects": {
    "default": "ТВІЙ-PROJECT-ID"
  }
}
```

---

## Крок 8. Залий правила безпеки у Firebase

Відкрий термінал **у папці проєкту** (`H:\Projects\Mentora`) і виконай:

```bash
npx firebase deploy --only firestore:rules
```

⚠️ Саме `firestore:rules`, **без** `,storage` — Storage у нас немає (крок 6),
і з ним команда впаде з помилкою.

**Як перевірити:** Firebase Console → Firestore Database → вкладка **Rules**.
Там має з'явитись наш текст зі словом `tutorProfiles`.

> Без цього кроку база стоятиме з дефолтними правилами й застосунок
> не працюватиме як треба.

---

## Крок 8.5. Візьми ключ сервісного акаунта

Він потрібен, щоб `/api/set-role` на Vercel міг видавати ролі.

1. Firebase Console → шестерня біля **Project Overview** → **Project settings**
2. Вкладка **Service accounts**
3. Кнопка **Generate new private key** → **Generate key**
4. Завантажиться `.json` файл — **не додавай його в проєкт і не коміть**

Відкрий цей файл блокнотом і скопіюй **увесь вміст** (від `{` до `}`).
Він знадобиться на кроці 10.

> Це справжній ключ доступу до твого Firebase. Нікому не показуй,
> не вставляй у чат і не клади в репозиторій. Тільки в поле Vercel.

---

## Крок 9. Створи репозиторій на GitHub

1. Відкрий https://github.com/new
2. Repository name: `mentora`
3. Обери **Private**
4. **НЕ** став галочки на README / .gitignore / license — у нас вони вже є
5. **Create repository**

Далі скопіюй з GitHub рядок із `git remote add ...` і виконай у терміналі:

```bash
git remote add origin https://github.com/ТВІЙ-НІК/mentora.git
git push -u origin main
```

**Як перевірити:** онови сторінку GitHub — там мають бути файли проєкту.

---

## Крок 10. Підключи Vercel

1. Відкрий https://vercel.com → **Sign up** через GitHub
2. **Add New** → **Project**
3. Знайди репозиторій `Mentora` → **Import**
4. **Application Preset** — має бути **Next.js**, а не `Other`.
   Якщо стоїть `Other` — зміни на Next.js, інакше збірка не запуститься правильно.
   Build/Output/Install команди не чіпай, лиши порожніми.
5. Розділ **Environment Variables** — додай **сім** змінних:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | твій apiKey |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | твій authDomain |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | твій projectId |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | твій storageBucket |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | твій senderId |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | твій appId |
   | `FIREBASE_SERVICE_ACCOUNT_KEY` | **увесь JSON** з кроку 8.5, одним рядком |

   Перші шість візьми з `.env.local` (без лапок і ком).
   Сьома — це вміст `.json` файлу з кроку 8.5.

   ⚠️ **Не додавай** `NEXT_PUBLIC_USE_FIREBASE_EMULATOR`, `FIREBASE_PROJECT_ID`
   і жодні `*_EMULATOR_HOST` — інакше сайт шукатиме емулятор на сервері
   й зламається.

6. **Deploy** → зачекай 1–2 хвилини

> Якщо забудеш `FIREBASE_SERVICE_ACCOUNT_KEY` — сайт відкриється,
> але на кроці вибору ролі буде помилка: сервер не зможе видати роль.

**Як перевірити:** відкрий отриманий лінк — має завантажитись головна Mentora.

---

## Крок 11. Дозволь свій домен у Firebase

Щоб вхід працював на живому сайті:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. **Add domain** → встав домен із Vercel (напр. `mentora-xxxx.vercel.app`)

**Як перевірити:** на живому сайті зареєструйся — має пройти й привести на
вибір ролі.

---

## Готово

Після цього:
- локально працюєш як раніше: `npm run emulators:dev`
- кожен `git push` автоматично оновлює живий сайт

## Якщо щось пішло не так

| Симптом | Причина |
|---|---|
| `firebase-tools no longer supports Java version before 21` | Крок 1 не завершено |
| На сайті вхід не працює, в консолі `auth/unauthorized-domain` | Крок 11 |
| Сайт вантажиться, але дані не зберігаються | Крок 8 (правила не залиті) |
| Локально все зламалось після змін | Перевір, що `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` у `.env.local` |
