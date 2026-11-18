/**
 * S22 Verify: two scripted sales (actors, fictional prices) that differ in financing
 * show both values with anchors, a missing field shows Not discussed, and no ranking
 * or recommendation appears. Also: question card with sources, gap check, confirm message.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function axe(page: Page, screen: string): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${screen}: ${v.id} ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

const RANKING =
  /\b(best|cheapest|cheaper|better|worse|winner|recommend\w*|top pick|good deal|great deal|rank\w*|should buy|choose this)\b/i;

async function recordSeller(page: Page, name: string, lastWords: RegExp): Promise<void> {
  await page.getByLabel("Seller or clinic name").fill(name);
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByText(lastWords)).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Money, percentages, time periods and commission wording/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop and review" }).click();
  await expect(page.getByRole("heading", { name: `${name}: questions` })).toBeVisible();
}

test("two sellers: financing differs with both anchors, a missing field is Not discussed, no ranking", async ({
  page,
}) => {
  await page.goto("/?sample=sales&speed=40");
  const homeHeading = page.getByRole("heading", {
    name: "Compare what sellers said, side by side.",
  });
  await expect(homeHeading).toBeVisible();
  await expect(homeHeading).toBeFocused();
  await expect(page).toHaveTitle("Echo Cover — compare what sellers said");
  await expect(page.getByText(/never ranks sellers or recommends a purchase/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private by default" })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await expect(homeHeading).toHaveCSS("outline-style", "none");
  await expect(page.getByLabel("Example seller ledger")).toContainText("Seller 1");
  await expect(page.getByLabel("Example seller ledger")).toContainText("Seller 2");
  await axe(page, "home");
  await page.getByRole("link", { name: "Start comparing" }).click();

  await expect(page.getByText(/Everyone in the conversation must agree/)).toBeVisible();
  await expect(page.getByText("Step 1 of 3 · Your choices")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before we start" })).toBeFocused();
  await expect(
    page.getByRole("switch", { name: "Share a summary (off unless I choose)" }),
  ).toHaveCount(0);
  await expect(page.getByText(/does not recommend a purchase/)).toBeVisible();
  await axe(page, "consent");
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();

  // Question card: every question has a source link; ticks carry into the review.
  await expect(
    page.getByRole("heading", { name: "Questions to ask before you buy" }),
  ).toBeFocused();
  await expect(page.getByText("Step 2 of 3 · Plan questions")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Source/ })).toHaveCount(5);
  await page.getByRole("checkbox", { name: "Do staff earn commission on this sale?" }).click();
  await axe(page, "questions");
  await page.getByRole("button", { name: "Start recording a seller" }).click();

  // The seller name is required.
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Type a seller or clinic name first.");
  await axe(page, "record (name needed)");

  await recordSeller(page, "Seller A", /If you prefer to pay monthly/);
  await expect(page.getByText("1 of at least 2 sellers recorded")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Comparison progress" })
      .getByText("Record one more seller to compare them side by side."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare sellers" })).toBeDisabled();
  // Gap check for Seller A: commission was never mentioned (planted gap), and it was planned.
  const commission = page
    .getByRole("listitem")
    .filter({ hasText: "Do staff earn commission on this sale?" });
  await expect(commission).toContainText("Not discussed");
  await expect(commission).toContainText("I plan to ask this");
  await axe(page, "review A");

  await page.getByRole("button", { name: "Record another seller" }).click();
  await recordSeller(page, "Seller B", /I am paid a salary/);
  await page.getByRole("button", { name: "Compare sellers" }).click();

  // Comparison ledger.
  await expect(page.getByRole("heading", { name: "Compare sellers" })).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText(["Seller A", "Seller B"]);
  const financing = page
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: /Financing/ }) });
  await expect(financing).toContainText("Differs");
  await expect(financing).toContainText("12 percent, 3 years");
  await expect(financing).toContainText("9.9 percent, 2 years");
  await expect(financing.getByRole("button", { name: /^Hear it/ })).toHaveCount(2);

  const included = page
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: /What is included/ }) });
  await expect(included.getByText("Not discussed")).toHaveCount(1);

  await financing
    .getByRole("button", { name: /^Hear it/ })
    .nth(1)
    .click();
  await expect(page.locator(".cover-playing")).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
  await axe(page, "compare");

  const text = (await page.locator("main").textContent()) ?? "";
  const DISCLAIMER =
    "Echo compares what sellers said. It is not legal or financial advice and it does not recommend a purchase.";
  expect(text).toContain(DISCLAIMER);
  // Everything except the required disclaimer (which says it does NOT recommend) is free of ranking words.
  expect(text.split(DISCLAIMER).join(" ")).not.toMatch(RANKING);
});

test("confirm-in-writing message lists what was said and what was not discussed, and is never sent", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?sample=sales&speed=40#/consent");
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await page.getByRole("button", { name: "Start recording a seller" }).click();
  await recordSeller(page, "Seller A", /If you prefer to pay monthly/);
  await page.getByRole("button", { name: "Draft a message to confirm in writing" }).click();

  const message = page.locator(".cover-message");
  await expect(message).toContainText("Hello, thank you for your time.");
  await expect(message).toContainText("Price: 3800 dollars, pair.");
  await expect(message).toContainText(
    "I would also like to know: Do staff earn commission on this sale?",
  );
  await expect(message).toContainText("Please reply in writing to confirm.");
  await expect(page.getByRole("button", { name: "Back to Seller A review" })).toBeVisible();
  await axe(page, "confirm");

  await page.getByRole("button", { name: "Copy message" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied." })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("Please reply in writing to confirm.");
  expect(clip).not.toMatch(RANKING);
});

test("seller names stay distinct and an active recording can be deliberately discarded", async ({
  page,
}) => {
  await page.goto("/?sample=sales&speed=40#/consent");
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await page.getByRole("button", { name: "Start recording a seller" }).click();
  await recordSeller(page, "Seller A", /If you prefer to pay monthly/);
  await page.getByRole("button", { name: "Record another seller" }).click();

  await page.getByLabel("Seller or clinic name").fill("seller a");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Use a different name so the sellers are easy to tell apart.",
  );

  await page.getByLabel("Seller or clinic name").fill("Seller B");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByText(/Recording the conversation with Seller B/)).toBeVisible();
  await page.getByRole("button", { name: "Discard recording" }).click();
  const confirm = page.getByRole("group", { name: "Discard this recording?" });
  await expect(confirm).toContainText("This cannot be undone");
  await confirm.getByRole("button", { name: "Discard permanently" }).click();
  await expect(page.getByLabel("Seller or clinic name")).toBeVisible();
  await expect(page.getByText("1 of at least 2 sellers recorded")).toHaveCount(0);
});

test("Cover home reflows at phone width and 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(page.getByRole("link", { name: "Start comparing" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
