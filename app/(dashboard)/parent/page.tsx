"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function ParentDashboardPage() {
  return (
    <AuthGate allow={["parent"]}>
      <DashboardShell>
        <h1 className="text-2xl font-semibold">Кабінет батьків</h1>
        <p className="mt-2 text-muted-foreground">
          Тут з&apos;явиться прогрес дитини (Фаза C).
        </p>
      </DashboardShell>
    </AuthGate>
  );
}
