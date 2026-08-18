import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Пункт видно, але він неактивний: розділ зʼявиться у наступних блоках. */
  soon?: boolean;
}

export interface RoleNav {
  /** Підпис під wordmark у сайдбарі — капсом, як на еталоні. */
  caption: string;
  items: NavItem[];
  /** Золота кнопка-пігулка внизу сайдбару. */
  action: { label: string; href: string };
}

/**
 * Навігація кабінету за ролями.
 *
 * Пункти майбутніх блоків лишаються видимими з підписом «Скоро» — так
 * користувач бачить, куди рухається продукт, і не шукає розділ, якого ще
 * немає. Клікабельне тут лише те, що справді працює.
 */
export const DASHBOARD_NAV: Record<Role, RoleNav> = {
  tutor: {
    caption: "Кабінет репетитора",
    items: [
      { label: "Огляд", href: "/tutor", icon: LayoutDashboard },
      { label: "Профіль", href: "/tutor/profile", icon: UserRound },
      { label: "Мої учні", href: "/tutor/students", icon: Users },
      { label: "Розклад уроків", href: "/tutor/lessons", icon: CalendarRange },
      { label: "Доступність", href: "/tutor/schedule", icon: CalendarDays },
      { label: "Виплати", href: "/tutor/payouts", icon: Wallet },
    ],
    action: { label: "Переглянути каталог", href: "/catalog" },
  },
  student: {
    caption: "Кабінет учня",
    items: [
      { label: "Огляд", href: "/student", icon: LayoutDashboard },
      // Каталогу тут навмисно немає: до нього веде золота кнопка внизу —
      // для учня це головна дія, і дублювати її пунктом меню безглуздо.
      //
      // Решта — якорі на секції огляду, а не окремі сторінки. Так меню
      // веде до справжнього вмісту й не обіцяє екранів, яких немає.
      { label: "Мої заняття", href: "/student#lessons", icon: BookOpen },
      {
        label: "Домашні завдання",
        href: "/student#homework",
        icon: ClipboardList,
      },
      { label: "Мій прогрес", href: "/student#progress", icon: LineChart },
    ],
    action: { label: "Знайти репетитора", href: "/catalog" },
  },
  parent: {
    caption: "Кабінет батьків",
    items: [
      { label: "Огляд", href: "/parent", icon: LayoutDashboard },
      { label: "Прогрес дитини", href: "/parent#progress", icon: LineChart },
      { label: "Заняття", href: "/parent#lessons", icon: BookOpen },
    ],
    action: { label: "Знайти репетитора", href: "/catalog" },
  },
};
