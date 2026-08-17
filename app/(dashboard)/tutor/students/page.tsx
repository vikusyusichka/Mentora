"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Users } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useEnrollments } from "@/lib/hooks/use-enrollments";
import { levelsRange } from "@/lib/tutor-profile";
import type { EnrollmentWithId } from "@/lib/enrollment";

function StudentsList() {
  const { enrollments, error } = useEnrollments("tutor");

  if (enrollments === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо учнів…
      </p>
    );
  }

  if (error) {
    return <p className="text-body-md text-terracotta">{error}</p>;
  }

  if (enrollments.length === 0) {
    return (
      <div className="rounded-card border border-border bg-card p-10 text-center shadow-level1">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
          <Users className="size-7" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="text-title-lg mb-2">Учнів поки немає</h2>
        <p className="text-body-md mx-auto max-w-md text-muted-foreground">
          Учень зʼявляється тут після того, як оплатить у вас перший урок.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card overflow-hidden border border-border bg-card shadow-level1">
      {/* Шапка таблиці за еталоном: капс із розрядкою на теплому фоні */}
      <div className="text-label-sm hidden bg-search-field px-6 py-4 uppercase tracking-[0.08em] text-muted-foreground sm:grid sm:grid-cols-[2fr_1fr_1fr_auto] sm:gap-4">
        <span>Учень</span>
        <span>Рівень</span>
        <span>Уроків</span>
        <span className="sr-only">Дія</span>
      </div>

      <ul>
        {enrollments.map((enrollment) => (
          <li key={enrollment.id} className="border-t border-border first:border-t-0">
            <Link
              href={`/tutor/students/${enrollment.id}`}
              className="grid gap-2 px-6 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-label-md truncate text-secondary">
                  {enrollment.name}
                </p>
                <p className="text-label-sm text-muted-foreground">
                  {enrollment.languages.length > 0
                    ? enrollment.languages.join(", ")
                    : "Мову не вказано"}
                </p>
              </div>

              <span className="text-label-md text-muted-foreground">
                {levelLabel(enrollment)}
              </span>

              <span className="text-label-md text-muted-foreground">
                {enrollment.lessonsCount}
              </span>

              <ArrowRight
                className="hidden size-4 text-secondary sm:block"
                strokeWidth={2.5}
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function levelLabel(enrollment: EnrollmentWithId): string {
  if (!enrollment.currentLevel && !enrollment.goalLevel) return "Не вказано";
  if (!enrollment.goalLevel) return enrollment.currentLevel ?? "—";
  if (!enrollment.currentLevel) return `→ ${enrollment.goalLevel}`;
  return levelsRange([enrollment.currentLevel, enrollment.goalLevel]);
}

export default function TutorStudentsPage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Мої учні"
        description="Кожен учень зʼявляється тут після першої оплаченої броні."
      >
        <StudentsList />
      </DashboardLayout>
    </AuthGate>
  );
}
