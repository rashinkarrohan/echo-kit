/**
 * S23 Verify: the sample consult needs no microphone and no model download and works
 * offline after the first load; /trust shows the latest eval numbers.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const results = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../evals/results.json", import.meta.url)), "utf8"),
) as {
  runs: number;
  totals: { kept: number; plantedFacts: number; invented: number; unanchored: number };
};

const PREVIEW = "http://localhost:5183";

test("/trust shows the latest eval numbers", async ({ page }) => {
  await page.goto("/#/trust");
  const panel = page.locator(".echo-trust");
  await expect(page.getByRole("heading", { name: "How Echo did in tests" })).toBeVisible();
  await expect(panel.locator("div").filter({ hasText: "Facts kept" }).locator("dd")).toHaveText(
    `${results.totals.kept} of ${results.totals.plantedFacts}`,
  );
  await expect(panel.locator("div").filter({ hasText: "Facts made up" }).locator("dd")).toHaveText(
    `${results.totals.invented} (target 0)`,
  );
  await expect(
    panel.locator("div").filter({ hasText: "Facts without a quote" }).locator("dd"),
  ).toHaveText(`${results.totals.unanchored} (target 0)`);
  await expect(panel.locator("div").filter({ hasText: "Test runs" }).locator("dd")).toHaveText(
    String(results.runs),
  );
  await expect(page.getByText(/scripted test conversations, not real visits/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
});

test("sample consult works offline after the first load, without a microphone or model", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  await page.goto(`${PREVIEW}/`);
  await expect(
    page.getByRole("heading", { name: "Turn what was said into a receipt you can check." }),
  ).toBeVisible();
  // Wait until the service worker controls the page (first load done).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.getByRole("link", { name: "Play sample consult" }).click();
  await expect(page.getByRole("dialog", { name: /I have hearing loss/ })).toBeVisible();
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByText(/call the clinic straight away/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Stop and review" }).click();
  await page.getByRole("button", { name: "See the receipt" }).click();
  await expect(page.locator(".echo-receipt-line")).toHaveCount(3);
  await context.setOffline(false);

  // No speech model or runtime was fetched, and the microphone was never asked for.
  expect(requests.filter((u) => /huggingface|\.onnx|\.wasm|asr-worker/.test(u))).toEqual([]);
});
