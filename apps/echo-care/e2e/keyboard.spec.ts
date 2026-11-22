/**
 * Keyboard only completes the main flow, from the home page to hearing a fact on the
 * summary. Tab moves focus; Enter and Space act.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { playing } from "./helpers";

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

test("keyboard only: home, card, microphone, captions, summary, read back, Hear it", async ({
  page,
}) => {
  await page.goto("/?sample=care-01&speed=40");
  await tabTo(page, /^Start a visit$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "I am deaf or hard of hearing." })).toBeFocused();
  await tabTo(page, /^They said yes\. Start$/);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Echo Care needs your microphone" }),
  ).toBeFocused();
  await tabTo(page, /^Record this conversation/);
  await page.keyboard.press("Space");
  await tabTo(page, /^Turn speech into text/);
  await page.keyboard.press("Space");
  await tabTo(page, /^Allow microphone$/);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/any other questions/)).toBeVisible({ timeout: 20_000 });
  await tabTo(page, /^Finish visit$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your visit summary" })).toBeFocused();
  await tabTo(page, /^Show the doctor this$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Read back what you heard" })).toBeFocused();
  await tabTo(page, /^Right$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Right", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await tabTo(page, /^See the summary$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your visit summary" })).toBeFocused();
  await tabTo(page, /^Hear it/);
  await page.keyboard.press("Enter");
  await expect(playing(page)).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
});
