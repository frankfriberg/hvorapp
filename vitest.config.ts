import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (dir: string) => fileURLToPath(new URL(dir, import.meta.url));

export default defineConfig({
  resolve: {
    // Mirrors the `paths` in tsconfig.json.
    alias: {
      "@shared": path("./shared"),
      "@public": path("./public"),
      "@": path("./src"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "mobile/**", ".next/**"],
  },
});
