/**
 * S29 (UI-SPEC definition of done): keyboard only completes the main flow, from the
 * home page through two sellers to the comparison ledger. Tab moves focus; Enter and
 * Space act.
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
      const by = el.getAttribute("aria-labelledby");
      const named = by ? document.getElementById(by)?.textContent : null;
      const id = el.getAttribute("id");
      const forLabel = id ? document.querySelector(`label[for="${id}"]`)?.textContent : null;
      const label =
        el.getAttribute("aria-label") ??
        named ??
        forLabel ??
        (el.closest("label")?.textContent || el.textContent || "");
      return label.trim();
    });
    if (name.test(focused)) return;
  }
  throw new Error(`Could not reach ${String(name)} with Tab`);
}

async function recordSeller(page: Page, name: string, lastWords: RegExp): Promise<void> {
  // The app moves focus to the page heading after each route change. Wait for it, as a
  // keyboard user would, so typing does not race that focus move on a busy machine.
  await expect(page.getByRole("heading", { name: "Who are you talking to?" })).toBeFocused();
  await tabTo(page, /^Seller or clinic name$/);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter"); // submits the form
  await expect(page.getByText(lastWords)).toBeVisible({ timeout: 20_000 });
  await tabTo(page, /^Stop and review$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: `${name}: what was said` })).toBeFocused();
}

test("keyboard only: home, consent, questions, two sellers, comparison", async ({ page }) => {
  await page.goto("/?sample=sales&speed=40");
  await tabTo(page, /^Start comparing$/);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Before we start" })).toBeFocused();
  await tabTo(page, /^Record this conversation$/);
  await page.keyboard.press("Space");
  await tabTo(page, /^Turn speech into text on my phone$/);
  await page.keyboard.press("Space");
  await tabTo(page, /^I agree and continue$/);
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Questions to ask before you buy" }),
  ).toBeFocused();
  await tabTo(page, /^Do staff earn commission on this sale\?$/);
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("switch", { name: "Do staff earn commission on this sale?" }),
  ).toHaveAttribute("aria-checked", "true");
  await tabTo(page, /^Start recording a seller$/);
  await page.keyboard.press("Enter");

  await recordSeller(page, "Seller A", /If you prefer to pay monthly/);
  await tabTo(page, /^Record another seller$/);
  await page.keyboard.press("Enter");
  await recordSeller(page, "Seller B", /I am paid a salary/);

  await tabTo(page, /^Compare sellers$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Seller comparison" })).toBeFocused();
  await expect(page.getByRole("region", { name: "Price" })).toContainText("Seller B");
  await tabTo(page, /^Hear it/);
  await page.keyboard.press("Enter");
  await expect(page.locator(".cv-playing")).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
});
