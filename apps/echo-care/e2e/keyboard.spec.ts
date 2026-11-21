/**
 * S29 (UI-SPEC definition of done): keyboard only completes the main flow, from the
 * home page to hearing a fact on the receipt. Tab moves focus; Enter and Space act.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Press Tab until the focused element's accessible name starts with `name`, then return. */
async function tabTo(page: Page, name: RegExp): Promise<void> {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "";
      const label =
        el.getAttribute("aria-label") ?? (el.closest("label")?.textContent || el.textContent || "");
      return label.trim();
    });
    if (name.test(focused)) return;
  }
  throw new Error(`Could not reach ${String(name)} with Tab`);
}

test("keyboard only: home, consent, doctor card, record, read-back, receipt, Hear it", async ({
  page,
}) => {
  await page.goto("/?sample=care-01&speed=40");
  await tabTo(page, /^Start a visit$/);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Before we start" })).toBeFocused();
  await tabTo(page, /^Record this conversation$/);
  await page.keyboard.press("Space");
  await tabTo(page, /^Turn speech into text on my phone$/);
  await page.keyboard.press("Space");
  await tabTo(page, /^I agree and continue$/);
  await page.keyboard.press("Enter");

  // The doctor card puts focus on its first action.
  await expect(page.getByRole("button", { name: "They agreed, start" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText(/any other questions/)).toBeVisible({ timeout: 20_000 });
  await tabTo(page, /^Stop and review$/);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Read back what you heard" })).toBeFocused();
  await tabTo(page, /^Right$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Right", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await tabTo(page, /^See the receipt$/);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: /^Visit, / })).toBeFocused();
  await tabTo(page, /^Hear it/);
  await page.keyboard.press("Enter");
  await expect(page.locator(".care-playing")).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
});
