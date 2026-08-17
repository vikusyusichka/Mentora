import Link from "next/link";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Посилання, що виглядає як кнопка.
 *
 * Чому не `<Button render={<Link/>}>`: Base UI вважає `Button` нативною
 * кнопкою і в консолі вимагає або справжній `<button>`, або
 * `nativeButton={false}`. Другий варіант гірший — тоді бібліотека вішає
 * на посилання `role="button"`, і читач екрана перестає називати його
 * посиланням. Перехід — це посилання, тож лишаємо `<a>` і беремо від
 * кнопки лише вигляд.
 *
 * `render` лишається доречним там, де компонується справжня інтерактивна
 * поведінка (тригери діалогів, меню), а не звичайний перехід.
 */
export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="button-link"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
