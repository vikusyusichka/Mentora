"use client";

import { BookOpen, ClipboardList, LineChart, Search } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  SectionCards,
  type DashboardSection,
} from "@/components/dashboard/section-cards";
import { StudentBookings } from "./bookings";

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
        <section className="rounded-card mb-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
          <h2 className="text-title-lg mb-5">Мої бронювання</h2>
          <StudentBookings />
        </section>

        <SectionCards sections={SECTIONS} />
      </DashboardLayout>
    </AuthGate>
  );
}
