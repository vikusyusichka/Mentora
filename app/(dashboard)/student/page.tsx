"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { HomeworkList } from "@/components/homework/homework-list";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { LessonHistory } from "@/components/lessons/lesson-history";
import { UpcomingLessons } from "@/components/lessons/upcoming-lessons";
import { StudentBookings } from "./bookings";
import { ParentAccess } from "./parent-access";

export default function StudentDashboardPage() {
  return (
    <AuthGate allow={["student"]}>
      <DashboardLayout
        title="Кабінет учня"
        description="Заняття, прогрес і домашні завдання — усе в одному місці."
      >
        <section className="rounded-card mb-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
          <h2 className="text-title-lg mb-5">Найближчі заняття</h2>
          <UpcomingLessons role="student" />
        </section>

        <section id="progress" className="rounded-card mb-8 scroll-mt-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
          <h2 className="text-title-lg mb-5">Мій прогрес</h2>
          <ProgressPanel role="student" />
        </section>

        <div className="mb-8 grid gap-8 xl:grid-cols-2">
          <section id="lessons" className="rounded-card scroll-mt-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
            <h2 className="text-title-lg mb-5">Останні уроки</h2>
            <LessonHistory role="student" />
          </section>

          <section id="homework" className="rounded-card scroll-mt-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
            <h2 className="text-title-lg mb-5">Домашні завдання</h2>
            <HomeworkList role="student" />
          </section>
        </div>

        <section className="rounded-card mb-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
          <h2 className="text-title-lg mb-5">Доступ для батьків</h2>
          <ParentAccess />
        </section>

        <section className="rounded-card mb-8 border border-border bg-card p-6 shadow-level1 sm:p-8">
          <h2 className="text-title-lg mb-5">Мої бронювання</h2>
          <StudentBookings />
        </section>

      </DashboardLayout>
    </AuthGate>
  );
}
