/**
 * S29: the recording screen never dead-ends. A refused or missing microphone offers
 * Try again and a way home; starting without consent says so; a recording can be
 * discarded deliberately; links that would leave a live recording are hidden.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function consent(page: Page): Promise<void> {
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
}

test("no microphone: the error offers Try again and a way home, never a dead end", async ({
  page,
}) => {
  // No sample: a live recording, and the test browser has no microphone to give.
  await page.goto("/#/consent");
  await consent(page);
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop and review" })).toHaveCount(0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn what was said into a receipt you can check." }),
  ).toBeVisible();
});

test("starting without consent says why and links to Before we start", async ({ page }) => {
  await page.goto("/#/doctor-card");
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByText("Echo needs your consent before it can record.")).toBeVisible();
  await page.getByRole("link", { name: "Go to Before we start" }).click();
  await expect(page.getByRole("heading", { name: "Before we start" })).toBeVisible();
});

test("a recording can be discarded deliberately, and nothing is kept", async ({ page }) => {
  await page.goto("/?sample=care-01&speed=2#/consent");
  await consent(page);
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByText(/blood sugar/)).toBeVisible({ timeout: 20_000 });
  // While the microphone could be live, no link leads away from the recording.
  await expect(page.getByRole("navigation", { name: "Echo Care links" })).toHaveCount(0);
  await page.getByRole("button", { name: "Discard recording" }).click();
  const confirm = page.getByRole("group", { name: "Discard this recording?" });
  await expect(confirm).toContainText("This cannot be undone");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Discard recording" }).click();
  await page
    .getByRole("group", { name: "Discard this recording?" })
    .getByRole("button", { name: "Discard permanently" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Turn what was said into a receipt you can check." }),
  ).toBeVisible();
  await expect(page.getByText(/saved visit/)).toHaveCount(0);
});
