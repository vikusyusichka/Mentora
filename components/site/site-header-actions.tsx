"use client";

import { UserRound } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { useAuth } from "@/lib/hooks/use-auth";
import { ROLE_LABELS, dashboardPath } from "@/lib/types";

/**
 * Права частина публічної шапки — єдине, що залежить від входу.
 *
 * Виділена в клієнтський компонент навмисно: сторінки каталогу й профілю
 * лишаються серверними (їх має індексувати пошук), а стан сесії живе
 * тільки в браузері.
 */
export function SiteHeaderActions() {
  const { user, role, status } = useAuth();

  // Поки токен не перевірено, показуємо нейтральну заглушку тієї ж
  // ширини: інакше гість на мить бачив би «Кабінет», а учень — «Увійти».
  if (status === "loading") {
    return <span className="h-10 w-40 animate-pulse rounded-full bg-muted" />;
  }

  if (status === "authenticated" && role) {
    return (
      <>
        <span className="text-label-sm hidden text-right text-muted-foreground sm:block">
          {user?.displayName || user?.email}
          <br />
          <span className="uppercase tracking-[0.12em]">
            {ROLE_LABELS[role]}
          </span>
        </span>
        <ButtonLink
          href={dashboardPath(role)}
          className="text-label-md rounded-full px-5"
        >
          <UserRound className="size-4" strokeWidth={2} aria-hidden />
          Мій кабінет
        </ButtonLink>
      </>
    );
  }

  // Увійшов, але ролі ще немає — онбординг не завершено.
  if (status === "needs-onboarding") {
    return (
      <ButtonLink href="/onboarding" className="text-label-md rounded-full px-5">
        Завершити реєстрацію
      </ButtonLink>
    );
  }

  return (
    <>
      <ButtonLink
        href="/login"
        variant="ghost"
        className="text-label-md hidden rounded-full text-secondary sm:inline-flex"
      >
        Увійти
      </ButtonLink>
      <ButtonLink href="/register" className="text-label-md rounded-full px-5">
        Реєстрація
      </ButtonLink>
    </>
  );
}
