import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@raycast/api": fileURLToPath(new URL("./test/raycast-api.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/token-detector.ts", "src/clipboard.ts", "src/token-clipboard.tsx"],
      reporter: ["text", "html", "json-summary"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 100,
        lines: 90,
      },
    },
  },
});
