/**
 * Misheard medicine names (care-11, actors): "paramet" is not a name Echo knows and
 * "meriforming" sounds like metformin. Both stay as heard, say why in plain words, and
 * are stamped Check this on the summary. Nothing is corrected.
 */
import { test, expect } from "@playwright/test";
import { axe, startVisit } from "./helpers";

test("misheard medicine names are kept as heard, explained, and stamped Check this", async ({
  page,
}) => {
  await startVisit(page, "/?sample=misheard&speed=40#/doctor-card");
  // Captions: the heard words stay; a short hint says why to check them.
  await expect(page.getByText(/see me in one week/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("mark.echo-flag", { hasText: "paramet" })).toBeVisible();
  await expect(
    page.locator(".echo-name-hint", { hasText: "Not a medicine name Echo knows" }),
  ).toBeVisible();
  await expect(
    page.locator(".echo-name-hint", { hasText: "Sounds like metformin?" }),
  ).toBeVisible();
  // The live card explains the latest unsure name and how to ask again.
  const card = page.locator(".cd-prompt");
  await expect(card).toContainText("Check this");
  await expect(card).toContainText("Echo heard “meriforming”. It sounds like metformin");
  await expect(card).toContainText("Please repeat");
  await axe(page, "captions");
  // The Please repeat card starts on the tile that matches: the medicine name.
  await page.getByRole("link", { name: /Please repeat/ }).click();
  await expect(page.getByRole("button", { name: "Medicine name" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Please say the medicine name again.")).toBeVisible();
  await page.getByRole("link", { name: "I got it. Back to captions" }).click();
  await page.getByRole("button", { name: "Finish visit" }).click();

  // Summary: both names as heard, stamped Check this, with a plain-words reason.
  const cards = page.locator(".echo-receipt-line", { hasText: "Medicine" });
  await expect(cards).toHaveCount(2);
  const paramet = cards.filter({ hasText: "Paramet" });
  await expect(paramet).toContainText("Check this");
  await expect(paramet.locator(".cd-note-box")).toHaveText(
    "Echo heard “paramet”. This is not a medicine name Echo knows. Check the name on the label or with your pharmacist.",
  );
  const meri = cards.filter({ hasText: "Meriforming" });
  await expect(meri).toContainText("Check this");
  await expect(meri.locator(".cd-note-box")).toContainText("It sounds like metformin.");
  // Never corrected: the summary does not claim the medicine is metformin.
  await expect(meri.getByRole("heading")).toHaveText("Meriforming");
  await expect(page.getByLabel("At a glance")).toContainText("Check this");
  await axe(page, "summary");
});
