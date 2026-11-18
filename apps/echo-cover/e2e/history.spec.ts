/** S22 completeness: seller receipts restore into a neutral comparison after reload. */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function receipt(id: string, seller: string, amount: string, timestamp: number) {
  return {
    conversationId: id,
    schemaId: "hearing-aid-sale",
    seller,
    timestamp,
    facts: [
      {
        key: "price",
        fields: { amount, per: "pair" },
        anchor: {
          segmentIds: ["seg-0001"],
          startMs: 0,
          endMs: 5000,
          quote: `The price is ${amount} for the pair`,
        },
        stamp: "heard_clearly",
      },
    ],
    checklist: [],
    readBack: [],
    labelFlags: [],
    disclaimer:
      "Echo compares what sellers said. It is not legal or financial advice and it does not recommend a purchase.",
    nextSteps: [],
  };
}

async function seedReceipts(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("echo-cover");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(req.error?.message ?? "Could not open database"));
    });
    const ready = db.objectStoreNames.contains("receipts");
    db.close();
    return ready;
  });
  const receipts = [
    receipt("sale-a", "North Clinic", "3800 dollars", Date.UTC(2026, 10, 17, 10)),
    receipt("sale-b", "West Hearing", "4200 dollars", Date.UTC(2026, 10, 18, 11)),
  ];
  await page.evaluate(async (saved) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("echo-cover");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(req.error?.message ?? "Could not open database"));
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("receipts", "readwrite");
      for (const item of saved) tx.objectStore("receipts").put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(tx.error?.message ?? "Could not save receipts"));
    });
    db.close();
  }, receipts);
}

test("saved seller conversations reopen as a comparison without dead audio buttons", async ({
  page,
}) => {
  await page.goto("/");
  await seedReceipts(page);
  await page.reload();

  await expect(page.getByText("2 seller conversations saved on this phone")).toBeVisible();
  await page.getByRole("link", { name: "Open saved comparisons" }).click();
  await expect(page.getByRole("heading", { name: "Saved seller conversations" })).toBeFocused();
  await expect(page.getByText("North Clinic")).toBeVisible();
  await expect(page.getByText("West Hearing")).toBeVisible();
  await page.getByRole("button", { name: "Compare these sellers" }).click();

  await expect(page.getByRole("heading", { name: "Compare sellers" })).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText(["North Clinic", "West Hearing"]);
  await expect(page.getByRole("button", { name: /^Hear it/ })).toHaveCount(0);
  await expect(page.getByText("Audio not kept")).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("columnheader")).toHaveText(["North Clinic", "West Hearing"]);

  await page.getByRole("link", { name: "North Clinic" }).click();
  await page.getByRole("button", { name: "Delete this seller conversation" }).click();
  const confirm = page.getByRole("group", { name: "Delete this seller conversation?" });
  await expect(confirm).toContainText("This cannot be undone");
  await confirm.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name: "Saved seller conversations" })).toBeVisible();
  await expect(page.getByText("North Clinic")).toHaveCount(0);
  await expect(page.getByText("West Hearing")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare these sellers" })).toHaveCount(0);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);
});
