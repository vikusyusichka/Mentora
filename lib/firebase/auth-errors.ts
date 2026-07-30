import { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Некоректна адреса електронної пошти.",
  "auth/user-disabled": "Обліковий запис заблоковано.",
  "auth/user-not-found": "Користувача з такою поштою не знайдено.",
  "auth/wrong-password": "Невірний пароль.",
  "auth/invalid-credential": "Невірна пошта або пароль.",
  "auth/email-already-in-use": "Ця пошта вже зареєстрована.",
  "auth/weak-password": "Пароль має містити щонайменше 6 символів.",
  "auth/too-many-requests": "Забагато спроб. Спробуйте пізніше.",
  "auth/popup-closed-by-user": "Вікно входу закрито до завершення.",
  "auth/network-request-failed": "Проблема з мережею. Перевірте з'єднання.",
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? "Сталася помилка. Спробуйте ще раз.";
  }
  return "Сталася помилка. Спробуйте ще раз.";
}
