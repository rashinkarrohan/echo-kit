/**
 * Two scripted sales (actors, fictional prices) that differ in financing show both values with
 * anchors, a missing field shows Not said, and no ranking or recommendation appears. Also: the
 * questions card with sources, the gap check, and the confirm-in-writing message. In the Echo
 * Cover design: home, consent, questions, name, live captions, receipt, seller ledger, draft.
 */
import { test, expect } from "@playwright/test";
import {
  DISCLAIMER,
  RANKING,
  axe,
  consent,
  playing,
  recordSeller,
  withoutNeutralLines,
} from "./helpers";

test("two sellers: financing differs with both anchors, a missing field is Not said, no ranking", async ({
  page,
}) => {
  await page.goto("/?sample=sales&speed=40");
  const homeHeading = page.getByRole("heading", {
    name: "Compare what sellers said, side by side.",
  });
  await expect(homeHeading).toBeVisible();
  await expect(homeHeading).toBeFocused();
  await expect(page).toHaveTitle("Echo Cover: compare what sellers said");
  await expect(page.getByText(/It never ranks sellers or tells you what to buy/)).toBeVisible();
  await expect(homeHeading).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("heading", { name: "Private by default" })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await expect(homeHeading).toHaveCSS("outline-style", "none");
  await expect(page.getByLabel("Example seller ledger")).toContainText("Seller 1");
  await expect(page.getByLabel("Example seller ledger")).toContainText("Seller 2");
  await axe(page, "home");
  await page.getByRole("link", { name: "Start comparing" }).click();

  // Step 1: both consents are needed; nothing is on by default.
  await expect(page.getByText(/Everyone in the conversation must agree/)).toBeVisible();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before we start" })).toBeFocused();
  await expect(
    page.getByRole("switch", { name: "Share a summary (off unless I choose)" }),
  ).toHaveCount(0);
  await expect(page.getByText(/does not recommend a purchase/)).toBeVisible();
  const agree = page.getByRole("button", { name: "I agree and continue" });
  await expect(agree).toBeDisabled();
  await expect(page.getByText("Turn on both switches to continue.")).toBeVisible();
  await axe(page, "consent");
  const record = page.getByRole("switch", { name: "Record this conversation" });
  await expect(record).toHaveAttribute("aria-checked", "false");
  await record.click();
  await expect(record).toHaveAttribute("aria-checked", "true");
  await expect(agree).toBeDisabled();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await expect(agree).toBeEnabled();
  await agree.click();

  // Step 2: every question has a source link; the ones chosen carry into the receipt.
  await expect(
    page.getByRole("heading", { name: "Questions to ask before you buy" }),
  ).toBeFocused();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByText("0 of 5 chosen")).toBeVisible();
  await expect(page.getByRole("link", { name: /^See source/ })).toHaveCount(5);
  await page.getByRole("switch", { name: "Do staff earn commission on this sale?" }).click();
  await expect(page.getByText("1 of 5 chosen")).toBeVisible();
  await axe(page, "questions");
  await page.getByRole("button", { name: "Start recording a seller" }).click();

  // Step 3: the seller name is required.
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Type a seller or clinic name first.");
  await axe(page, "name needed");
  await recordSeller(page, "Seller A", /If you prefer to pay monthly/);
  await expect(page.getByText("1 of at least 2 sellers recorded")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Comparison progress" })
      .getByText("Record one more to compare."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare sellers" })).toBeDisabled();
  // Gap check for Seller A: commission was never mentioned (planted gap), and it was planned.
  const commission = page
    .getByRole("listitem")
    .filter({ hasText: "Do staff earn commission on this sale?" });
  await expect(commission).toContainText("Not discussed");
  await expect(commission).toContainText("I plan to ask this");
  await expect(page.getByLabel("Price")).toContainText("Heard clearly");
  await axe(page, "receipt A");
  await page.getByRole("link", { name: "Record another seller" }).click();
  await recordSeller(page, "Seller B", /I am paid a salary/);
  await page.getByRole("link", { name: "Compare sellers" }).click();

  // The seller ledger.
  await expect(page.getByRole("heading", { name: "Seller ledger" })).toBeFocused();
  await expect(page.getByText("2 sellers recorded")).toBeVisible();
  const financing = page.getByRole("region", { name: "Financing" });
  await expect(financing).toContainText("Seller A");
  await expect(financing).toContainText("Seller B");
  await expect(financing).toContainText("The terms differ");
  await expect(financing).toContainText("12 percent, 3 years");
  await expect(financing).toContainText("9.9 percent, 2 years");
  await expect(financing.getByRole("button", { name: /^Hear it/ })).toHaveCount(2);
  const included = page.getByRole("region", { name: "What is included" });
  await expect(included.getByText("Not said")).toHaveCount(1);
  await expect(included).toContainText("Only Seller A said this");
  await financing
    .getByRole("button", { name: /^Hear it/ })
    .nth(1)
    .click();
  await expect(playing(page)).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
  await axe(page, "ledger");
  const text = (await page.locator("main").textContent()) ?? "";
  expect(text).toContain(DISCLAIMER);
  // Everything except the neutral lines (which say Echo does NOT rank or recommend) is free of ranking words.
  expect(withoutNeutralLines(text)).not.toMatch(RANKING);
});

test("confirm-in-writing message lists what was said and what was not discussed, and is never sent", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?sample=sales&speed=40#/consent");
  await consent(page);
  await page.getByRole("button", { name: "Start recording a seller" }).click();
  await recordSeller(page, "Seller A", /If you prefer to pay monthly/);
  await page.getByRole("link", { name: "Draft a message to confirm in writing" }).click();
  await expect(page.getByRole("heading", { name: "Confirm it in writing" })).toBeFocused();
  const message = page.locator(".cv-message");
  await expect(message).toContainText("Hello, thank you for your time.");
  await expect(message).toContainText("Price: 3800 dollars, pair.");
  await expect(message).toContainText(
    "I would also like to know: Do staff earn commission on this sale?",
  );
  await expect(message).toContainText("Please reply in writing to confirm.");
  await expect(page.getByRole("link", { name: "Back to Seller A receipt" })).toBeVisible();
  await expect(page.getByText("Echo does not send anything. Keep the reply.")).toBeVisible();
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
  await consent(page);
  await page.getByRole("button", { name: "Start recording a seller" }).click();
  await recordSeller(page, "Seller A", /If you prefer to pay monthly/);
  await page.getByRole("link", { name: "Record another seller" }).click();
  await page.getByLabel("Seller or clinic name").fill("seller a");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Use a different name so the sellers are easy to tell apart.",
  );
  await page.getByLabel("Seller or clinic name").fill("Seller B");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByText("Recording Seller B")).toBeVisible();
  // While the microphone could be live, no link leads away from the recording.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await page.getByRole("button", { name: "Discard recording" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Discard this recording?" });
  await expect(confirm).toContainText("This cannot be undone");
  await confirm.getByRole("button", { name: "No, keep recording" }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Discard recording" }).click();
  await page
    .getByRole("alertdialog", { name: "Discard this recording?" })
    .getByRole("button", { name: "Yes, discard it" })
    .click();
  await expect(page.getByLabel("Seller or clinic name")).toBeVisible();
  await expect(page.getByText("1 of at least 2 sellers recorded")).toHaveCount(0);
});

test("the ledger and the receipt page without a conversation say so and lead on", async ({
  page,
}) => {
  await page.goto("/?sample=sales&demo=1#/compare");
  await expect(page.getByRole("heading", { name: "Seller ledger" })).toBeVisible();
  await expect(page.getByText("Record at least two sellers to compare them")).toBeVisible();
  await axe(page, "empty ledger");
  await page.goto("/?sample=sales&demo=1#/review/1");
  await expect(page.getByRole("heading", { name: "What a seller said" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start recording a seller" })).toBeVisible();
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

test.describe("desktop layout (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("header navigation, the home ledger beside the hero, and a column per seller", async ({
    page,
  }) => {
    await page.goto("/?sample=sales&demo=1&speed=40");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Compare" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Test results" })).toBeVisible();
    await expect(page.getByLabel("Example seller ledger")).toBeVisible();
    await axe(page, "desktop home");
    await page.goto("/?sample=sales&demo=1&speed=40#/questions");
    await page.getByRole("button", { name: "Start recording a seller" }).click();
    for (const last of [/If you prefer to pay monthly/, /I am paid a salary/]) {
      await page.getByRole("button", { name: "Start recording", exact: true }).click();
      await expect(page.getByText(last)).toBeVisible({ timeout: 20_000 });
      await axe(page, "desktop live captions");
      await page.getByRole("button", { name: "Stop and review" }).click();
      await axe(page, "desktop receipt");
      if (last.source.includes("monthly")) {
        await page.getByRole("link", { name: "Record another seller" }).click();
      }
    }
    await page.getByRole("link", { name: "Compare sellers" }).click();
    await expect(page.getByRole("heading", { name: "Seller ledger" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Draft a message to confirm in writing" }),
    ).toBeVisible();
    await axe(page, "desktop ledger");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
