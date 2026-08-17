"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/firebase/auth-helpers";
import { useAuth } from "@/lib/hooks/use-auth";
import { DASHBOARD_NAV, type NavItem } from "@/lib/dashboard-nav";
import { ROLE_LABELS, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Оболонка кабінетів за еталоном `maroon_theme_4/screen.png`:
 * фіксований maroon-сайдбар 280px, золотий wordmark, активний пункт із
 * золотою смугою зліва, золота кнопка-пігулка й «Вийти» внизу.
 *
 * Свідомі відступи від макета: пошук у верхній панелі й дзвіночок сповіщень
 * не відтворені — повнотекстового пошуку і нотифікацій у продукті ще немає,
 * а мертві контроли гірші за їхню відсутність.
 */
export function DashboardLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { user, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // AuthGate не пускає сюди без ролі, але тип цього не знає.
  if (!role) return null;

  return (
    <div className="flex min-h-full flex-1">
      {/* Десктоп: сайдбар завжди на місці */}
      <div className="hidden w-sidebar shrink-0 lg:block">
        <Sidebar role={role} className="fixed inset-y-0 left-0 w-sidebar" />
      </div>

      {/* Мобільний: сайдбар виїжджає поверх контенту */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-deep-maroon/40"
            aria-label="Закрити меню"
            onClick={() => setMenuOpen(false)}
          />
          <Sidebar
            role={role}
            className="absolute inset-y-0 left-0 w-sidebar max-w-[85vw]"
            onNavigate={() => setMenuOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full text-secondary lg:hidden"
            aria-label="Відкрити меню"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-label-md text-secondary">
                {user?.displayName || user?.email}
              </p>
              <p className="text-label-sm uppercase tracking-[0.12em] text-muted-foreground">
                {ROLE_LABELS[role]}
              </p>
            </div>
            <Avatar
              photoURL={user?.photoURL}
              name={user?.displayName ?? user?.email ?? ""}
            />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 pb-14 lg:px-10">
          <div className="mx-auto w-full max-w-content-max">
            <div className="mb-8">
              <h1 className="text-display-lg text-secondary">{title}</h1>
              {description && (
                <p className="text-body-lg mt-3 max-w-2xl text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  role,
  className,
  onNavigate,
}: {
  role: Role;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = DASHBOARD_NAV[role];

  return (
    <nav
      className={cn(
        "z-50 flex flex-col bg-deep-maroon px-4 py-7",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3">
        <Link href={`/${role}`} onClick={onNavigate}>
          <span className="text-headline-md block text-gold">Mentora</span>
          <span className="text-label-sm mt-1 block uppercase tracking-[0.16em] text-sidebar-muted">
            {nav.caption}
          </span>
        </Link>

        {onNavigate && (
          <button
            type="button"
            className="rounded-full p-1 text-sidebar-muted lg:hidden"
            aria-label="Закрити меню"
            onClick={onNavigate}
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <ul className="mt-10 space-y-1">
        {nav.items.map((item) => (
          <li key={`${item.label}-${item.href}`}>
            <SidebarItem
              item={item}
              active={!item.soon && pathname === item.href}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2 pt-8">
        <Button
          className="text-label-md w-full rounded-full"
          size="lg"
          render={<Link href={nav.action.href} onClick={onNavigate} />}
        >
          {nav.action.label}
        </Button>

        <button
          type="button"
          onClick={() => logout()}
          className="text-label-md flex w-full items-center gap-3 rounded-full px-4 py-3 text-sidebar-muted transition-colors hover:text-gold"
        >
          <LogOut className="size-5" strokeWidth={2} aria-hidden />
          Вийти
        </button>
      </div>
    </nav>
  );
}

function SidebarItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { icon: Icon, label } = item;

  const inner = (
    <>
      {/* Золота смуга зліва — головна ознака активного пункту на еталоні. */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-r-full",
          active && "bg-gold"
        )}
        aria-hidden
      />
      <Icon className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{label}</span>
      {item.soon && (
        <span className="text-label-sm ml-auto rounded-full bg-maroon-active px-2 py-0.5 text-sidebar-muted">
          Скоро
        </span>
      )}
    </>
  );

  const base =
    "text-label-md relative flex w-full items-center gap-3 rounded-2xl py-3 pl-5 pr-3";

  if (item.soon) {
    return (
      <span className={cn(base, "cursor-default text-sidebar-muted/70")}>
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        "transition-colors",
        active
          ? "bg-maroon-active text-gold"
          : "text-sidebar-muted hover:bg-maroon-active/60 hover:text-gold"
      )}
    >
      {inner}
    </Link>
  );
}

function Avatar({
  photoURL,
  name,
}: {
  photoURL?: string | null;
  name: string;
}) {
  if (photoURL) {
    return (
      <Image
        src={photoURL}
        alt={name}
        width={44}
        height={44}
        className="size-11 rounded-full object-cover"
        unoptimized
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <span className="flex size-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
      {initial ? (
        <span className="text-title-lg">{initial}</span>
      ) : (
        <UserRound className="size-5" strokeWidth={2} aria-hidden />
      )}
    </span>
  );
}
