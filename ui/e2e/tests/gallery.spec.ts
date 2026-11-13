/**
 * S18 Verify: every component and state, in both skins, has zero serious or critical
 * axe violations; plus reduced motion, 200% zoom, keyboard focus and skin distinctness
 * (docs/appendix/UI-SPEC.md "Definition of done").
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function settle(page: Page): Promise<void> {
  await page.waitForSelector("[data-ready]");
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
}

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}: ${v.help}`,
    );
}

test("axe: no serious or critical violations across every component and state, both skins", async ({
  page,
}) => {
  await page.goto("/gallery/");
  await settle(page);
  expect(await page.locator(".gallery-variant").count()).toBeGreaterThanOrEqual(60);
  expect(await seriousViolations(page)).toEqual([]);
});

test("axe: the full-screen Please repeat card, and focus moves into it", async ({ page }) => {
  await page.goto("/gallery/");
  await settle(page);
  await page.locator('[data-open-card="care"]').click();
  const dialog = page.getByRole("dialog", {
    name: "Please say the medicine name and the dose again, slowly.",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Done" })).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
});

test("axe: speaker-facing read-back", async ({ page }) => {
  await page.goto("/gallery/");
  await settle(page);
  await page
    .locator('[data-skin-gallery="care"] [data-status="ready"]')
    .getByRole("button", { name: "Show the doctor" })
    .first()
    .click();
  await expect(page.getByText("Not marked yet").first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("reduced motion removes the receipt print animation", async ({ page }) => {
  await page.goto("/gallery/");
  const animationOf = () =>
    page
      .locator(".echo-receipt-line")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
  await page.waitForSelector(".echo-receipt-line");
  expect(await animationOf()).toBe("echo-print");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await animationOf()).toBe("none");
});

test("200% zoom on a phone (390 px wide) causes no horizontal page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 195, height: 800 });
  await page.goto("/gallery/");
  await settle(page);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("keyboard focus is visible (3 px ring) and tap targets are at least 56 px", async ({
  page,
}) => {
  await page.goto("/gallery/");
  await settle(page);
  const button = page.getByRole("button", { name: "Hear it, 0:04 to 0:12" }).first();
  await button.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const ring = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      width: s.outlineWidth,
      style: s.outlineStyle,
      height: el.getBoundingClientRect().height,
    };
  });
  expect(ring).toMatchObject({ width: "3px", style: "solid" });
  expect(ring.height).toBeGreaterThanOrEqual(56);
});

test("comparison stamps stay on one line (tablet width, where they used to wrap)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto("/gallery/");
  await settle(page);
  const heights = await page
    .locator('[data-skin-gallery="cover"] [data-status="ready"] .echo-ledger .echo-stamp')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const h of heights) expect(h).toBeLessThan(56);
});

test("consent choices look like on/off switches, not checkboxes", async ({ page }) => {
  await page.goto("/gallery/");
  await settle(page);
  const sw = page.getByRole("switch", { name: "Record this conversation" }).first();
  const box = await sw.boundingBox();
  expect(box && box.width).toBeGreaterThanOrEqual(box ? box.height * 1.5 : 0);
  const before = await sw.evaluate((el) => getComputedStyle(el).backgroundColor);
  await sw.click();
  const after = await sw.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(after).not.toBe(before);
});

test("a Not said stamp inside a receipt row uses body text size", async ({ page }) => {
  await page.goto("/gallery/");
  await settle(page);
  const size = await page
    .locator(".echo-receipt__field dd .echo-stamp")
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  expect(size).toBe("20px");
});

test("Care and Cover look different (distinctness rule)", async ({ page }) => {
  await page.goto("/gallery/");
  await settle(page);
  const look = (skin: string) =>
    page.locator(`.echo[data-skin="${skin}"]`).evaluate((root) => {
      const stamp = root.querySelector(".echo-stamp");
      const card = root.querySelector(".echo-receipt-line");
      return {
        bg: getComputedStyle(root).backgroundColor,
        stampRadius: stamp ? getComputedStyle(stamp).borderTopLeftRadius : "",
        cardRadius: card ? getComputedStyle(card).borderTopLeftRadius : "",
      };
    });
  const care = await look("care");
  const cover = await look("cover");
  expect(care.bg).not.toBe(cover.bg);
  expect(care.stampRadius).not.toBe(cover.stampRadius);
  expect(care.cardRadius).not.toBe(cover.cardRadius);
  const nums = await page
    .locator('.echo[data-skin="cover"] .echo-ledger')
    .evaluate((t) => getComputedStyle(t).fontVariantNumeric);
  expect(nums).toContain("tabular-nums");
});
