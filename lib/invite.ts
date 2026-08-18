/**
 * Інвайт-коди для батьків (Блок C.4).
 *
 * Батьки не проходять маркетплейс: вони приєднуються до вже наявного
 * навчального звʼязку за кодом, який дає учень. Код — єдиний доказ права
 * на доступ, тож він одноразовий і має строк придатності.
 */

export interface Invite {
  /** До кого приєднує — ідентифікатор enrollment. */
  enrollmentId: string;
  studentUid: string;
  tutorId: string;
  role: "parent";
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  /** Хто скористався. `null` — код ще вільний. */
  usedBy: string | null;
  usedAt: string | null;
}

export interface InviteWithCode extends Invite {
  code: string;
}

export const INVITE_TTL_DAYS = 7;
export const INVITE_LENGTH = 8;

/**
 * Абетка без символів, які плутають на слух і на вигляд: немає 0/O,
 * 1/I/L. Код диктують у месенджері або вголос — це не абстрактна турбота.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Генерує код із наданого джерела випадковості. */
export function generateCode(randomBytes: Uint8Array): string {
  let code = "";
  for (let i = 0; i < INVITE_LENGTH; i += 1) {
    code += ALPHABET[randomBytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Зводить введене користувачем до канонічного вигляду: людина може
 * вставити код з дефісом, пробілами чи в нижньому регістрі.
 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidCodeShape(code: string): boolean {
  if (code.length !== INVITE_LENGTH) return false;
  return [...code].every((char) => ALPHABET.includes(char));
}

/** Показуємо групами по чотири — так його легше продиктувати й звірити. */
export function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export type InviteProblem = "not-found" | "already-used" | "expired";

/** Чи можна скористатися кодом просто зараз. */
export function inviteProblem(
  invite: Invite | null,
  now: Date = new Date()
): InviteProblem | null {
  if (!invite) return "not-found";
  if (invite.usedBy) return "already-used";
  if (Date.parse(invite.expiresAt) <= now.getTime()) return "expired";
  return null;
}

export const INVITE_PROBLEM_MESSAGES: Record<InviteProblem, string> = {
  "not-found": "Такого коду не існує. Перевірте, чи правильно він введений.",
  "already-used": "Цим кодом уже скористалися. Попросіть новий.",
  expired: "Термін дії коду минув. Попросіть новий.",
};
