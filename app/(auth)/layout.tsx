import type { ReactNode } from "react";

/**
 * Спільна оболонка auth-екранів: теплий кремовий фон (Level 0),
 * центрування та атмосферні декоративні елементи з макетів
 * (розмиті кола + тонка сітчаста текстура).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* Декор — не перехоплює події, під контентом */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-20 -top-20 size-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-secondary/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(#451010 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Ширину задає сама сторінка: login/register — 440px,
          вибір ролі — 1200px під сітку карток. */}
      <div className="flex w-full flex-col items-center">{children}</div>
    </div>
  );
}
