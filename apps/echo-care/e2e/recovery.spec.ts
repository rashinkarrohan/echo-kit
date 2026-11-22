/**
 * The captions screen never dead-ends. A refused or missing microphone offers Try again and a
 * way home; a recording can be discarded deliberately; links that would leave a live recording
 * are hidden.
 */
import { test, expect } from "@playwright/test";
import { allowMicrophone, startVisit } from "./helpers";
import AxeBuilder from "@axe-core/playwright";

test("no microphone: the error offers Try again and a way home, never a dead end", async ({
  page,
}) => {
  // No sample: a live recording, and the test browser has no microphone to give.
  await page.goto("/#/doctor-card");
  await page.getByRole("button", { name: "They said yes. Start" }).click();
  await allowMicrophone(page);
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish visit" })).toHaveCount(0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(
    page.getByRole("heading", { name: "Read what your doctor says, as they say it." }),
  ).toBeVisible();
});

test("a recording can be discarded deliberately, and nothing is kept", async ({ page }) => {
  await startVisit(page, "/?sample=care-01&speed=2#/doctor-card");
  await expect(page.getByText(/blood sugar/)).toBeVisible({ timeout: 20_000 });
  // While the microphone could be live, no link leads away from the recording.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Echo Care home" })).toHaveCount(0);
  await page.getByRole("button", { name: "Discard recording" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Discard this recording?" });
  await expect(confirm).toContainText("This cannot be undone");
  await confirm.getByRole("button", { name: "No, keep going" }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Discard recording" }).click();
  await page
    .getByRole("alertdialog", { name: "Discard this recording?" })
    .getByRole("button", { name: "Yes, discard it" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Read what your doctor says, as they say it." }),
  ).toBeVisible();
  await expect(page.getByText(/Last visit/)).toHaveCount(0);
});
