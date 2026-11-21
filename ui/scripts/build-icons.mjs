// Renders each app's public/icons/icon.svg to the PNG sizes the web manifest and iOS need,
// using the Chromium that Playwright already installs (no extra dependency).
//   node ui/scripts/build-icons.mjs        (from the repo root)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const SIZES = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const app of ["echo-care", "echo-cover"]) {
  const dir = `${root}apps/${app}/public/icons/`;
  const svg = readFileSync(`${dir}icon.svg`, "utf8");
  for (const [file, size] of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${size}" height="${size}"></body></html>`,
    );
    await page.screenshot({ path: `${dir}${file}`, omitBackground: false });
    console.log(`${app}: ${file} (${size}x${size})`);
  }
}
await browser.close();
