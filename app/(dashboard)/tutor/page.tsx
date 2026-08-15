"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound, Users } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const SECTIONS = [
  {
    href: "/tutor/profile",
    icon: UserRound,
    title: "Профіль",
    description: "Мови, рівні, ціна й біо. Публікація в каталозі.",
    ready: true,
  },
  {
    href: "/tutor",
    icon: CalendarDays,
    title: "Розклад",
    description: "Слоти доступності та бронювання (Фаза B).",
    ready: false,
  },
  {
    href: "/tutor",
    icon: Users,
    title: "Мої учні",
    description: "Прогрес, звіти після уроків, ДЗ (Фаза C).",
    ready: false,
  },
];

export default function TutorDashboardPage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardShell>
        <header className="mb-8">
          <h1 className="text-headline-lg">Кабінет репетитора</h1>
          <p className="text-body-md mt-2 text-muted-foreground">
            Почніть із профілю — без нього учні вас не знайдуть.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map(({ href, icon: Icon, title, description, ready }) => {
            const card = (
              <>
                <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                </span>
                <h2 className="text-title-lg mb-2">{title}</h2>
                <p className="text-body-md grow text-muted-foreground">
                  {description}
                </p>
                {ready && (
                  <span className="text-label-md mt-4 flex items-center gap-2 text-secondary">
                    Відкрити
                    <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
                  </span>
                )}
              </>
            );

            return ready ? (
              <Link
                key={title}
                href={href}
                className="flex flex-col rounded-card border border-border bg-card p-6 shadow-level1 transition-all hover:-translate-y-1 hover:shadow-level1-hover"
              >
                {card}
              </Link>
            ) : (
              <div
                key={title}
                className="flex flex-col rounded-card border border-border bg-card/60 p-6 opacity-60"
              >
                {card}
                <span className="text-label-sm mt-4 text-outline">Скоро</span>
              </div>
            );
          })}
        </div>
      </DashboardShell>
    </AuthGate>
  );
}
