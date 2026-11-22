/**
 * The doctor-stage flow with a scripted consult (care-01, actors) fed through the mock speech
 * adapter, in the Echo Care design: home, card for the doctor, microphone and consent, live
 * captions, Please repeat, summary with working anchors, read back, questions and safety, delete.
 * Also: axe on every screen, no advice wording, and the 1280 px layout.
 */
import { test, expect } from "@playwright/test";
import { ADVICE, SAMPLE, axe, finishVisit, playing } from "./helpers";

test("doctor visit: home, card, microphone, captions, repeat, summary with working anchors", async ({
  page,
}) => {
  await page.goto(SAMPLE);
  // Home: one clear promise, one primary action, a practice visit and privacy.
  await expect(
    page.getByRole("heading", { name: "Read what your doctor says, as they say it." }),
  ).toBeVisible();
  await expect(
    page.getByText(/Sound and words stay on this device unless you choose/),
  ).toBeVisible();
  const startVisit = page.getByRole("link", { name: "Start a visit" });
  await expect(startVisit).toBeVisible();
  await expect(startVisit).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("link", { name: "Try a practice visit" })).toBeVisible();
  await axe(page, "home");
  await startVisit.click();

  // Step 1: the card for the doctor.
  const cardHeading = page.getByRole("heading", { name: "I am deaf or hard of hearing." });
  await expect(cardHeading).toBeVisible();
  await expect(cardHeading).toBeFocused();
  await expect(page).toHaveTitle("Show the doctor | Echo Care");
  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await axe(page, "doctor card");
  await page.getByRole("button", { name: "They said yes. Start" }).click();

  // Step 2: the microphone. Nothing is on by default; Allow needs both consents.
  const micHeading = page.getByRole("heading", { name: "Echo Care needs your microphone" });
  await expect(micHeading).toBeVisible();
  await expect(micHeading).toBeFocused();
  await expect(page).toHaveTitle("Your microphone | Echo Care");
  await expect(page.getByText("Step 2 of 2")).toBeVisible();
  const allow = page.getByRole("button", { name: "Allow microphone" });
  await expect(allow).toBeDisabled();
  await axe(page, "microphone");
  await page.getByRole("checkbox", { name: /^Record this conversation/ }).check();
  await expect(allow).toBeDisabled();
  await page.getByRole("checkbox", { name: /^Turn speech into text/ }).check();
  await allow.click();

  // Captions: flagged words are marked and the uncertainty line is shown.
  await expect(page.getByText(/call the clinic straight away/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Captions can be wrong/)).toBeVisible();
  await expect(page.locator("mark.echo-flag", { hasText: "metformin" })).toBeVisible();
  // While the microphone could be live, no link leads away from the recording.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await axe(page, "captions");

  // Please repeat: a big card for the doctor, then back to the captions.
  await page.getByRole("link", { name: /Please repeat/ }).click();
  await expect(page.getByRole("heading", { name: "What did you miss?" })).toBeVisible();
  await expect(page.getByText("Please say all of that again.")).toBeVisible();
  await page.getByRole("button", { name: "Amount" }).click();
  await expect(page.getByText("Please say the amount again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Amount" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await axe(page, "please repeat");
  await page.getByRole("link", { name: "I got it. Back to captions" }).click();
  await expect(page.getByText(/call the clinic straight away/)).toBeVisible();

  await finishVisit(page, /any other questions/);

  // Summary: counts, one medicine card, the next visit, a working Hear it on every anchor.
  await expect(page.getByRole("heading", { name: "Your visit summary" })).toBeVisible();
  await expect(page).toHaveTitle("Visit summary | Echo Care");
  await expect(page.getByLabel("At a glance")).toContainText("Heard clearly");
  await expect(page.getByLabel("At a glance")).toContainText("Not said");
  const facts = page.locator(".echo-receipt-line");
  await expect(facts).toHaveCount(1);
  await expect(facts.first()).toContainText("Metformin");
  await expect(facts.first()).toContainText("Heard clearly");
  await expect(facts.first()).toContainText("500 milligrams");
  await expect(page.getByRole("heading", { name: "Next visit" })).toBeVisible();
  await expect(page.getByText("Exact date: not said")).toBeVisible();
  await axe(page, "summary");
  const hear = page.locator(".cd-hear");
  const n = await hear.count();
  expect(n).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < n; i++) {
    await hear
      .nth(i)
      .getByRole("button", { name: /^Hear it/ })
      .click();
    await expect(playing(page)).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
    expect(await playing(page).getAttribute("data-playing")).not.toBe("");
    await hear
      .nth(i)
      .getByRole("button", { name: /^Slower/ })
      .click();
    await expect(playing(page)).toHaveText(/^Playing /);
  }
  // The medicine chip plays exactly the medicine's segments.
  await hear
    .first()
    .getByRole("button", { name: /^Hear it/ })
    .click();
  await expect(playing(page)).toHaveAttribute("data-playing", "seg-0002,seg-0003");

  // Read back: items are only confirmed by a tap.
  await page.getByRole("link", { name: "Show the doctor this" }).click();
  const readBack = page.getByRole("heading", { name: "Read back what you heard" });
  await expect(readBack).toBeFocused();
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
  await page.getByRole("link", { name: "See the summary" }).click();
  await expect(page.getByRole("heading", { name: "Your visit summary" })).toBeVisible();

  // Questions and safety: what was said about when to call, and the planned questions.
  await page.getByRole("link", { name: /Questions & safety/ }).click();
  await expect(page.getByRole("heading", { name: "Questions and safety" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "When to call the clinic" })).toBeVisible();
  await expect(page.getByText(/call the clinic straight away/)).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "What side effects should I expect?" }),
  ).toContainText("Not discussed");
  await expect(page.getByRole("button", { name: "Ask about side effects" })).toBeVisible();
  await axe(page, "questions and safety");
  // No advice anywhere; the disclaimer is present.
  const text = (await page.locator("main").textContent()) ?? "";
  expect(text).not.toMatch(ADVICE);
  expect(text).toContain("It is not medical advice and not an interpreter.");

  // Delete asks first, then removes the transcript and receipt and returns home.
  await page.getByRole("button", { name: "Delete this visit" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this visit?" });
  await expect(confirm).toContainText("This cannot be undone");
  await confirm.getByRole("button", { name: "No, keep it" }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Delete this visit" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.getByText("Visit deleted from this phone.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Read what your doctor says, as they say it." }),
  ).toBeVisible();
});

test("the microphone step cannot start a visit without both consents", async ({ page }) => {
  await page.goto(`${SAMPLE}#/doctor-card`);
  await page.getByRole("button", { name: "They said yes. Start" }).click();
  await expect(page.getByRole("button", { name: "Allow microphone" })).toBeDisabled();
  await page.getByRole("link", { name: "Not now" }).click();
  await expect(
    page.getByRole("heading", { name: "Read what your doctor says, as they say it." }),
  ).toBeVisible();
});

test("the captions page without a recording says so and leads home", async ({ page }) => {
  await page.goto(`${SAMPLE}#/record`);
  await expect(page.getByText(/There is no recording right now/)).toBeVisible();
  await expect(page.locator("mark")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page.getByRole("heading", { name: /Read what your doctor says/ })).toBeVisible();
});

test("a summary page without a visit says so, with a way to start one", async ({ page }) => {
  await page.goto("/?sample=care-01&demo=1#/receipt");
  await expect(page.getByRole("heading", { name: "No visit to show yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a visit" })).toBeVisible();
  await axe(page, "empty summary");
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

test.describe("desktop layout (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  const noSideScroll = async (page: import("@playwright/test").Page, screen: string) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${screen}: horizontal overflow`).toBeLessThanOrEqual(1);
  };

  test("the same flow on a wide screen: header navigation, captions beside controls, two-column summary", async ({
    page,
  }) => {
    await page.goto("/?sample=care-01&demo=1&speed=40");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Visits" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Medicines" })).toBeVisible();
    await expect(page.getByLabel("Live caption example")).toBeVisible();
    await axe(page, "desktop home");
    await noSideScroll(page, "home");

    await page.getByRole("link", { name: "Start a visit" }).click();
    await expect(page.getByText(/May I use my screen to write down what you say/)).toBeVisible();
    await expect(
      page.getByText("Show this to the doctor, then ask if you can start."),
    ).toBeVisible();
    await axe(page, "desktop doctor card");
    await noSideScroll(page, "doctor card");
    await page.getByRole("button", { name: "They said yes. Start" }).click();

    await expect(page.getByText(/call the clinic straight away/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Controls")).toBeVisible();
    await axe(page, "desktop captions");
    await noSideScroll(page, "captions");
    await page.getByRole("link", { name: /Please repeat/ }).click();
    await axe(page, "desktop please repeat");
    await noSideScroll(page, "please repeat");
    await page.getByRole("link", { name: "I got it. Back to captions" }).click();
    await finishVisit(page, /any other questions/);

    await expect(page.getByRole("heading", { name: "What was said" })).toBeVisible();
    await expect(page.getByLabel("At a glance")).toBeVisible();
    await axe(page, "desktop summary");
    await noSideScroll(page, "summary");
    await page.getByRole("link", { name: /Questions & safety/ }).click();
    await axe(page, "desktop questions");

    await nav.getByRole("link", { name: "Medicines" }).click();
    await expect(
      page.getByText("Nothing here yet. Add your first medicine on the left."),
    ).toBeVisible();
    await expect(page.getByText("Saved on this device only")).toBeVisible();
    await axe(page, "desktop medicines");
    await noSideScroll(page, "medicines");
  });
});
