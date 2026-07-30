import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <Button size="lg" render={<Link href="/catalog" />}>
          Знайти репетитора
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/login" />}>
          Увійти
        </Button>
      </div>
    </main>
  );
}
