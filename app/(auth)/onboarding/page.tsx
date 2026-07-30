"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, User, Users } from "lucide-react";

import { AuthInput } from "@/components/auth/auth-input";
import { AuthButton } from "@/components/auth/auth-button";
import { RoleCard } from "@/components/auth/role-card";
import { completeOnboarding, logout } from "@/lib/firebase/auth-helpers";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  ROLES,
  ROLE_CARD_TITLES,
  ROLE_DESCRIPTIONS,
  ROLE_CTA,
  dashboardPath,
  type Role,
} from "@/lib/types";

const ROLE_ICONS = {
  tutor: GraduationCap,
  student: User,
  parent: Users,
} as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, status, role, refreshRole } = useAuth();

  const [selected, setSelected] = useState<Role | null>(null);
  // null = користувач ще не редагував поле → показуємо ім'я з профілю
  // (напр. після входу через Google). Так обходимося без setState в ефекті.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const name = draftName ?? user?.displayName ?? "";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (status === "authenticated" && role)
      router.replace(dashboardPath(role));
  }, [status, role, router]);

  async function onSubmit() {
    if (!user || !selected) return;
    if (!name.trim()) {
      toast.error("Вкажіть, як вас звати.");
      return;
    }
    setSubmitting(true);
    try {
      await completeOnboarding(user, selected, name);
      const r = await refreshRole();
      router.replace(dashboardPath(r ?? selected));
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося завершити налаштування. Спробуйте ще раз.");
      setSubmitting(false);
    }
  }

  if (status !== "needs-onboarding") {
    return null; // ефект вище зробить редірект
  }

  return (
    <div className="flex w-full max-w-[1200px] flex-col items-center">
      <header className="mb-12 text-center">
        <h1 className="text-display-lg mb-4 tracking-tight">Mentora</h1>
        <h2 className="text-headline-md mx-auto max-w-xl text-muted-foreground">
          Вітаємо! Як ви плануєте користуватися платформою?
        </h2>
        <p className="text-body-lg mt-4 text-outline">
          Оберіть роль — її не можна буде змінити пізніше.
        </p>
      </header>

      {/* Ім'я потрібне для профілю — у макеті цього поля не було. */}
      <div className="mb-12 w-full max-w-sm">
        <AuthInput
          id="name"
          label="Ваше ім'я"
          icon={User}
          value={name}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Напр. Олена"
          autoComplete="name"
        />
      </div>

      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
        {ROLES.map((r) => (
          <RoleCard
            key={r}
            icon={ROLE_ICONS[r]}
            title={ROLE_CARD_TITLES[r]}
            description={ROLE_DESCRIPTIONS[r]}
            cta={ROLE_CTA[r]}
            selected={selected === r}
            onSelect={() => setSelected(r)}
          />
        ))}
      </div>

      <div className="mt-12 flex w-full max-w-sm flex-col items-center gap-4">
        <AuthButton
          onClick={onSubmit}
          loading={submitting}
          disabled={!selected}
          className="px-12"
        >
          Підтвердити вибір
        </AuthButton>

        <button
          type="button"
          onClick={() => logout()}
          disabled={submitting}
          className="text-label-md text-muted-foreground underline-offset-4 transition-colors hover:text-secondary hover:underline disabled:opacity-50"
        >
          Вийти з акаунта
        </button>
      </div>
    </div>
  );
}
