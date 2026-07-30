"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function StudentDashboardPage() {
  return (
    <AuthGate allow={["student"]}>
      <DashboardShell>
        <h1 className="text-2xl font-semibold">Кабінет учня</h1>
        <p className="mt-2 text-muted-foreground">
          Тут з&apos;являться каталог, бронювання, прогрес і ДЗ (Фази A–C).
        </p>
      </DashboardShell>
    </AuthGate>
  );
}
