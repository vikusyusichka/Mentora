"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ChipToggleGroup } from "@/components/tutor/chip-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LESSON_STATUS_LABELS,
  type EnrollmentWithId,
  type LessonStatus,
  type LessonWithId,
} from "@/lib/enrollment";
import {
  setLessonStatus,
  subscribeEnrollment,
  subscribeLessons,
  updateEnrollmentCard,
} from "@/lib/firebase/enrollment-repo";
import { browserTimeZone } from "@/lib/timezone";
import { CEFR_LEVELS, LANGUAGES, type CefrLevel, type Language } from "@/lib/tutor-profile";
import { cn } from "@/lib/utils";

/** Уся історія уроків, не лише майбутні. */
const FROM_BEGINNING = "1970-01-01T00:00:00.000Z";

const selectClass =
  "text-body-md h-10 w-full rounded-input border border-input bg-card px-3";

const STATUS_STYLES: Record<LessonStatus, string> = {
  scheduled: "bg-soft-gold text-secondary",
  done: "bg-sage-green/10 text-sage-green",
  cancelled: "bg-badge-neutral text-muted-foreground",
};

function StudentCard({ enrollmentId }: { enrollmentId: string }) {
  const [enrollment, setEnrollment] = useState<EnrollmentWithId | null | "missing">(
    null
  );
  const [lessons, setLessons] = useState<LessonWithId[] | null>(null);

  useEffect(
    () =>
      subscribeEnrollment(
        enrollmentId,
        (found) => setEnrollment(found ?? "missing"),
        (err) => {
          console.error("[tutor] enrollment", err);
          setEnrollment("missing");
        }
      ),
    [enrollmentId]
  );

  useEffect(
    () =>
      subscribeLessons(
        enrollmentId,
        { from: FROM_BEGINNING },
        setLessons,
        (err) => {
          console.error("[tutor] lessons", err);
          setLessons([]);
        }
      ),
    [enrollmentId]
  );

  if (enrollment === null) {
    return (
      <p className="text-label-md flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантажуємо картку…
      </p>
    );
  }

  if (enrollment === "missing") {
    return (
      <div className="rounded-card border border-border bg-card p-10 text-center shadow-level1">
        <h2 className="text-title-lg mb-2">Картку не знайдено</h2>
        <p className="text-body-md text-muted-foreground">
          Можливо, посилання застаріло.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
      <CardForm enrollment={enrollment} />
      <LessonsPanel enrollmentId={enrollmentId} lessons={lessons} />
    </div>
  );
}

function CardForm({ enrollment }: { enrollment: EnrollmentWithId }) {
  // Форма — локальна чернетка поверх живого документа: підписка може
  // оновити його будь-якої миті, і затирати недописане поле не можна.
  const [name, setName] = useState(enrollment.name);
  const [languages, setLanguages] = useState<Language[]>(enrollment.languages);
  const [currentLevel, setCurrentLevel] = useState<CefrLevel | "">(
    enrollment.currentLevel ?? ""
  );
  const [goalLevel, setGoalLevel] = useState<CefrLevel | "">(
    enrollment.goalLevel ?? ""
  );
  const [goalText, setGoalText] = useState(enrollment.goalText);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateEnrollmentCard(enrollment.id, {
        name: name.trim() || enrollment.name,
        languages,
        currentLevel: currentLevel || null,
        goalLevel: goalLevel || null,
        goalText: goalText.trim(),
      });
      toast.success("Картку збережено.");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося зберегти картку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-level1 sm:p-8">
      <h2 className="text-title-lg mb-6">Картка учня</h2>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">{"Ім'я"}</Label>
          <Input
            id="name"
            className="h-10 rounded-input bg-card"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <ChipToggleGroup
          label="Мови"
          options={LANGUAGES}
          selected={languages}
          onToggle={(value: Language) =>
            setLanguages((prev) =>
              prev.includes(value)
                ? prev.filter((v) => v !== value)
                : [...prev, value]
            )
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currentLevel">Поточний рівень</Label>
            <select
              id="currentLevel"
              className={selectClass}
              value={currentLevel}
              onChange={(e) => setCurrentLevel(e.target.value as CefrLevel | "")}
            >
              <option value="">Не вказано</option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalLevel">Цільовий рівень</Label>
            <select
              id="goalLevel"
              className={selectClass}
              value={goalLevel}
              onChange={(e) => setGoalLevel(e.target.value as CefrLevel | "")}
            >
              <option value="">Не вказано</option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goalText">Ціль</Label>
          <Textarea
            id="goalText"
            rows={3}
            placeholder="Наприклад: співбесіда англійською до грудня"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            className="rounded-full"
            onClick={save}
            disabled={saving}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Зберегти картку
          </Button>
          <span className="text-label-sm text-outline">
            Проведено уроків: {enrollment.lessonsCount} · нових слів:{" "}
            {enrollment.totalNewWords}
          </span>
        </div>
      </div>
    </section>
  );
}

function LessonsPanel({
  enrollmentId,
  lessons,
}: {
  enrollmentId: string;
  lessons: LessonWithId[] | null;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function change(lessonId: string, status: LessonStatus) {
    setBusyId(lessonId);
    try {
      await setLessonStatus(enrollmentId, lessonId, status);
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося змінити статус уроку.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className="xl:sticky xl:top-8 xl:self-start">
      <div className="rounded-card border border-border bg-card p-6 shadow-level1">
        <h2 className="text-title-lg mb-5">Уроки</h2>

        {lessons === null ? (
          <p className="text-label-md flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Завантажуємо…
          </p>
        ) : lessons.length === 0 ? (
          <p className="text-body-md text-muted-foreground">
            Уроків ще немає.
          </p>
        ) : (
          <ul className="space-y-3">
            {[...lessons].reverse().map((lesson) => (
              <li
                key={lesson.id}
                className="rounded-input border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-label-md text-secondary">
                    {formatLesson(lesson.slotStart)}
                  </span>
                  <span
                    className={cn(
                      "text-label-sm rounded-full px-3 py-1",
                      STATUS_STYLES[lesson.status]
                    )}
                  >
                    {LESSON_STATUS_LABELS[lesson.status]}
                  </span>
                </div>

                {lesson.status === "scheduled" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => change(lesson.id, "done")}
                      disabled={busyId === lesson.id}
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={2} />
                      Проведено
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-muted-foreground"
                      onClick={() => change(lesson.id, "cancelled")}
                      disabled={busyId === lesson.id}
                    >
                      <XCircle className="size-3.5" strokeWidth={2} />
                      Скасувати
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function formatLesson(slotStart: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: browserTimeZone(),
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(slotStart));
}

export default function TutorStudentCardPage() {
  const params = useParams<{ enrollmentId: string }>();

  return (
    <AuthGate allow={["tutor"]}>
      <DashboardLayout
        title="Учень"
        description="Рівень, ціль і уроки. Зміни бачить учень одразу."
      >
        <Link
          href="/tutor/students"
          className="text-label-md mb-6 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-secondary"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
          До списку учнів
        </Link>

        <StudentCard enrollmentId={params.enrollmentId} />
      </DashboardLayout>
    </AuthGate>
  );
}
