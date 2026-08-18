"use client";

import { Loader2 } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { HomeworkList } from "@/components/homework/homework-list";
import { LessonHistory } from "@/components/lessons/lesson-history";
import { UpcomingLessons } from "@/components/lessons/upcoming-lessons";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { useEnrollments } from "@/lib/hooks/use-enrollments";
import { JoinForm } from "./join-form";

function ParentDashboard() {
  const { enrollments } = useEnrollments("parent");

  if (enrollments === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо…
      </p>
    );
  }

  if (enrollments.length === 0) {
    return (
      <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
        <h2 className="text-title-lg mb-5">Приєднатися до дитини</h2>
        <JoinForm />
      </section>
    );
  }

  return (
    <>
      <section className="rounded-card mb-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
        <h2 className="text-title-lg mb-5">Найближчі заняття дитини</h2>
        <UpcomingLessons role="parent" />
      </section>

      <section
        id="progress"
        className="rounded-card mb-8 scroll-mt-8 border border-border bg-card p-6 shadow-level1 sm:p-8"
      >
        <h2 className="text-title-lg mb-5">Прогрес дитини</h2>
        <ProgressPanel role="parent" />
      </section>

      <div className="mb-8 grid gap-8 xl:grid-cols-2">
        <section
          id="lessons"
          className="rounded-card scroll-mt-8 border border-border bg-card p-6 shadow-level1 sm:p-8"
        >
          <h2 className="text-title-lg mb-5">Останні уроки</h2>
          <LessonHistory role="parent" />
        </section>

        <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
          <h2 className="text-title-lg mb-5">Домашні завдання</h2>
          <HomeworkList role="parent" />
        </section>
      </div>
    </>
  );
}

export default function ParentDashboardPage() {
  return (
    <AuthGate allow={["parent"]}>
      <DashboardLayout
        title="Кабінет батьків"
        description="Прогрес дитини, теми уроків і домашні завдання — у режимі читання."
      >
        <ParentDashboard />
      </DashboardLayout>
    </AuthGate>
  );
}
