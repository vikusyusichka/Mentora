"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LessonWithId } from "@/lib/enrollment";
import { useAuth } from "@/lib/hooks/use-auth";

/**
 * Форма звіту після уроку. Разом зі звітом можна одразу задати ДЗ —
 * так репетитор закриває урок одним підходом, а не двома екранами.
 *
 * Надсилається на сервер, бо звіт оновлює лічильники учня, які правила
 * закривають від клієнта.
 */
export function LessonReportForm({
  enrollmentId,
  lesson,
  onDone,
}: {
  enrollmentId: string;
  lesson: LessonWithId;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const existing = lesson.report;

  const [topic, setTopic] = useState(existing?.topic ?? "");
  const [newWords, setNewWords] = useState(String(existing?.newWordsCount ?? 0));
  const [speaking, setSpeaking] = useState(existing?.speakingPractice ?? true);
  const [note, setNote] = useState(existing?.noteForStudent ?? "");
  const [withHomework, setWithHomework] = useState(false);
  const [homeworkText, setHomeworkText] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!user) return;

    const words = Number(newWords);
    if (!Number.isFinite(words) || words < 0) {
      toast.error("Кількість нових слів має бути числом.");
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/lessons/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enrollmentId,
          lessonId: lesson.id,
          report: {
            topic,
            newWordsCount: words,
            speakingPractice: speaking,
            noteForStudent: note,
          },
          homework: withHomework
            ? { text: homeworkText, deadline }
            : null,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Не вдалося зберегти звіт.");
        return;
      }

      toast.success(existing ? "Звіт оновлено." : "Звіт збережено.");
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося звʼязатися з сервером.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-input bg-search-field/60 p-4">
      <div className="space-y-2">
        <Label htmlFor={`topic-${lesson.id}`}>Тема уроку</Label>
        <Input
          id={`topic-${lesson.id}`}
          className="h-10 rounded-input bg-card"
          placeholder="Наприклад: минулий час, розмова про подорожі"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`words-${lesson.id}`}>Нових слів</Label>
          <Input
            id={`words-${lesson.id}`}
            type="number"
            min={0}
            className="h-10 rounded-input bg-card"
            value={newWords}
            onChange={(e) => setNewWords(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <span className="text-label-md block text-muted-foreground">
            Розмовна практика
          </span>
          <button
            type="button"
            aria-pressed={speaking}
            onClick={() => setSpeaking((v) => !v)}
            className={
              speaking
                ? "text-label-md h-10 w-full rounded-input border-2 border-sage-green bg-sage-green/10 text-sage-green"
                : "text-label-md h-10 w-full rounded-input border-2 border-border bg-card text-muted-foreground"
            }
          >
            {speaking ? "Була" : "Не було"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`note-${lesson.id}`}>Нотатка для учня й батьків</Label>
        <Textarea
          id={`note-${lesson.id}`}
          rows={3}
          placeholder="Що вдалося, над чим попрацювати"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <button
          type="button"
          aria-pressed={withHomework}
          onClick={() => setWithHomework((v) => !v)}
          className="text-label-md text-secondary underline-offset-4 hover:underline"
        >
          {withHomework ? "— Без домашнього завдання" : "+ Задати домашнє завдання"}
        </button>

        {withHomework && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`hw-${lesson.id}`}>Завдання</Label>
              <Textarea
                id={`hw-${lesson.id}`}
                rows={2}
                placeholder="Що зробити до наступного уроку"
                value={homeworkText}
                onChange={(e) => setHomeworkText(e.target.value)}
              />
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor={`deadline-${lesson.id}`}>Дедлайн</Label>
              <input
                id={`deadline-${lesson.id}`}
                type="date"
                className="text-body-md h-10 w-full rounded-input border border-input bg-card px-3"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          className="rounded-full"
          onClick={submit}
          disabled={saving}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {existing ? "Оновити звіт" : "Зберегти звіт"}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="rounded-full"
          onClick={onDone}
          disabled={saving}
        >
          Скасувати
        </Button>
      </div>
    </div>
  );
}

/** Типовий дедлайн — за тиждень: рівно до наступного заняття. */
function defaultDeadline(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}
