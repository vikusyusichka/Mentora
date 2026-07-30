import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

/**
 * DESIGN.md вимагає Plus Jakarta Sans, але той шрифт не має базового
 * кирилічного блоку (U+0400-045F) — з українських літер покриває лише «ґ».
 * Manrope — найближчий геометричний sans зі скругленими терміналами,
 * і має повну українську підтримку. Характер дизайн-системи збережено.
 */
const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mentora — платформа для репетиторства",
  description:
    "Маркетплейс репетиторів: обери викладача, бронюй уроки й відстежуй прогрес.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
