/** Shared steps for the Echo Cover end-to-end tests (design pack flow). */
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** No serious or critical accessibility problem on the current screen. */
export async function axe(page: Page, screen: string): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${screen}: ${v.id} ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

export const RANKING =
  /\b(best|cheapest|cheaper|better|worse|winner|recommend\w*|top pick|good deal|great deal|rank\w*|should buy|choose this)\b/i;

export const DISCLAIMER =
  "Echo compares what sellers said. It is not legal or financial advice and it does not recommend a purchase.";

/** Words the design itself uses to say Echo does not rank; they are allowed on screen. */
export const NEUTRAL_LINES = [
  DISCLAIMER,
  "What each seller said, side by side. Echo does not rank sellers.",
  "It never ranks sellers or tells you what to buy.",
];

export const withoutNeutralLines = (text: string): string =>
  NEUTRAL_LINES.reduce((rest, line) => rest.split(line).join(" "), text);

/** Both consent switches, then "I agree and continue" (the first step of the flow). */
export async function consent(page: Page): Promise<void> {
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
}

/** From the questions page: name the seller, record the scripted conversation, review it. */
export async function recordSeller(page: Page, name: string, lastWords: RegExp): Promise<void> {
  await page.getByLabel("Seller or clinic name").fill(name);
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByText(lastWords)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Yellow words are money, percentages, time periods/)).toBeVisible();
  await page.getByRole("button", { name: "Stop and review" }).click();
  await expect(page.getByRole("heading", { name: `${name}: what was said` })).toBeVisible();
}

/** The "Playing 0:12 to 0:16" status line. */
export const playing = (page: Page): Locator => page.locator(".cv-playing");
