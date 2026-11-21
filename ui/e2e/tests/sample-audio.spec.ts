/**
 * S23: both apps' sample consults use the actors' recordings. Every segment of every
 * bundled file holds speech (so no "Hear it" is silent) and each file covers its script's
 * times. Decoded in the browser, as the apps do.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = (path: string): string => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

const SAMPLES = [
  ["echo-care", "care-01"],
  ["echo-care", "care-02"],
  ["echo-cover", "cover-01"],
  ["echo-cover", "cover-04"],
  ["echo-cover", "cover-02"],
] as const;

for (const [app, name] of SAMPLES) {
  test(`${app} ${name}.mp3 has speech in every segment`, async ({ page }) => {
    const { segments } = JSON.parse(readFileSync(repo(`evals/consults/${name}.json`), "utf8")) as {
      segments: Array<{ id: string; startMs: number; endMs: number }>;
    };
    const base64 = readFileSync(repo(`apps/${app}/public/samples/${name}.mp3`)).toString("base64");
    await page.goto("/gallery/");
    const result = await page.evaluate(
      async ({ base64, segments }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
        const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes);
        const x = audio.getChannelData(0);
        const rms = (a: number, end: number): number => {
          const b = Math.min(end, x.length);
          let s = 0;
          for (let i = a; i < b; i++) s += x[i] * x[i];
          return Math.sqrt(s / Math.max(1, b - a));
        };
        const at = (ms: number): number => Math.floor((ms / 1000) * audio.sampleRate);
        return {
          ms: audio.duration * 1000,
          levels: segments.map((s) => rms(at(s.startMs), at(s.endMs))),
        };
      },
      { base64, segments },
    );
    // The file covers every segment (allowing for MP3 frame padding).
    expect(result.ms).toBeGreaterThan(segments[segments.length - 1].endMs - 100);
    for (const [i, level] of result.levels.entries()) {
      expect(level, `${name} ${segments[i].id} is silent`).toBeGreaterThan(0.01);
    }
  });
}
