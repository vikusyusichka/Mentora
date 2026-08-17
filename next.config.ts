import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * firebase-admin не бандлимо, а лишаємо звичайною runtime-залежністю.
   *
   * Пакет покладається на динамічні require() і опційні нативні модулі —
   * бандлер їх не відстежує. Як зовнішній модуль він резолвиться штатно.
   * Це рекомендований спосіб підключення Admin SDK у Next.js.
   */
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
