export const ROLES = ["tutor", "student", "parent"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  tutor: "Репетитор",
  student: "Учень",
  parent: "Батьки",
};

/** Заголовок картки на екрані вибору ролі. */
export const ROLE_CARD_TITLES: Record<Role, string> = {
  tutor: "Я репетитор",
  student: "Я учень",
  parent: "Я батько / мати",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  tutor:
    "Діліться досвідом, ведіть своїх учнів, фіксуйте прогрес після кожного уроку та керуйте розкладом.",
  student:
    "Знайдіть репетитора в каталозі, бронюйте уроки й відстежуйте власний прогрес до цілі.",
  parent:
    "Спостерігайте за прогресом дитини: рівень, кількість уроків, теми та нотатки від репетитора.",
};

export const ROLE_CTA: Record<Role, string> = {
  tutor: "Продовжити як репетитор",
  student: "Продовжити як учень",
  parent: "Продовжити як батьки",
};

/** Головна сторінка кабінету для ролі. */
export function dashboardPath(role: Role): string {
  return `/${role}`;
}
