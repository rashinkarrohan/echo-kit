/**
 * Your medicines (optional): the user types the medicines they take so Echo can listen
 * for those names. Names only, kept on this phone, removable one by one or all at once.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("add, check, keep and delete the medicines list", async ({ page }) => {
  await page.goto("/#/consent");
  await expect(
    page.getByRole("heading", { name: "Help Echo hear your medicines (optional)" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add your medicines" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your medicines" })).toBeVisible();
  await expect(page.getByText("No medicines added yet.")).toBeVisible();

  const name = page.getByRole("textbox", { name: "Medicine name" });
  // A dose is refused, with the reason next to the field.
  await name.fill("metformin 500mg");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Type the name only, using letters. Leave out the dose.",
  );
  await expect(name).toHaveAttribute("aria-invalid", "true");

  for (const medicine of ["Glimepiride", "co-codamol"]) {
    await name.fill(medicine);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: medicine })).toBeVisible();
  }
  await expect(name).toHaveValue("");
  await name.fill("glimepiride");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("alert")).toHaveText("That medicine is already on the list.");

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);

  // Kept on this phone across a reload.
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "co-codamol" })).toBeVisible();
  await page.getByRole("button", { name: "Remove co-codamol" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "co-codamol" })).toHaveCount(0);

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page.getByText("1 medicine on your list. They stay on this phone.")).toBeVisible();
  await page.getByRole("link", { name: "Edit your medicines" }).click();

  await page.getByRole("button", { name: "Delete the whole list" }).click();
  const confirm = page.getByRole("group", { name: "Delete the whole list from this phone?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Glimepiride" })).toBeVisible();
  await page.getByRole("button", { name: "Delete the whole list" }).click();
  await confirm.getByRole("button", { name: "Delete the list" }).click();
  await expect(page.getByText("Your list was deleted from this phone.")).toBeVisible();
  await expect(page.getByText("No medicines added yet.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No medicines added yet.")).toBeVisible();
});

test("the medicines list works by keyboard alone", async ({ page }) => {
  await page.goto("/#/medicines");
  await page.getByRole("textbox", { name: "Medicine name" }).focus();
  await page.keyboard.type("warfarin");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "warfarin" })).toBeVisible();
  await page.getByRole("button", { name: "Remove warfarin" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No medicines added yet.")).toBeVisible();
});
