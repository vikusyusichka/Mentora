"use client";

import { CalendarDays, UserRound, Users } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  SectionCards,
  type DashboardSection,
} from "@/components/dashboard/section-cards";

const SECTIONS: DashboardSection[] = [
  {
    href: "/tutor/profile",
    icon: UserRound,
    title: "Профіль",
    description: "Мови, рівні, ціна й біо. Публікація в каталозі.",
  },
  {
    icon: CalendarDays,
    title: "Розклад",
    description: "Слоти доступності та бронювання (Фаза B).",
  },
  {
    icon: Users,
    title: "Мої учні",
    description: "Прогрес, звіти після уроків, ДЗ (Фаза C).",
  },
];

export default function TutorDashboardPage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Кабінет репетитора"
        description="Почніть із профілю — без нього учні вас не знайдуть."
      >
        <SectionCards sections={SECTIONS} />
      </DashboardLayout>
    </AuthGate>
  );
}
