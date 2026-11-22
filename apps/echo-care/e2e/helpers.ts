/** Shared steps for the Echo Care end-to-end tests (design pack flow). */
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const SAMPLE = "/?sample=care-01&speed=40";

/** No serious or critical accessibility problem on the current screen. */
export async function axe(page: Page, screen: string): Promise<void> {
  // The summary prints line by line; check contrast on the finished lines, not mid-fade.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${screen}: ${v.id} ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

export const ADVICE =
  /\byou should\b|\bwe recommend\b|\bincrease (the|your) dose\b|\bdecrease (the|your) dose\b|\bstop taking\b|\bdiagnos/i;

/** Both consent switches, then Allow microphone (the step after the doctor card). */
export async function allowMicrophone(page: Page): Promise<void> {
  await page.getByRole("checkbox", { name: /^Record this conversation/ }).check();
  await page.getByRole("checkbox", { name: /^Turn speech into text/ }).check();
  await page.getByRole("button", { name: "Allow microphone" }).click();
}

/** From any page: the doctor card, "They said yes", consent, then the scripted consult starts. */
export async function startVisit(page: Page, url = `${SAMPLE}#/doctor-card`): Promise<void> {
  await page.goto(url);
  await page.getByRole("button", { name: "They said yes. Start" }).click();
  await allowMicrophone(page);
}

/** Wait for the last words, then Finish visit. Lands on the summary. */
export async function finishVisit(page: Page, lastWords: RegExp): Promise<void> {
  await expect(page.getByText(lastWords)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Finish visit" }).click();
  await expect(page).toHaveURL(/#\/receipt/);
}

/** The "Playing 0:12 to 0:16" status line on the summary or questions page. */
export const playing = (page: Page): Locator => page.locator(".cd-playing");

/** Summary page to the label check: Questions and safety, then At the pharmacy. */
export async function openLabel(page: Page): Promise<void> {
  await page.getByRole("link", { name: /Questions & safety/ }).click();
  await page.getByRole("link", { name: /At the pharmacy/ }).click();
  await expect(
    page.getByRole("heading", { name: "Check the label against what was said" }),
  ).toBeVisible();
}
