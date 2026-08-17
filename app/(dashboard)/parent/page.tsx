"use client";

import { BookOpen, KeyRound, LineChart } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  SectionCards,
  type DashboardSection,
} from "@/components/dashboard/section-cards";

const SECTIONS: DashboardSection[] = [
  {
    icon: KeyRound,
    title: "Приєднатися до дитини",
    description: "Інвайт-код, який генерує учень у своєму кабінеті (Фаза C).",
  },
  {
    icon: LineChart,
    title: "Прогрес дитини",
    description: "Рівень, кількість уроків і темп занять (Фаза C).",
  },
  {
    icon: BookOpen,
    title: "Останні теми",
    description: "Про що були уроки й нотатки від репетитора (Фаза C).",
  },
];

export default function ParentDashboardPage() {
  return (
    <AuthGate allow={["parent"]}>
      <DashboardLayout
        title="Кабінет батьків"
        description="Тут буде прогрес дитини. Щоб він зʼявився, потрібен інвайт-код від учня."
      >
        <SectionCards sections={SECTIONS} />
      </DashboardLayout>
    </AuthGate>
  );
}
