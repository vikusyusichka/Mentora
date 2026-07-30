"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function TutorDashboardPage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardShell>
        <h1 className="text-2xl font-semibold">Кабінет репетитора</h1>
        <p className="mt-2 text-muted-foreground">
          Тут з&apos;являться профіль, учні й розклад (Фази A–C).
        </p>
      </DashboardShell>
    </AuthGate>
  );
}
