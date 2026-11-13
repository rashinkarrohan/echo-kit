/**
 * S20 Verify: pharmacy stage and label check. With the scripted doctor visit (care-01)
 * and pharmacy visit (care-02), a label printed "once daily" differs from what was
 * said (twice a day): exactly one flag, with both anchors, and no verdict.
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

async function record(page: Page, lastWords: RegExp): Promise<void> {
  await page.getByRole("button", { name: "They agreed, start" }).click();
  await expect(page.getByText(lastWords)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Stop and review" }).click();
}

async function doctorThenPharmacy(page: Page): Promise<void> {
  await page.goto("/?sample=care-01&speed=40#/consent");
  await page.getByRole("switch", { name: "Record this conversation" }).click();
  await page.getByRole("switch", { name: "Turn speech into text on my phone" }).click();
  await page.getByRole("button", { name: "I agree and continue" }).click();
  await record(page, /any other questions/);
  await page.getByRole("button", { name: "See the receipt" }).click();

  await page.getByRole("button", { name: "At the pharmacy" }).click();
  await expect(
    page.getByRole("dialog", { name: /Please write down how to take each medicine/ }),
  ).toBeVisible();
  await axe(page, "pharmacist card");
  await record(page, /cool dry place/);
  await page.getByRole("button", { name: "See the receipt" }).click();
  await expect(page.getByRole("heading", { name: /^Pharmacy, / })).toBeVisible();
  await axe(page, "pharmacy receipt");
}

async function fillLabel(page: Page, medicine: string, dose: string, often: string): Promise<void> {
  await page.getByRole("button", { name: "Check the label" }).click();
  await axe(page, "label form");
  await page.getByLabel("Medicine").fill(medicine);
  await page.getByLabel("Dose").fill(dose);
  await page.getByLabel("How often").fill(often);
  await page.getByRole("button", { name: "Compare with what was said" }).click();
}

test("a label mismatch shows exactly one flag with both anchors and no verdict", async ({
  page,
}) => {
  await doctorThenPharmacy(page);
  await fillLabel(page, "Metformin", "500 mg", "once daily");

  const flags = page.locator(".echo-label-flag");
  await expect(flags).toHaveCount(1);
  const flag = flags.first();
  await expect(flag.getByRole("heading")).toHaveText("How often");
  await expect(flag).toContainText("Printed: once daily. Check with your pharmacist or doctor.");
  await expect(flag).toContainText("Said: twice daily.");
  // Both anchors: the doctor's words and the pharmacist's words.
  await expect(flag.getByRole("button", { name: /^Hear it/ })).toHaveCount(2);
  await expect(flag).toContainText("twice daily after food");
  await expect(flag).toContainText("one tablet in the morning and one tablet in the evening");
  expect(await flag.textContent()).not.toMatch(
    /\b(wrong|correct|incorrect|mistake|error|should)\b/i,
  );
  await axe(page, "label flag");

  // Each anchor plays its own recording.
  await flag
    .getByRole("button", { name: /^Hear it/ })
    .first()
    .click();
  await expect(page.locator(".care-playing")).toHaveText(/^Playing /);
});

test("a label that matches says so", async ({ page }) => {
  await doctorThenPharmacy(page);
  await fillLabel(page, "metformin", "500 milligrams", "twice daily");
  await expect(page.getByRole("status").filter({ hasText: "Matches what was said" })).toBeVisible();
  await expect(page.locator(".echo-label-flag")).toHaveCount(0);
});

test("the label photo is shown but never stored", async ({ page }) => {
  await doctorThenPharmacy(page);
  await page.getByRole("button", { name: "Check the label" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByRole("img", { name: "Your photo of the label" })).toBeVisible();
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("echo-care");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(req.error?.message ?? "Could not open the database"));
    });
    const names = Array.from(db.objectStoreNames);
    const values: unknown[] = [];
    for (const name of names) {
      values.push(
        ...(await new Promise<unknown[]>((resolve) => {
          const r = db.transaction(name).objectStore(name).getAll();
          r.onsuccess = () => resolve(r.result as unknown[]);
        })),
      );
    }
    db.close();
    return JSON.stringify(values);
  });
  expect(stored).not.toMatch(/image\/|blob:|data:image|label\.png/);
});
