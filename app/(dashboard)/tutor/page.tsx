"use client";

import { CalendarDays, UserRound, Users, Wallet } from "lucide-react";

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
    href: "/tutor/schedule",
    icon: CalendarDays,
    title: "Розклад",
    description: "Коли вам зручно вести заняття. Учні бачать цей час у своєму поясі.",
  },
  {
    href: "/tutor/payouts",
    icon: Wallet,
    title: "Виплати",
    description: "Підключіть рахунок — без нього учні не зможуть оплатити урок.",
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
