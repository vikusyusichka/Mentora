import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * firebase-admin не бандлимо, а лишаємо звичайним runtime-залежністю.
   *
   * Його залежність jwks-rsa підключає ESM-пакет jose через require().
   * Коли Next пакує це у свій серверний бандл, ланцюжок ламається з
   * ERR_REQUIRE_ESM. Як зовнішній модуль пакет резолвиться штатно.
   */
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
