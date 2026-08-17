"use client";

import { BookOpen, ClipboardList, LineChart, Search } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  SectionCards,
  type DashboardSection,
} from "@/components/dashboard/section-cards";

const SECTIONS: DashboardSection[] = [
  {
    href: "/catalog",
    icon: Search,
    title: "Каталог",
    description: "Пошук репетитора за мовою, рівнем, форматом і ціною.",
  },
  {
    icon: BookOpen,
    title: "Мої заняття",
    description: "Розклад уроків і теми після кожного з них (Фаза C).",
  },
  {
    icon: ClipboardList,
    title: "Домашні завдання",
    description: "Текст, дедлайн і здача виконаного (Фаза C).",
  },
  {
    icon: LineChart,
    title: "Мій прогрес",
    description: "Рівень CEFR, нові слова, тренд розмовної практики (Фаза C).",
  },
];

export default function StudentDashboardPage() {
  return (
    <AuthGate allow={["student"]}>
      <DashboardLayout
        title="Кабінет учня"
        description="Почніть із каталогу — оберіть репетитора, і тут зʼявляться заняття, прогрес і домашні завдання."
      >
        <SectionCards sections={SECTIONS} />
      </DashboardLayout>
    </AuthGate>
  );
}
