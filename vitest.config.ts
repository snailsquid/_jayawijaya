import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts", "./tests/setup.ts"],
    css: true,
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/hooks/useQuiz.ts", "src/lib/parser.ts", "src/lib/quiz-snapshot.ts", "worker/module-policy.ts"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
      reporter: ["text", "json-summary", "html"],
    },
  },
})
