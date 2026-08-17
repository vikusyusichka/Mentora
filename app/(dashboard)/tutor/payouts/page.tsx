"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, ExternalLink, Loader2, TriangleAlert } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { PLATFORM_FEE_RATE } from "@/lib/booking";

interface PayoutStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  provider?: string;
}

function PayoutsSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/payouts/onboard", {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as PayoutStatus & { error?: string };
        if (cancelled) return;

        if (!response.ok) {
          setError(data.error ?? "Не вдалося отримати стан виплат.");
          setStatus({ connected: false, payoutsEnabled: false });
          return;
        }
        setStatus(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Не вдалося звʼязатися з сервером.");
          setStatus({ connected: false, payoutsEnabled: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function startOnboarding() {
    if (!user) return;
    setRedirecting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/payouts/onboard", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        toast.error(data.error ?? "Не вдалося почати налаштування виплат.");
        setRedirecting(false);
        return;
      }
      // Анкету заповнюють на боці провайдера — повертає він сам.
      window.location.assign(data.url);
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося звʼязатися з сервером.");
      setRedirecting(false);
    }
  }

  if (status === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Перевіряємо стан виплат…
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
        <div className="mb-5 flex items-start gap-4">
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
              status.payoutsEnabled
                ? "bg-sage-green/10 text-sage-green"
                : "bg-secondary/10 text-secondary"
            }`}
          >
            {status.payoutsEnabled ? (
              <BadgeCheck className="size-6" strokeWidth={1.75} aria-hidden />
            ) : (
              <TriangleAlert className="size-6" strokeWidth={1.75} aria-hidden />
            )}
          </span>

          <div>
            <h2 className="text-title-lg mb-1">
              {status.payoutsEnabled
                ? "Виплати налаштовано"
                : status.connected
                  ? "Анкету не завершено"
                  : "Виплати ще не налаштовано"}
            </h2>
            <p className="text-body-md text-muted-foreground">
              {status.payoutsEnabled
                ? "Учні можуть оплачувати ваші уроки. Гроші приходять на ваш рахунок у провайдера."
                : "Поки виплати не налаштовані, учні бачать ваш профіль і розклад, але не можуть оплатити урок."}
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="rounded-full"
          onClick={startOnboarding}
          disabled={redirecting}
        >
          {redirecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ExternalLink className="size-4" strokeWidth={2} />
          )}
          {status.connected ? "Продовжити налаштування" : "Налаштувати виплати"}
        </Button>

        {error && <p className="text-label-md mt-4 text-terracotta">{error}</p>}
      </section>

      <section className="rounded-card border border-border bg-beige-card p-6">
        <h3 className="text-title-lg mb-2">Як рахуються гроші</h3>
        <p className="text-body-md text-muted-foreground">
          Учень платить повну вартість уроку. Платформа утримує{" "}
          <strong className="text-secondary">
            {Math.round(PLATFORM_FEE_RATE * 100)}%
          </strong>{" "}
          комісії, решта переказується вам. Комісія утримується автоматично при
          оплаті — окремо нічого сплачувати не треба.
        </p>
      </section>
    </div>
  );
}

export default function TutorPayoutsPage() {
  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Виплати"
        description="Щоб приймати оплату за уроки, підключіть рахунок у платіжного провайдера."
      >
        <PayoutsSettings />
      </DashboardLayout>
    </AuthGate>
  );
}
