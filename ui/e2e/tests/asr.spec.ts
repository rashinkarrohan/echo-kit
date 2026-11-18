/**
 * S16 Verify: load the Whisper adapter in a browser and transcribe the bundled actor clip.
 * Needs network on first run (the model downloads from Hugging Face, then is cached).
 */

import { test, expect } from "@playwright/test";
import type { SpikeResult } from "../spike/types";

test("transcribes the bundled 10-second actor clip on the device", async ({ page }) => {
  test.setTimeout(420_000);
  await page.goto("/spike/");
  await page.waitForFunction(() => "__spike" in window, undefined, { timeout: 400_000 });
  const result = await page.evaluate(() => (window as unknown as { __spike: SpikeResult }).__spike);

  console.log(JSON.stringify(result, null, 2));
  await test.info().attach("spike-result", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });

  expect(result.error).toBeUndefined();
  expect(result.segments.filter((s) => s.error)).toEqual([]);
  expect(["webgpu", "wasm"]).toContain(result.device);

  const heard = ` ${result.normalisedText} `;
  for (const phrase of ["500 milligrams", "twice daily", "come back", "3 months"]) {
    expect(heard, `expected to hear "${phrase}"`).toContain(` ${phrase} `);
  }
  // With base.en and the medicine-name prompt (the defaults), the drug name in the actor
  // clip is heard correctly. Without the prompt it was "meriforming" (docs/SPIKES.md).
  expect(heard).toContain(" metformin ");
});

// large-v3-turbo is about 760 MB, so it runs only when asked: ASR_TURBO=1 npx playwright test asr
test("turbo transcribes the actor clip on the device", async ({ page }) => {
  test.skip(process.env.ASR_TURBO !== "1", "set ASR_TURBO=1 to download and run large-v3-turbo");
  test.setTimeout(1_500_000);
  await page.goto("/spike/?model=turbo&devices=wasm");
  await page.waitForFunction(() => "__spike" in window, undefined, { timeout: 1_450_000 });
  const result = await page.evaluate(() => (window as unknown as { __spike: SpikeResult }).__spike);
  console.log(JSON.stringify(result, null, 2));

  expect(result.error).toBeUndefined();
  expect(result.model).toBe("onnx-community/whisper-large-v3-turbo");
  expect(result.segments.filter((s) => s.error)).toEqual([]);
  const heard = ` ${result.normalisedText} `;
  for (const phrase of ["500 milligrams", "twice daily", "3 months"]) {
    expect(heard, `expected to hear "${phrase}"`).toContain(` ${phrase} `);
  }
  // Known miss: turbo heard this speaker's "metformin" as "merforamines" (docs/SPIKES.md);
  // base.en with the prompt hears it correctly, which is why base.en stays the default.
});
