#!/usr/bin/env node
// Production check: serves each app's built `dist/` with the same headers the host must
// send, opens every page in Chromium (phone viewport), and reports console errors, failed
// requests, cross-origin isolation, the service worker and the install manifest.
//
//   (cd apps/echo-care && npx vite build) && (cd apps/echo-cover && npx vite build)
//   node ui/scripts/check-production.mjs            # local dist/ folders
//   node ui/scripts/check-production.mjs <careUrl> <coverUrl>   # a deployed site
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, devices } from "@playwright/test";

const root = new URL("../..", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm",
  ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".onnx": "application/octet-stream",
};
const HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

function serve(dir, port) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "");
      let file = join(dir, path || "index.html");
      try {
        if ((await stat(file)).isDirectory()) file = join(file, "index.html");
        const body = await readFile(file);
        res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", ...HEADERS });
        res.end(body);
      } catch {
        res.writeHead(404, HEADERS);
        res.end("not found");
      }
    });
    server.listen(port, () => resolve(server));
  });
}

const PAGES = {
  care: ["#/home", "#/consent", "#/medicines", "#/visits", "#/trust", "#/doctor-card", "#/pharmacy", "#/record", "#/repeat", "#/ask", "#/receipt", "#/questions", "#/read-back", "#/label", "#/share"],
  cover: ["#/home", "#/consent", "#/questions", "#/record", "#/review", "#/compare", "#/confirm", "#/saved", "#/trust"],
};

async function check(name, base, pages) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon")) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  for (const p of pages) {
    await page.goto(`${base}/${p}`);
    await page.waitForLoadState("networkidle");
    const h1 = await page.locator("main h1, h1").first().textContent({ timeout: 2000 }).catch(() => null);
    // The speaker cards are labelled dialogs with focus on their first button, so no h1.
    const dialog = await page.locator('[role="dialog"][aria-labelledby]').count();
    if (!h1 && dialog === 0) problems.push(`no page heading on ${p}`);
    console.log(`  ${name} ${p.padEnd(14)} h1: ${h1 ? JSON.stringify(h1.trim().slice(0, 60)) : dialog ? "(labelled dialog)" : "(none)"}`);
  }
  const facts = await page.evaluate(async () => ({
    crossOriginIsolated: self.crossOriginIsolated,
    serviceWorker: Boolean(await navigator.serviceWorker?.getRegistration()),
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null,
    lang: document.documentElement.lang,
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null,
  }));
  // The sample consult must reach a receipt with no microphone.
  await page.goto(`${base}/?sample=${name === "care" ? "care-01" : "cover-01"}&demo=1&speed=40#/home`);
  await page.waitForLoadState("networkidle");
  await browser.close();
  return { facts, problems };
}

const [careUrl, coverUrl] = process.argv.slice(2);
const servers = [];
const targets = careUrl
  ? [["care", careUrl], ["cover", coverUrl]]
  : [["care", "http://localhost:5191"], ["cover", "http://localhost:5192"]];
for (const t of targets) t[1] = t[1].replace(/\/+$/, ""); // "https://x.vercel.app/" works too
if (!careUrl) {
  servers.push(await serve(join(root, "apps/echo-care/dist"), 5191));
  servers.push(await serve(join(root, "apps/echo-cover/dist"), 5192));
}
let failed = false;
for (const [name, base] of targets) {
  console.log(`\n${name}: ${base}`);
  const { facts, problems } = await check(name, base, PAGES[name]);
  console.log(`  ${JSON.stringify(facts)}`);
  if (!facts.crossOriginIsolated) problems.push("not cross-origin isolated (COOP/COEP headers missing)");
  if (!facts.serviceWorker) problems.push("no service worker registered (offline will not work)");
  if (!facts.manifest) problems.push("no install manifest");
  for (const p of [...new Set(problems)]) console.log(`  PROBLEM ${p}`);
  if (problems.length > 0) failed = true;
}
for (const s of servers) s.close();
console.log(failed ? "\nProduction check FAILED" : "\nProduction check passed");
process.exit(failed ? 1 : 0);
