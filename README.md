# Mentora

Маркетплейс для репетиторства з трьома ролями: **репетитор**, **учень**, **батьки**.
Учень обирає репетитора в каталозі → бронює слот → оплачує → після підтвердження
вмикаються дашборди (розклад, прогрес, ДЗ). Батьки бачать прогрес (read-only).

## Стек

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn/ui
- **Firebase**: Auth, Firestore, Storage, Cloud Functions
- **Vercel** (хостинг фронтенду) + Firebase (BaaS)

## Передумови

- **Node.js 20+** (перевірено на 24)
- **JDK 21+** — потрібен для Firebase Emulator Suite та rules-тестів.
  `firebase-tools` більше не підтримує Java < 21.
  - Перевірити: `java -version`
  - Якщо стоїть стара Java, встанови сучасний JDK, напр.:
    ```bash
    winget install --id EclipseAdoptium.Temurin.21.JDK -e
    ```
  - Або, якщо встановлено Android Studio, використай його вбудований JBR 21,
    вказавши на нього PATH/JAVA_HOME (шлях: `…/Android/Android Studio/jbr`).

## Швидкий старт

```bash
npm install
cp .env.example .env.local      # значення demo-* працюють офлайн з емуляторами
npm run emulators:dev           # емулятори + Next dev разом
```

- Застосунок: http://localhost:3000
- Emulator UI: http://127.0.0.1:4000

Локальна розробка йде повністю проти **Firebase Emulator Suite** з demo-проєктом
`demo-mentora` — жодних звернень до продакшн-бекенду.

## Скрипти

| Скрипт | Дія |
|---|---|
| `npm run dev` | лише Next.js dev-сервер |
| `npm run emulators` | лише Firebase-емулятори |
| `npm run emulators:dev` | емулятори + Next dev одночасно |
| `npm run functions:build` | збірка Cloud Functions (TypeScript) |
| `npm run test:rules` | тести Firestore Security Rules (піднімає емулятор) |
| `npm run build` | продакшн-збірка Next.js |
| `npm run lint` | ESLint |

## Конвенції

- **shadcn/ui на Base UI** (пресет `base-nova`), не Radix. Тому композиція
  компонентів робиться через проп `render`, а не `asChild`:
  ```tsx
  <Button render={<Link href="/catalog" />}>Знайти репетитора</Button>
  ```
- **Роль — у custom claim** Firebase Auth. `users/{uid}.role` — джерело істини,
  яке Cloud Function `setUserRole` мірорить у токен. Роль незмінна після
  призначення (і в правилах, і у функції).
- **`AuthGate`** (`components/auth/auth-gate.tsx`) — лише UX-гард. Реальний
  захист даних — виключно Firestore Security Rules.

## Структура

```
app/                 # Next.js App Router (публічні / auth / dashboard простори)
components/ui/        # shadcn/ui
lib/firebase/         # client.ts (браузер) + admin.ts (сервер)
functions/            # Firebase Cloud Functions (TS)
firestore.rules       # правила доступу Firestore
storage.rules         # правила доступу Storage
```

## Підключення реального Firebase-проєкту

1. Створи проєкт у Firebase Console, додай Web App, скопіюй конфіг.
2. Онови `.env.local` реальними `NEXT_PUBLIC_FIREBASE_*` і постав
   `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false`.
3. Онови `default` у `.firebaserc` на свій project id.
4. Розгорни правила/функції: `firebase deploy --only firestore:rules,storage,functions`.
