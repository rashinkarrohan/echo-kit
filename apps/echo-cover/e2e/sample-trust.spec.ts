/**
 * S23 (Cover part): sample sales need no microphone or model and work offline after the
 * first load; /trust shows the latest eval numbers.
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { axe } from "./helpers";
import { fileURLToPath } from "node:url";

const results = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../evals/results.json", import.meta.url)), "utf8"),
) as { runs: number; totals: { kept: number; plantedFacts: number } };

const PREVIEW = "http://localhost:5184";

test("/trust shows the latest eval numbers", async ({ page }) => {
  await page.goto("/#/trust");
  await expect(page.getByRole("heading", { name: "How Echo did in tests" })).toBeFocused();
  await expect(
    page.locator(".echo-trust div").filter({ hasText: "Facts kept" }).locator("dd").first(),
  ).toHaveText(`${results.totals.kept} of ${results.totals.plantedFacts}`);
  await expect(page.getByRole("region", { name: "Test runs" })).toContainText(String(results.runs));
  await expect(page.getByText(/scripted test conversations, not real purchases/)).toBeVisible();
  await axe(page, "trust");
});

test("the app can be installed: manifest with standard and maskable icons that load", async ({
  page,
  request,
}) => {
  await page.goto(`${PREVIEW}/`);
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = (await (await request.get(`${PREVIEW}/${href}`)).json()) as {
    name: string;
    display: string;
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
  };
  expect(manifest.name).toBe("Echo Cover");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const res = await request.get(`${PREVIEW}/${icon.src}`);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(`${PREVIEW}/${touch}`)).status()).toBe(200);
});

test("sample sales work offline after the first load, without a microphone or model", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));

  await page.goto(`${PREVIEW}/`);
  await expect(
    page.getByRole("heading", { name: "Compare what sellers said, side by side." }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  // The font is self-hosted, so the text looks the same offline.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Compare what sellers said, side by side." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.fonts.check("700 20px 'Atkinson Hyperlegible Next Variable'"),
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Play sample consult" }).click();
  await page.getByRole("button", { name: "Start recording a seller" }).click();
  await expect(page.getByLabel("Seller or clinic name")).toHaveValue("Seller A");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByText(/If you prefer to pay monthly/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Stop and review" }).click();
  await page.getByRole("link", { name: "Record another seller" }).click();
  await expect(page.getByLabel("Seller or clinic name")).toHaveValue("Seller D");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByText(/I am paid a salary/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Stop and review" }).click();
  await page.getByRole("link", { name: "Compare sellers" }).click();
  await expect(page.getByRole("region", { name: "Price" })).toContainText("Seller D");
  // The actor recordings are cached: Hear it is offered and plays, even offline.
  await page
    .getByRole("button", { name: /^Hear it/ })
    .first()
    .click();
  await expect(page.locator(".cv-playing")).toHaveText(/^Playing \d+:\d\d to \d+:\d\d$/);
  await context.setOffline(false);
  expect(requests.filter((u) => /huggingface|\.onnx|\.wasm|asr-worker/.test(u))).toEqual([]);
  // Nothing was requested from any other site, fonts included.
  expect(requests.filter((u) => u.startsWith("http") && !u.startsWith(PREVIEW))).toEqual([]);
});
