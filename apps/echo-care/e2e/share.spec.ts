/**
 * S21 Verify: with sharing off no share control appears; with sharing on the exported
 * file contains no audio, and the "can't be taken back" warning is shown.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

async function visit(page: Page, share: boolean): Promise<void> {
  await page.goto("/?sample=care-01&speed=40#/consent");
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  if (share)
    await page.getByRole("switch", { name: "Share a summary (off unless I choose)" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByText(/any other questions/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Stop and review" }).click();
  await page.getByRole("button", { name: "See the receipt" }).click();
  await expect(page.getByRole("heading", { name: /^Visit, / })).toBeVisible();
}

test("with sharing off, no share control appears anywhere", async ({ page }) => {
  await visit(page, false);
  await expect(page.getByRole("button", { name: /share/i })).toHaveCount(0);
  await page.goto("/?sample=care-01#/share");
  await expect(page.getByRole("button", { name: "Share (no audio)" })).toHaveCount(0);
});

test("with sharing on, the exported file has no audio and the warning is shown", async ({
  page,
}) => {
  await visit(page, true);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText("A file you send can't be taken back.")).toBeVisible();
  await page.getByLabel("Who is it for? (optional)").fill("Priya");
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "best-practice"])
    .analyze();
  expect(
    r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
  ).toEqual([]);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share (no audio)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^echo-care-\d{4}-\d{2}-\d{2}\.html$/);
  const html = readFileSync((await file.path()) ?? "", "utf8");

  expect(html).toContain("For: Priya");
  expect(html).toContain("metformin");
  expect(html).toContain("It is not medical advice and not an interpreter.");
  expect(html).not.toMatch(/<audio|<source|<script|data:audio|\.wav|\.m4a|blob:|base64/i);
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to this phone as a file" }),
  ).toBeVisible();
});
