import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 420_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5180", ...devices["Desktop Chrome"] },
  webServer: {
    command: "vite --config e2e/vite.config.ts",
    url: "http://localhost:5180",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
