/**
 * Pharmacy visit and label check. With the scripted doctor visit (care-01) and pharmacy visit
 * (care-02), a label printed "once daily" differs from what was said (twice a day): exactly one
 * flag, with both anchors, and no verdict.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  SAMPLE,
  allowMicrophone,
  axe,
  finishVisit,
  openLabel,
  playing,
  startVisit,
} from "./helpers";

async function doctorThenPharmacy(page: Page): Promise<void> {
  await startVisit(page, `${SAMPLE}#/doctor-card`);
  await finishVisit(page, /any other questions/);
  await openLabel(page);
  await page.getByRole("link", { name: "Record the pharmacy conversation" }).click();
  await expect(page.getByText("Message for the pharmacist")).toBeVisible();
  await expect(page.getByText(/write down how to take each medicine/)).toBeVisible();
  await axe(page, "pharmacist card");
  await page.getByRole("button", { name: "They said yes. Start" }).click();
  await allowMicrophone(page);
  await finishVisit(page, /cool dry place/);
  await expect(page.getByRole("heading", { name: "Your pharmacy summary" })).toBeVisible();
  await axe(page, "pharmacy summary");
}

async function fillLabel(page: Page, medicine: string, dose: string, often: string): Promise<void> {
  await openLabel(page);
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
  await expect(playing(page)).toHaveText(/^Playing /);
});

test("a label that matches says so", async ({ page }) => {
  await doctorThenPharmacy(page);
  await fillLabel(page, "metformin", "500 milligrams", "twice daily");
  await expect(page.getByRole("status").filter({ hasText: "Matches what was said" })).toBeVisible();
  await expect(page.locator(".echo-label-flag")).toHaveCount(0);
});

test("the label photo is shown but never stored", async ({ page }) => {
  await doctorThenPharmacy(page);
  await openLabel(page);
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
