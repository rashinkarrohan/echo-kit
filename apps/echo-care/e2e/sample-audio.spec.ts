/**
 * S23: the doctor and pharmacy samples play the actor's voice (checked for speech in
 * ui/e2e/tests/sample-audio.spec.ts). The misheard-names sample is text only, so it
 * offers no audio buttons rather than silent ones.
 */
import { test, expect } from "@playwright/test";

test("the doctor sample offers Hear it from the actor recording", async ({ page }) => {
  await page.goto("/?sample=care-01&demo=1&speed=40#/doctor-card");
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByText(/any other questions/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Stop and review" }).click();
  await page.getByRole("button", { name: "See the receipt" }).click();
  const medicine = page.locator(".echo-receipt-line").first();
  await medicine.getByRole("button", { name: /^Hear it/ }).click();
  await expect(page.locator(".care-playing")).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
  await expect(page.getByText("Audio not kept")).toHaveCount(0);
});

test("the misheard-names sample has no recording, so it offers no Hear it buttons", async ({
  page,
}) => {
  await page.goto("/?sample=misheard&demo=1&speed=40#/doctor-card");
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByText(/see me in one week/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Stop and review" }).click();
  await page.getByRole("button", { name: "See the receipt" }).click();
  await expect(page.locator(".echo-receipt-line").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Hear it/ })).toHaveCount(0);
  await expect(page.getByText("Audio not kept").first()).toBeVisible();
});
