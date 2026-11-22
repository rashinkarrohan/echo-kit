/** S19 completeness: saved live receipts survive reload without persisting audio. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const savedReceipt = {
  conversationId: "saved-doctor-1",
  schemaId: "doctor-visit",
  timestamp: Date.UTC(2026, 10, 18, 10, 30),
  facts: [
    {
      key: "medicine",
      fields: { name: "metformin", dose: "500 milligrams", frequency: "twice daily" },
      anchor: {
        segmentIds: ["seg-0001"],
        startMs: 0,
        endMs: 5000,
        quote: "metformin five hundred milligrams twice daily",
      },
      stamp: "heard_clearly",
    },
  ],
  checklist: [],
  readBack: [],
  labelFlags: [],
  disclaimer:
    "Echo records and summarises what was said. It is not medical advice and not an interpreter.",
  nextSteps: [],
};

async function seedReceipt(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("echo-care");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(req.error?.message ?? "Could not open the database"));
    });
    const ready = db.objectStoreNames.contains("receipts");
    db.close();
    return ready;
  });
  await page.evaluate(async (receipt) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("echo-care");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(req.error?.message ?? "Could not open the database"));
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("receipts", "readwrite");
      tx.objectStore("receipts").put(receipt);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(tx.error?.message ?? "Could not save the receipt"));
    });
    db.close();
  }, savedReceipt);
}

test("a saved visit can be reopened after reload and deleted deliberately", async ({ page }) => {
  await page.goto("/");
  await seedReceipt(page);
  await page.reload();
  // Home offers the last visit.
  const last = page.getByRole("link", { name: /Metformin, 500 milligrams/ });
  await expect(last).toBeVisible();
  await expect(last).toContainText("Last visit");
  // Visits lists every saved visit.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Visits" })
    .click();
  const savedHeading = page.getByRole("heading", { name: "Your visits" });
  await expect(savedHeading).toBeVisible();
  await expect(savedHeading).toBeFocused();
  await expect(page).toHaveTitle("Your visits | Echo Care");
  const saved = page.getByRole("listitem").filter({ hasText: "Metformin, 500 milligrams" });
  await expect(saved).toContainText("1 thing heard");
  await saved.getByRole("button", { name: /^Open:/ }).click();
  await expect(page.getByRole("heading", { name: "Your visit summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metformin" })).toBeVisible();
  await expect(page.getByText("Audio not kept").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Hear it/ })).toHaveCount(0);
  // Directly reloading the summary route restores the latest saved visit too.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Metformin" })).toBeVisible();
  await expect(page.getByText("Audio not kept").first()).toBeVisible();
  // Delete asks first.
  await page.getByRole("link", { name: /Questions & safety/ }).click();
  await page.getByRole("button", { name: "Delete this visit" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this visit?" });
  await expect(confirm).toContainText("This cannot be undone");
  await confirm.getByRole("button", { name: "No, keep it" }).click();
  await expect(page.getByRole("heading", { name: "Questions and safety" })).toBeVisible();
  await page.getByRole("button", { name: "Delete this visit" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.getByText("Visit deleted from this phone.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Metformin, 500 milligrams/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: /Metformin, 500 milligrams/ })).toHaveCount(0);
  await expect(page.getByText("Visit deleted from this phone.")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
});
