"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  HOMEWORK_STATUS_LABELS,
  isOverdue,
  type HomeworkWithId,
} from "@/lib/enrollment";
import {
  createHomework,
  deleteHomework,
  subscribeHomework,
} from "@/lib/firebase/enrollment-repo";
import { cn } from "@/lib/utils";

/** Домашні завдання учня: видача, перегляд статусу, видалення. */
export function HomeworkPanel({ enrollmentId }: { enrollmentId: string }) {
  const [homework, setHomework] = useState<HomeworkWithId[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [saving, setSaving] = useState(false);

  useEffect(
    () =>
      subscribeHomework(enrollmentId, setHomework, (err) => {
        console.error("[homework]", err);
        setHomework([]);
      }),
    [enrollmentId]
  );

  async function add() {
    if (text.trim().length < 3) {
      toast.error("Опишіть завдання докладніше.");
      return;
    }
    setSaving(true);
    try {
      await createHomework(enrollmentId, { text, deadline });
      setText("");
      setAdding(false);
      toast.success("Завдання задано.");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося задати завдання.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(homeworkId: string) {
    try {
      await deleteHomework(enrollmentId, homeworkId);
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося видалити завдання.");
    }
  }

  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-lg">Домашні завдання</h2>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Задати
        </Button>
      </div>

      {adding && (
        <div className="mb-6 space-y-4 rounded-input bg-search-field/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="hw-text">Завдання</Label>
            <Textarea
              id="hw-text"
              rows={2}
              placeholder="Що зробити до наступного уроку"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="hw-deadline">Дедлайн</Label>
            <input
              id="hw-deadline"
              type="date"
              className="text-body-md h-10 w-full rounded-input border border-input bg-card px-3"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <Button className="rounded-full" onClick={add} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Задати завдання
          </Button>
        </div>
      )}

      {homework === null ? (
        <p className="text-label-md flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Завантажуємо…
        </p>
      ) : homework.length === 0 ? (
        <p className="text-body-md text-muted-foreground">
          Завдань ще немає.
        </p>
      ) : (
        <ul className="space-y-3">
          {homework.map((item) => (
            <li
              key={item.id}
              className="rounded-input border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-body-md min-w-0 flex-1 whitespace-pre-line">
                  {item.text}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-label-sm rounded-full px-3 py-1",
                      item.status === "done"
                        ? "bg-sage-green/10 text-sage-green"
                        : isOverdue(item)
                          ? "bg-terracotta/10 text-terracotta"
                          : "bg-soft-gold text-secondary"
                    )}
                  >
                    {isOverdue(item)
                      ? "Прострочено"
                      : HOMEWORK_STATUS_LABELS[item.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label="Видалити завдання"
                    className="text-muted-foreground transition-colors hover:text-terracotta"
                  >
                    <Trash2 className="size-4" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <p className="text-label-sm mt-2 text-outline">
                До {formatDeadline(item.deadline)}
                {item.submissionFileUrl && (
                  <>
                    {" · "}
                    <a
                      href={item.submissionFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary underline-offset-4 hover:underline"
                    >
                      Здана робота
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDeadline(deadline: string): string {
  const parsed = new Date(`${deadline}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function defaultDeadline(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}
