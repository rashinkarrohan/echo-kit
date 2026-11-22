/**
 * Sharing is the user's choice, with its own consent. Until they agree no file can be built; once
 * they do, the exported file has no audio and the "can't be taken back" warning is shown.
 */
import { test, expect } from "@playwright/test";
import { SAMPLE, axe, finishVisit, startVisit } from "./helpers";
import { readFileSync } from "node:fs";

test("until the user agrees to share, no share control builds a file", async ({ page }) => {
  await startVisit(page, `${SAMPLE}#/doctor-card`);
  await finishVisit(page, /any other questions/);
  await page.getByRole("link", { name: /Questions & safety/ }).click();
  await page.getByRole("link", { name: "Share with family" }).click();
  await expect(page.getByRole("heading", { name: "Share a summary" })).toBeVisible();
  const agree = page.getByRole("checkbox", { name: /^Share a summary with family/ });
  await expect(agree).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Share (no audio)" })).toHaveCount(0);
  await axe(page, "share consent");
  // A fresh page with no visit has nothing to share.
  await page.goto("/?sample=care-01#/share");
  await expect(page.getByRole("button", { name: "Share (no audio)" })).toHaveCount(0);
});

test("with sharing agreed, the exported file has no audio and the warning is shown", async ({
  page,
}) => {
  await startVisit(page, `${SAMPLE}#/doctor-card`);
  await finishVisit(page, /any other questions/);
  await page.getByRole("link", { name: /Questions & safety/ }).click();
  await page.getByRole("link", { name: "Share with family" }).click();
  await page.getByRole("checkbox", { name: /^Share a summary with family/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("A file you send can't be taken back.")).toBeVisible();
  await page.getByLabel("Who is it for? (optional)").fill("Priya");
  await axe(page, "share");
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
