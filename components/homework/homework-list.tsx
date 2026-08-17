"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HOMEWORK_STATUS_LABELS,
  isOverdue,
  type HomeworkWithId,
} from "@/lib/enrollment";
import {
  subscribeHomework,
  submitHomework,
} from "@/lib/firebase/enrollment-repo";
import { useEnrollments } from "@/lib/hooks/use-enrollments";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Item extends HomeworkWithId {
  enrollmentId: string;
}

/**
 * Домашні завдання очима учня й батьків.
 *
 * Учень позначає виконання й лишає посилання на роботу — рівно ті два
 * поля, які дозволяють Security Rules. Батьки бачать те саме, але без дій.
 */
export function HomeworkList({ role }: { role: Role }) {
  const { enrollments } = useEnrollments(role);
  const [byEnrollment, setByEnrollment] = useState<Record<string, Item[]>>({});
  const [ready, setReady] = useState(false);

  const ids = (enrollments ?? []).map((e) => e.id).join(",");

  useEffect(() => {
    if (!enrollments || enrollments.length === 0) return;

    const unsubscribers = enrollments.map((enrollment) =>
      subscribeHomework(
        enrollment.id,
        (homework) => {
          setByEnrollment((prev) => ({
            ...prev,
            [enrollment.id]: homework.map((h) => ({
              ...h,
              enrollmentId: enrollment.id,
            })),
          }));
          setReady(true);
        },
        (err) => {
          console.error("[homework]", err);
          setReady(true);
        }
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [ids, enrollments]);

  if (enrollments === null || (enrollments.length > 0 && !ready)) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо…
      </p>
    );
  }

  const items = Object.values(byEnrollment)
    .flat()
    .sort((a, b) => b.deadline.localeCompare(a.deadline));

  if (items.length === 0) {
    return (
      <p className="text-body-md text-muted-foreground">
        Завдань поки немає.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <HomeworkItem key={`${item.enrollmentId}/${item.id}`} item={item} role={role} />
      ))}
    </ul>
  );
}

function HomeworkItem({ item, role }: { item: Item; role: Role }) {
  const [link, setLink] = useState(item.submissionFileUrl);
  const [saving, setSaving] = useState(false);
  const canSubmit = role === "student";

  async function markDone() {
    setSaving(true);
    try {
      await submitHomework(item.enrollmentId, item.id, {
        status: "done",
        submissionFileUrl: link.trim(),
      });
      toast.success("Завдання позначено виконаним.");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося зберегти.");
    } finally {
      setSaving(false);
    }
  }

  const overdue = isOverdue(item);

  return (
    <li className="rounded-input border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-body-md min-w-0 flex-1 whitespace-pre-line">
          {item.text}
        </p>
        <span
          className={cn(
            "text-label-sm rounded-full px-3 py-1",
            item.status === "done"
              ? "bg-sage-green/10 text-sage-green"
              : overdue
                ? "bg-terracotta/10 text-terracotta"
                : "bg-soft-gold text-secondary"
          )}
        >
          {overdue ? "Прострочено" : HOMEWORK_STATUS_LABELS[item.status]}
        </span>
      </div>

      <p className="text-label-sm mt-2 text-outline">
        До {formatDeadline(item.deadline)}
      </p>

      {item.status === "done" && item.submissionFileUrl && (
        <a
          href={item.submissionFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-label-md mt-2 inline-block text-secondary underline-offset-4 hover:underline"
        >
          Здана робота
        </a>
      )}

      {canSubmit && item.status !== "done" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Посилання, а не файл: Cloud Storage вимагає платного плану —
              те саме обхідне рішення, що й для фото профілю. */}
          <Input
            className="h-10 w-full rounded-input bg-card sm:w-auto sm:flex-1"
            placeholder="Посилання на роботу (необовʼязково)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Button
            className="rounded-full"
            onClick={markDone}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" strokeWidth={2} />
            )}
            Виконано
          </Button>
        </div>
      )}
    </li>
  );
}

function formatDeadline(deadline: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(new Date(`${deadline}T00:00:00.000Z`));
}
