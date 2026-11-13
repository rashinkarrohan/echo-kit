import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5182", ...devices["Pixel 7"], browserName: "chromium" },
  webServer: {
    command: "vite",
    url: "http://localhost:5182/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
