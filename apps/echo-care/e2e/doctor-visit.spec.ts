/**
 * S19 Verify: the doctor-stage flow completes with a scripted consult (care-01, actors)
 * fed through the MockAdapter, and every fact on the receipt has a working anchor chip.
 * Also: axe on every screen, no advice wording, delete removes the visit.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SAMPLE = "/?sample=care-01&speed=40";

async function axe(page: Page, screen: string): Promise<void> {
  // The receipt prints line by line; check contrast on the finished lines, not mid-fade.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${screen}: ${v.id} ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

const ADVICE =
  /\byou should\b|\bwe recommend\b|\bincrease (the|your) dose\b|\bdecrease (the|your) dose\b|\bstop taking\b|\bdiagnos/i;

test("doctor visit: home, consent, doctor card, record, read-back, receipt with working anchors", async ({
  page,
}) => {
  await page.goto(SAMPLE);

  // Home: one clear promise, one primary action, a no-microphone sample and privacy.
  await expect(
    page.getByRole("heading", { name: "Turn what was said into a receipt you can check." }),
  ).toBeVisible();
  await expect(
    page.getByText("Audio and text stay on your phone unless you choose to share."),
  ).toBeVisible();
  const startVisit = page.getByRole("link", { name: "Start a visit" });
  await expect(startVisit).toBeVisible();
  await expect(startVisit).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("link", { name: "Play sample consult" })).toBeVisible();
  await expect(page.getByLabel("Example receipt")).toContainText("Heard clearly");
  await expect(page.getByLabel("Example receipt")).toContainText("Check this");
  await expect(page.getByLabel("Example receipt")).toContainText("Not said");
  await axe(page, "home");
  await page.getByRole("link", { name: "Start a visit" }).click();

  // Consent: nothing on by default; agree needs record + speech-to-text.
  const consentHeading = page.getByRole("heading", { name: "Before we start" });
  await expect(consentHeading).toBeVisible();
  await expect(consentHeading).toBeFocused();
  await expect(page).toHaveTitle("Before we start | Echo Care");
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  const agree = page.getByRole("button", { name: "I agree and continue" });
  await expect(agree).toBeDisabled();
  await axe(page, "consent");
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await expect(agree).toBeDisabled();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await agree.click();

  // Doctor card.
  await expect(page.getByRole("dialog", { name: /I have hearing loss/ })).toBeVisible();
  await expect(page).toHaveTitle("Show the doctor | Echo Care");
  await expect(page.getByText("Step 2 of 2 · Show this screen to the doctor")).toBeVisible();
  await axe(page, "doctor card");
  await page.getByRole("button", { name: "They agreed, start" }).click();

  // Record: captions arrive, flagged words are marked, the uncertainty line is shown.
  await expect(page.getByText(/call the clinic straight away/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Captions can be wrong/)).toBeVisible();
  await expect(page.locator("mark.echo-flag", { hasText: "metformin" })).toBeVisible();
  await axe(page, "record");

  // Please repeat card opens full screen and closes.
  await page.getByRole("button", { name: "Please repeat" }).click();
  const card = page.getByRole("dialog", {
    name: "Please say the medicine name and the dose again, slowly.",
  });
  await expect(card).toBeVisible();
  await axe(page, "please repeat");
  await card.getByRole("button", { name: "Done" }).click();
  await expect(card).toBeHidden();

  await page.getByRole("button", { name: "Stop and review" }).click();

  // Read-back: items are only confirmed by a tap.
  await expect(
    page.getByText("I heard: metformin, 500 milligrams, twice daily, 3 months."),
  ).toBeVisible();
  await axe(page, "read-back");
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await expect(page.getByRole("button", { name: "Right", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Show the doctor" }).click();
  await expect(page.getByText("Marked right")).toBeVisible();
  await axe(page, "read-back speaker view");
  await page.getByRole("button", { name: "See the receipt" }).click();

  // Receipt: stamps, quotes, checklist, and a working chip on every fact.
  await expect(page.getByRole("heading", { name: /^Visit, / })).toBeVisible();
  const facts = page.locator(".echo-receipt-line");
  await expect(facts).toHaveCount(3);
  await expect(
    page.getByRole("listitem").filter({ hasText: "What side effects should I expect?" }),
  ).toContainText("Not discussed");
  await axe(page, "receipt");

  const playing = page.locator(".care-playing");
  const n = await facts.count();
  for (let i = 0; i < n; i++) {
    const fact = facts.nth(i);
    await fact.getByRole("button", { name: /^Hear it/ }).click();
    await expect(playing).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
    expect(await playing.getAttribute("data-playing")).not.toBe("");
    await fact.getByRole("button", { name: /^Slower/ }).click();
    await expect(playing).toHaveText(/^Playing /);
  }

  // The medicine chip plays exactly the medicine's segments.
  await facts
    .first()
    .getByRole("button", { name: /^Hear it/ })
    .click();
  await expect(playing).toHaveAttribute("data-playing", "seg-0002,seg-0003");

  // No advice anywhere on the receipt; the disclaimer is present.
  const text = (await page.locator("main").textContent()) ?? "";
  expect(text).not.toMatch(ADVICE);
  expect(text).toContain("It is not medical advice and not an interpreter.");

  // Delete asks before removing the transcript and receipt.
  await page.getByRole("button", { name: "Delete this visit" }).click();
  await expect(page.getByRole("group", { name: "Delete this visit?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("This visit was deleted from this phone.")).toBeVisible();
});

test("consent is required: the record screen cannot start a visit without it", async ({ page }) => {
  await page.goto(`${SAMPLE}#/record`);
  await expect(page.getByText(/There is no receipt yet/)).toBeVisible();
  await expect(page.locator("mark")).toHaveCount(0);
});

test("home reflows at phone width and 200% zoom without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(page.getByRole("link", { name: "Start a visit" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
