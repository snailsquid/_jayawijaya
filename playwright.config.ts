import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "tests/e2e/**/*.spec.ts"],
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  webServer: { command: "bun run db:migrate:test && bun run build:test && bun run serve:test", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
})
