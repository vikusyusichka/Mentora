import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  UserRound,
  Users,
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
      { label: "Розклад", href: "/tutor", icon: CalendarDays, soon: true },
      { label: "Мої учні", href: "/tutor", icon: Users, soon: true },
    ],
    action: { label: "Переглянути каталог", href: "/catalog" },
  },
  student: {
    caption: "Кабінет учня",
    items: [
      { label: "Огляд", href: "/student", icon: LayoutDashboard },
      // Каталогу тут навмисно немає: до нього веде золота кнопка внизу —
      // для учня це головна дія, і дублювати її пунктом меню безглуздо.
      { label: "Мої заняття", href: "/student", icon: BookOpen, soon: true },
      {
        label: "Домашні завдання",
        href: "/student",
        icon: ClipboardList,
        soon: true,
      },
      { label: "Мій прогрес", href: "/student", icon: LineChart, soon: true },
    ],
    action: { label: "Знайти репетитора", href: "/catalog" },
  },
  parent: {
    caption: "Кабінет батьків",
    items: [
      { label: "Огляд", href: "/parent", icon: LayoutDashboard },
      { label: "Прогрес дитини", href: "/parent", icon: LineChart, soon: true },
      { label: "Заняття", href: "/parent", icon: BookOpen, soon: true },
    ],
    action: { label: "Знайти репетитора", href: "/catalog" },
  },
};
