"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCode, type InviteWithCode } from "@/lib/invite";
import {
  requestInvite,
  subscribeMyInvites,
} from "@/lib/firebase/invite-repo";
import { useEnrollments } from "@/lib/hooks/use-enrollments";
import { useAuth } from "@/lib/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Доступ для батьків: учень створює одноразовий код і передає його.
 *
 * Імен приєднаних батьків тут немає навмисно — учень не має права читати
 * чужі картки користувачів, а денормалізувати імена в звʼязок означало б
 * тримати їх свіжими заради одного рядка. Кому саме дали код, учень і так
 * знає: код одноразовий і передається особисто.
 */
export function ParentAccess() {
  const { user } = useAuth();
  const { enrollments } = useEnrollments("student");
  const [invites, setInvites] = useState<InviteWithCode[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeMyInvites(user.uid, setInvites, (err) => {
      console.error("[invites]", err);
      setInvites([]);
    });
  }, [user]);

  const enrollment = enrollments?.[0];
  const parentCount = enrollment?.parentUids.length ?? 0;

  async function create() {
    if (!user || !enrollment) return;
    setCreating(true);
    try {
      const token = await user.getIdToken();
      const result = await requestInvite(token, enrollment.id);
      if (!result.ok) {
        toast.error(result.error ?? "Не вдалося створити код.");
        return;
      }
      toast.success("Код створено. Передайте його батькам.");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося звʼязатися з сервером.");
    } finally {
      setCreating(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(formatCode(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Не вдалося скопіювати — перепишіть код вручну.");
    }
  }

  if (enrollments === null || invites === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо…
      </p>
    );
  }

  if (!enrollment) {
    return (
      <p className="text-body-md text-muted-foreground">
        Запросити батьків можна після першого оплаченого уроку.
      </p>
    );
  }

  const active = invites.filter((invite) => !invite.usedBy);

  return (
    <div className="space-y-5">
      <p className="text-body-md text-muted-foreground">
        Батьки бачитимуть ваш прогрес, теми уроків і домашні завдання —
        лише для читання. Код одноразовий і діє тиждень.
        {parentCount > 0 && (
          <>
            {" "}
            <span className="text-sage-green">
              Приєднано: {parentCount}.
            </span>
          </>
        )}
      </p>

      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((invite) => (
            <li
              key={invite.code}
              className="flex flex-wrap items-center justify-between gap-3 rounded-input bg-search-field/60 p-4"
            >
              <span className="text-headline-md tracking-[0.08em] text-secondary">
                {formatCode(invite.code)}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-label-sm text-outline">
                  діє до {formatDate(invite.expiresAt)}
                </span>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => copy(invite.code)}
                >
                  {copied === invite.code ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : (
                    <Copy className="size-4" strokeWidth={2} />
                  )}
                  {copied === invite.code ? "Скопійовано" : "Копіювати"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant={active.length > 0 ? "outline" : "default"}
        size="lg"
        className={cn("rounded-full")}
        onClick={create}
        disabled={creating}
      >
        {creating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" strokeWidth={2.5} />
        )}
        {active.length > 0 ? "Створити ще один код" : "Створити код для батьків"}
      </Button>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}
