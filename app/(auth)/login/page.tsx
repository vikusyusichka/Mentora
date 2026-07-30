"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthLogo } from "@/components/auth/auth-logo";
import { AuthButton } from "@/components/auth/auth-button";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import {
  loginWithEmail,
  loginWithGoogle,
  resetPassword,
} from "@/lib/firebase/auth-helpers";
import { toast } from "sonner";
import { authErrorMessage } from "@/lib/firebase/auth-errors";
import { useAuth } from "@/lib/hooks/use-auth";
import { dashboardPath } from "@/lib/types";

const schema = z.object({
  email: z.string().email("Некоректна пошта"),
  password: z.string().min(1, "Введіть пароль"),
  remember: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { status, role } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Редірект уже авторизованого користувача.
  useEffect(() => {
    if (status === "authenticated" && role) router.replace(dashboardPath(role));
    else if (status === "needs-onboarding") router.replace("/onboarding");
  }, [status, role, router]);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onForgotPassword() {
    const email = getValues("email");
    if (!email || !z.string().email().safeParse(email).success) {
      toast.error("Спочатку введіть свою пошту у полі вище.");
      return;
    }
    try {
      await resetPassword(email);
      toast.success(`Лист для скидання пароля надіслано на ${email}.`);
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      await loginWithEmail(values.email, values.password, !!values.remember);
      // редірект відпрацює через ефект, коли оновиться статус
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
      <AuthLogo
        variant="wordmark"
        tagline="Преміальна платформа менторства"
      />

      <AuthCard
        title="З поверненням"
        description="Увійдіть, щоб продовжити свій шлях."
        footer={<SocialAuthButtons onGoogle={onGoogle} disabled={submitting} />}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <AuthInput
            id="email"
            label="Електронна пошта"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="напр. mentor@example.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <AuthInput
            id="password"
            label="Пароль"
            icon={Lock}
            type="password"
            autoComplete="current-password"
            placeholder="Введіть пароль"
            error={errors.password?.message}
            labelAction={
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-label-sm font-bold text-terracotta transition-opacity hover:opacity-80"
              >
                Забули пароль?
              </button>
            }
            {...register("password")}
          />

          <div className="flex items-center gap-3 px-1">
            <input
              id="remember"
              type="checkbox"
              className="size-5 cursor-pointer rounded border-input accent-gold"
              {...register("remember")}
            />
            <label
              htmlFor="remember"
              className="text-label-sm cursor-pointer select-none text-muted-foreground"
            >
              {"Запам'ятати цей пристрій на 30 днів"}
            </label>
          </div>

          {formError && (
            <p
              role="alert"
              className="text-label-md rounded-input bg-terracotta/10 px-4 py-3 text-terracotta"
            >
              {formError}
            </p>
          )}

          <AuthButton type="submit" loading={submitting} className="mt-2">
            Увійти
          </AuthButton>
        </form>
      </AuthCard>

      <p className="text-body-md mt-8 text-center text-muted-foreground">
        Немає акаунта?{" "}
        <Link
          href="/register"
          className="font-bold text-secondary underline-offset-4 hover:underline"
        >
          Зареєструватися
        </Link>
      </p>
    </div>
  );
}
