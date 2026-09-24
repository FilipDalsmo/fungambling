import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
const testDatabase = (process.env.E2E_DATABASE_PATH ??= resolve(
  "test-results",
  `browser-${randomUUID()}.sqlite`,
));
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_ORIGIN: "http://localhost:3100",
      DATABASE_PATH: testDatabase,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
