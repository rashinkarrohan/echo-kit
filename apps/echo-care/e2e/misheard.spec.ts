/**
 * Misheard medicine names (care-11, actors): "paramet" is not a name Echo knows and
 * "meriforming" sounds like metformin. Both stay as heard, say why in plain words, and
 * are stamped Check this on the receipt. Nothing is corrected.
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

test("misheard medicine names are kept as heard, explained, and stamped Check this", async ({
  page,
}) => {
  await page.goto("/?sample=misheard&speed=40#/consent");
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await page.getByRole("button", { name: "They agreed, start" }).click();

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
  const card = page.locator(".care-prompt");
  await expect(card).toContainText("Check this");
  await expect(card).toContainText("Echo heard “meriforming”. It sounds like metformin");
  await expect(card).toContainText("Please repeat");
  await axe(page, "record");

  await page.getByRole("button", { name: "Stop and review" }).click();
  await page.getByRole("button", { name: "See the receipt" }).click();

  // Receipt: both names as heard, stamped Check this, with a plain-words reason.
  const lines = page.locator(".echo-receipt-line", { hasText: "Medicine" });
  await expect(lines).toHaveCount(2);
  const paramet = lines.filter({ hasText: "paramet" });
  await expect(paramet.locator(".echo-stamp--check_this")).toBeVisible();
  await expect(paramet.locator(".echo-receipt__note")).toHaveText(
    "Echo heard “paramet”. This is not a medicine name Echo knows. Check the name on the label or with your pharmacist.",
  );
  const meri = lines.filter({ hasText: "meriforming" });
  await expect(meri.locator(".echo-stamp--check_this")).toBeVisible();
  await expect(meri.locator(".echo-receipt__note")).toContainText("It sounds like metformin.");
  // Never corrected: the receipt does not claim the medicine is metformin.
  await expect(meri.locator("dd").first()).toHaveText("meriforming");
  await axe(page, "receipt");
});
