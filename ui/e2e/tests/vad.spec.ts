/**
 * The speech check runs in a real browser: Silero VAD (onnxruntime-web, WebAssembly) finds
 * speech in every segment of the actors' sample recordings, and none in silence, room
 * noise, a cough-like burst, a clap or door knocks. Those non-speech sounds pass the energy
 * gate, and Whisper writes words on them (docs/SPIKES.md, Nov 21, 2026).
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = (path: string): string => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

async function ready(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/vad/");
  await expect(page.getByText("Ready."), errors.join("\n")).toBeVisible({ timeout: 60_000 });
}

test("finds speech in every segment of the actors' recordings", async ({ page }) => {
  await ready(page);
  for (const [app, name] of [
    ["echo-care", "care-01"],
    ["echo-cover", "cover-02"],
  ] as const) {
    const { segments } = JSON.parse(readFileSync(repo(`evals/consults/${name}.json`), "utf8")) as {
      segments: Array<{ startMs: number; endMs: number }>;
    };
    const base64 = readFileSync(repo(`apps/${app}/public/samples/${name}.mp3`)).toString("base64");
    const results = await page.evaluate(
      async ({ base64, segments }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
        // Decoding into a 16 kHz context resamples, as the apps do.
        const audio = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(bytes);
        const x = audio.getChannelData(0);
        const out: boolean[] = [];
        for (const s of segments) {
          const part = x.slice(Math.floor(s.startMs * 16), Math.floor(s.endMs * 16));
          out.push(
            await (
              window as unknown as { vadHasSpeech: (a: number[]) => Promise<boolean> }
            ).vadHasSpeech([...part]),
          );
        }
        return out;
      },
      { base64, segments },
    );
    expect(results, name).toEqual(segments.map(() => true));
  }
});

test("finds no speech in silence, room noise, a cough-like burst, a clap or knocks", async ({
  page,
}) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const sr = 16000;
    let seed = 11;
    const rand = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const base = (s: number): Float32Array =>
      Float32Array.from({ length: sr * s }, () => rand() * 0.002);
    const burst = (level: number, ms: number, decay: number): Float32Array => {
      const a = base(4);
      let lp = 0;
      for (let i = 0; i < (ms / 1000) * sr; i++) {
        lp = lp * 0.6 + rand() * 0.4;
        a[sr + i] += lp * level * Math.exp(-i / (decay * sr));
      }
      return a;
    };
    const knocks = base(4);
    for (const t of [0.8, 1.1, 1.4])
      for (let i = 0; i < 800; i++)
        knocks[Math.floor(t * sr) + i] += Math.sin(i / 3) * 0.4 * Math.exp(-i / 150);
    const hum = Float32Array.from(
      { length: sr * 6 },
      (_, i) => 0.03 * (Math.sin((2 * Math.PI * 120 * i) / sr) + 0.3 * rand()),
    );
    const clips: Record<string, Float32Array> = {
      silence: new Float32Array(sr * 4),
      "room noise": base(4),
      "cough-like burst": burst(0.4, 250, 0.08),
      clap: burst(0.8, 40, 0.01),
      knocks,
      "fan hum": hum,
    };
    const out: Record<string, boolean> = {};
    for (const [name, clip] of Object.entries(clips)) {
      out[name] = await (
        window as unknown as { vadHasSpeech: (a: number[]) => Promise<boolean> }
      ).vadHasSpeech([...clip]);
    }
    return out;
  });
  expect(results).toEqual({
    silence: false,
    "room noise": false,
    "cough-like burst": false,
    clap: false,
    knocks: false,
    "fan hum": false,
  });
});
