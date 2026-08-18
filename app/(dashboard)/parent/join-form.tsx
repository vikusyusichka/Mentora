"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INVITE_LENGTH, normalizeCode } from "@/lib/invite";
import { redeemInviteCode } from "@/lib/firebase/invite-repo";
import { useAuth } from "@/lib/hooks/use-auth";

/**
 * Приєднання батьків за кодом від дитини.
 *
 * Показується, лише поки звʼязку немає: щойно код погашено, підписка на
 * `students` віддає документ, і дашборд наповнюється сам — без
 * перезавантаження.
 */
export function JoinForm() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const normalized = normalizeCode(code);
  const complete = normalized.length === INVITE_LENGTH;

  async function submit() {
    if (!user || !complete) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const result = await redeemInviteCode(token, normalized);
      if (!result.ok) {
        toast.error(result.error ?? "Не вдалося приєднатися.");
        return;
      }
      setCode("");
      toast.success("Готово — тепер ви бачите прогрес дитини.");
    } catch (err) {
      console.error(err);
      toast.error("Не вдалося звʼязатися з сервером.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-5 flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-gold">
          <KeyRound className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="text-body-md text-muted-foreground">
          Попросіть дитину створити код у своєму кабінеті — і введіть його
          тут. Ви отримаєте доступ на читання: прогрес, теми уроків і
          домашні завдання.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-code">Код запрошення</Label>
        <Input
          id="invite-code"
          className="text-title-lg h-12 rounded-input bg-card tracking-[0.12em] uppercase"
          placeholder="XXXX-XXXX"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <p className="text-label-sm text-outline">
          Вісім символів. Регістр і дефіс не мають значення.
        </p>
      </div>

      <Button
        size="lg"
        className="mt-5 rounded-full"
        onClick={submit}
        disabled={saving || !complete}
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        Приєднатися
      </Button>
    </div>
  );
}
