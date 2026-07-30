"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { logout } from "@/lib/firebase/auth-helpers";
import { ROLE_LABELS } from "@/lib/types";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Mentora
            </Link>
            {role && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => logout()}
              aria-label="Вийти"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
