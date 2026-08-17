import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Той самий аліас, що і в tsconfig — щоб доменні модулі можна було
  // тестувати їхніми справжніми імпортами, а не відносними шляхами.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Серверні модулі тестуються в Node, а `server-only` навмисно кидає
      // помилку при звичайному імпорті — підміняємо порожнім модулем.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/empty.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
