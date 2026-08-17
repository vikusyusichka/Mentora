import { ButtonLink } from "@/components/ui/button-link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Mentora
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          Маркетплейс репетиторів: обери викладача, бронюй уроки й відстежуй
          прогрес — для учнів, репетиторів і батьків.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/catalog" size="lg">
          Знайти репетитора
        </ButtonLink>
        <ButtonLink href="/login" size="lg" variant="outline">
          Увійти
        </ButtonLink>
      </div>
    </main>
  );
}
