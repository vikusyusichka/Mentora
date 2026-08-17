"use client";

import { CalendarDays, UserRound, Users, Wallet } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { UpcomingLessons } from "@/components/lessons/upcoming-lessons";
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
    title: "Доступність",
    description: "Коли вам зручно вести заняття. Учні бачать цей час у своєму поясі.",
  },
  {
    href: "/tutor/students",
    icon: Users,
    title: "Мої учні",
    description: "Рівень, ціль і уроки кожного учня.",
  },
  {
    href: "/tutor/payouts",
    icon: Wallet,
    title: "Виплати",
    description: "Підключіть рахунок — без нього учні не зможуть оплатити урок.",
  },
];

export default function TutorDashboardPage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Кабінет репетитора"
        description="Почніть із профілю — без нього учні вас не знайдуть."
      >
        <section className="rounded-card mb-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
          <h2 className="text-title-lg mb-5">Найближчі заняття</h2>
          <UpcomingLessons role="tutor" />
        </section>

        <SectionCards sections={SECTIONS} />
      </DashboardLayout>
    </AuthGate>
  );
}
