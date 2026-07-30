"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { dashboardPath, type Role } from "@/lib/types";
import { LoadingScreen } from "@/components/loading-screen";

/**
 * Гард захищених сторінок.
 * - неавторизований → /login
 * - авторизований без ролі → /onboarding
 * - роль не в `allow` → редірект у власний кабінет
 *
 * УВАГА: це UX-гард (клієнтський). Реальний захист даних забезпечують
 * Firestore Security Rules — клієнтський редірект лише ховає чужі екрани.
 */
export function AuthGate({
  allow,
  children,
}: {
  allow?: Role[];
  children: ReactNode;
}) {
  const { status, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "needs-onboarding") {
      router.replace("/onboarding");
      return;
    }
    if (role && allow && !allow.includes(role)) {
      router.replace(dashboardPath(role));
    }
  }, [status, role, allow, router]);

  const authorized =
    status === "authenticated" && role && (!allow || allow.includes(role));

  if (!authorized) return <LoadingScreen />;
  return <>{children}</>;
}
