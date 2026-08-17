import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * 404 для всього застосунку. Сторінки публічної частини (каталог, профілі)
 * відкривають гості й пошуковики — стандартна англомовна заглушка Next
 * тут виглядала б як поламаний сайт.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-secondary/10 text-secondary">
        <Compass className="size-8" strokeWidth={1.75} aria-hidden />
      </span>

      <div className="space-y-3">
        <h1 className="text-headline-lg text-secondary">Сторінку не знайдено</h1>
        <p className="text-body-md mx-auto max-w-md text-muted-foreground">
          Можливо, посилання застаріло або репетитор зняв профіль з публікації.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/catalog" size="lg" className="rounded-full">
          До каталогу
        </ButtonLink>
        <ButtonLink href="/" size="lg" variant="outline" className="rounded-full">
          На головну
        </ButtonLink>
      </div>
    </main>
  );
}
