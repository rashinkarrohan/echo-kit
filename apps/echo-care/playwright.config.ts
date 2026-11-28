import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  // CI runners are slower and replay real-time audio; retry once or twice and keep a trace.
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    trace: "on-first-retry",
    baseURL: "http://localhost:5181",
    ...devices["Pixel 7"],
    browserName: "chromium",
  },
  webServer: [
    {
      command: "vite",
      url: "http://localhost:5181/",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Production build with its service worker, for the offline test.
      command: "vite build && vite preview --port 5183",
      url: "http://localhost:5183/",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
