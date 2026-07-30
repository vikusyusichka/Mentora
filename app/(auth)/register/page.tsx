"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthLogo } from "@/components/auth/auth-logo";
import { AuthButton } from "@/components/auth/auth-button";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { registerWithEmail, loginWithGoogle } from "@/lib/firebase/auth-helpers";
import { authErrorMessage } from "@/lib/firebase/auth-errors";
import { useAuth } from "@/lib/hooks/use-auth";
import { dashboardPath } from "@/lib/types";

const schema = z
  .object({
    email: z.string().email("Некоректна пошта"),
    password: z.string().min(8, "Мінімум 8 символів"),
    confirmPassword: z.string().min(1, "Підтвердіть пароль"),
    terms: z.literal(true, {
      errorMap: () => ({ message: "Потрібно прийняти умови" }),
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Паролі не збігаються",
  });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { status, role } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Після реєстрації статус стане needs-onboarding → ведемо на онбординг.
  useEffect(() => {
    if (status === "needs-onboarding") router.replace("/onboarding");
    else if (status === "authenticated" && role)
      router.replace(dashboardPath(role));
  }, [status, role, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      await registerWithEmail(values.email, values.password);
    } catch (err) {
      setFormError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    setSubmitting(true);
    setFormError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      setFormError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center">
      <AuthLogo tagline="Ваш шлях до досконалості починається тут." />

      <AuthCard
        title="Створити акаунт"
        description="Приєднуйтесь до спільноти менторства."
        footer={
          <SocialAuthButtons
            onGoogle={onGoogle}
            disabled={submitting}
            label="Або зареєструватися з"
          />
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <AuthInput
            id="email"
            label="Електронна пошта"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="напр. olena@example.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <AuthInput
            id="password"
            label="Пароль"
            icon={Lock}
            type="password"
            autoComplete="new-password"
            placeholder="Мінімум 8 символів"
            error={errors.password?.message}
            {...register("password")}
          />

          <AuthInput
            id="confirmPassword"
            label="Підтвердіть пароль"
            icon={ShieldCheck}
            type="password"
            autoComplete="new-password"
            placeholder="Повторіть пароль"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-input accent-gold"
                {...register("terms")}
              />
              <label
                htmlFor="terms"
                className="text-label-sm cursor-pointer leading-snug text-muted-foreground"
              >
                Я приймаю{" "}
                <span className="font-semibold text-secondary">
                  Умови користування
                </span>{" "}
                та{" "}
                <span className="font-semibold text-secondary">
                  Політику конфіденційності
                </span>
                .
              </label>
            </div>
            {errors.terms && (
              <p className="text-label-sm px-1 text-terracotta">
                {errors.terms.message}
              </p>
            )}
          </div>

          {formError && (
            <p
              role="alert"
              className="text-label-md rounded-input bg-terracotta/10 px-4 py-3 text-terracotta"
            >
              {formError}
            </p>
          )}

          <AuthButton type="submit" loading={submitting}>
            Зареєструватися
            {!submitting && <ArrowRight className="size-5" strokeWidth={2.5} />}
          </AuthButton>
        </form>
      </AuthCard>

      <p className="text-body-md mt-8 text-center text-muted-foreground">
        Вже є акаунт?{" "}
        <Link
          href="/login"
          className="font-bold text-secondary underline-offset-4 hover:underline"
        >
          Увійти
        </Link>
      </p>
    </div>
  );
}
