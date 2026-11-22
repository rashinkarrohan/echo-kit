/**
 * Your medicines (optional): the user types the medicines they take so Echo can listen
 * for those names. Names only, kept on this phone, removable one by one with Undo.
 */
import { test, expect } from "@playwright/test";
import { axe } from "./helpers";

const capitalised = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

test("add, check, keep, remove and undo the medicines list", async ({ page }) => {
  await page.goto("/#/medicines");
  const heading = page.getByRole("heading", { level: 1, name: "Your medicines" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle("Your medicines | Echo Care");
  await expect(page.getByText("No medicines added yet.")).toBeVisible();
  await expect(page.getByText("Saved on this phone only")).toBeVisible();
  const name = page.getByRole("textbox", { name: "Medicine name" });
  // A dose is refused, with the reason next to the field.
  await name.fill("metformin 500mg");
  await page.getByRole("button", { name: "Add medicine" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Type the name only, using letters. Leave out the dose.",
  );
  await expect(name).toHaveAttribute("aria-invalid", "true");
  // Names are capitalised, as in the design, and the field clears.
  for (const medicine of ["glimepiride", "co-codamol"]) {
    await name.fill(medicine);
    await page.getByRole("button", { name: "Add medicine" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: capitalised(medicine) }),
    ).toBeVisible();
  }
  await expect(page.getByRole("listitem").filter({ hasText: "Glimepiride" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Co-codamol" })).toBeVisible();
  await expect(name).toHaveValue("");
  await expect(page.getByRole("heading", { name: /Your list/ })).toContainText("(2)");
  await name.fill("GLIMEPIRIDE");
  await page.getByRole("button", { name: "Add medicine" }).click();
  await expect(page.getByRole("alert")).toHaveText("That medicine is already on the list.");
  await axe(page, "medicines");
  // Kept on this phone across a reload.
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Co-codamol" })).toBeVisible();
  // Remove shows an Undo bar; Undo puts the name back where it was.
  await page.getByRole("button", { name: "Remove Glimepiride" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Removed Glimepiride" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Glimepiride" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("listitem").nth(0)).toContainText("Glimepiride");
  // Remove for good, and the empty state returns.
  await page.getByRole("button", { name: "Remove Glimepiride" }).click();
  await page.getByRole("button", { name: "Remove Co-codamol" }).click();
  await expect(page.getByText("No medicines added yet.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No medicines added yet.")).toBeVisible();
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: /Read what your doctor says/ })).toBeVisible();
});

test("the medicines list works by keyboard alone", async ({ page }) => {
  await page.goto("/#/medicines");
  await page.getByRole("textbox", { name: "Medicine name" }).focus();
  await page.keyboard.type("warfarin");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "Warfarin" })).toBeVisible();
  await page.getByRole("button", { name: "Remove Warfarin" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No medicines added yet.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "Warfarin" })).toBeVisible();
});
