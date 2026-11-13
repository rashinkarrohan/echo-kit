import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Segmenter } from "./segmenter";
import type { AudioSegment } from "./segmenter";
import { resample } from "./resample";

const SR = 16000;
const FRAME = 320; // 20 ms at 16 kHz

/** Speech-like burst: a modulated tone. Silence: faint noise. */
function frames(kind: "speech" | "silence", ms: number, noise = 0.001, seed = 1): Float32Array[] {
  const out: Float32Array[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648 - 0.5;
  };
  const n = Math.round(((ms / 1000) * SR) / FRAME);
  for (let f = 0; f < n; f++) {
    const frame = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i++) {
      const t = (f * FRAME + i) / SR;
      frame[i] =
        kind === "speech"
          ? 0.3 * Math.sin(2 * Math.PI * 180 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t)) +
            noise * rand()
          : noise * rand();
    }
    out.push(frame);
  }
  return out;
}

function run(pattern: Array<["speech" | "silence", number]>, noise = 0.001) {
  const seg = new Segmenter({ sampleRate: SR });
  const all = pattern.flatMap(([k, ms], i) => frames(k, ms, noise, i + 1));
  const segments: AudioSegment[] = [];
  let t = 0;
  for (const f of all) {
    segments.push(...seg.push(f, t));
    t += (f.length / SR) * 1000;
  }
  const last = seg.flush();
  return { segments, last, totalSamples: all.reduce((a, f) => a + f.length, 0) };
}

const dur = (s: AudioSegment) => s.endMs - s.startMs;

describe("Segmenter", () => {
  it("cuts continuous speech at the 8 s maximum", () => {
    const { segments } = run([["speech", 20000]]);
    expect(segments.map(dur)).toEqual([8000, 8000]);
  });

  it("cuts at the first silence of at least 300 ms after 3 s", () => {
    const { segments } = run([
      ["speech", 3500],
      ["silence", 500],
      ["speech", 4000],
      ["silence", 600],
    ]);
    expect(segments[0].startMs).toBe(0);
    expect(segments[0].endMs).toBe(3800); // 3.5 s speech + 300 ms silence
  });

  it("does not cut at a silence before 3 s", () => {
    const { segments } = run([
      ["speech", 1500],
      ["silence", 400],
      ["speech", 3000],
      ["silence", 400],
    ]);
    expect(dur(segments[0])).toBeGreaterThanOrEqual(3000);
    // speech ends at 4.9 s; the first qualifying silence completes 300 ms later
    expect(segments[0].endMs).toBe(5200);
  });

  it("adapts to background noise", () => {
    const { segments } = run(
      [
        ["silence", 1000],
        ["speech", 3500],
        ["silence", 500],
        ["speech", 3000],
      ],
      0.03,
    );
    expect(segments[0].endMs).toBe(4800);
  });

  it("learns a room that is louder than the starting threshold and then cuts at pauses", () => {
    const { segments } = run(
      [
        ["silence", 12000],
        ["speech", 3500],
        ["silence", 500],
        ["speech", 3000],
      ],
      0.15, // noise RMS about 0.043: above the starting threshold (0.03), speech about 4x louder
    );
    // Speech runs 12.0 to 15.5 s, then a 500 ms pause. The cut must fall in that pause
    // (a quiet dip at the end of the synthetic speech may start the silence a little early).
    const cutInPause = segments.some((s) => s.endMs >= 15300 && s.endMs <= 16000);
    expect(cutInPause).toBe(true);
    expect(segments.every((s) => s.endMs - s.startMs >= 3000)).toBe(true);
  });

  it("leading digital silence (exact zeros) does not hide later pauses in room noise", () => {
    // Real recordings often start with zeros (encoder priming). Room hiss after that is
    // about RMS 0.004, which is above the absolute minimum threshold.
    const seg = new Segmenter({ sampleRate: SR });
    const parts: Float32Array[] = [
      ...Array.from({ length: 25 }, () => new Float32Array(FRAME)), // 0.5 s of zeros
      ...frames("silence", 1000, 0.014, 7),
      ...frames("speech", 4000, 0.014, 8),
      ...frames("silence", 1000, 0.014, 9),
      ...frames("speech", 3000, 0.014, 10),
    ];
    const out: AudioSegment[] = [];
    let t = 0;
    for (const f of parts) {
      out.push(...seg.push(f, t));
      t += (f.length / SR) * 1000;
    }
    // speech ends at 5.5 s; the cut must land in the following pause, not at 8 s
    expect(out[0].endMs).toBeGreaterThanOrEqual(5500);
    expect(out[0].endMs).toBeLessThanOrEqual(6500);
  });

  it("quiet phone recording: finds pauses that sit just above the absolute minimum", () => {
    // Shape of the real S16 clip: zeros, a very faint fade-in, quiet speech (RMS about
    // 0.03) and pauses whose hiss (RMS about 0.0035) is barely above 0.003.
    const seg = new Segmenter({ sampleRate: SR });
    const quiet = (f: Float32Array) => f.map((v) => v * 0.2);
    const parts: Float32Array[] = [
      ...Array.from({ length: 25 }, () => new Float32Array(FRAME)),
      ...frames("silence", 200, 0.002, 3),
      ...frames("silence", 800, 0.012, 4),
      ...frames("speech", 4000, 0.06, 5).map(quiet),
      ...frames("silence", 1000, 0.012, 6),
      ...frames("speech", 3000, 0.06, 7).map(quiet),
    ];
    const out: AudioSegment[] = [];
    let t = 0;
    for (const f of parts) {
      out.push(...seg.push(f, t));
      t += (f.length / SR) * 1000;
    }
    // speech ends at 5.5 s; the cut must land in the following pause, not at 8 s
    expect(out[0].endMs).toBeGreaterThanOrEqual(5500);
    expect(out[0].endMs).toBeLessThanOrEqual(6500);
  });

  it("quiet speech only 2.5x louder than the room is still marked as speech", () => {
    const seg = new Segmenter({ sampleRate: SR });
    const scale = (k: number) => (f: Float32Array) => f.map((v) => v * k);
    const parts: Float32Array[] = [
      ...frames("silence", 2000, 0.012, 11), // room RMS about 0.0035
      ...frames("speech", 4000, 0, 12).map(scale(0.04)), // speech RMS about 0.009
      ...frames("silence", 3000, 0.012, 13),
    ];
    const out: AudioSegment[] = [];
    let t = 0;
    for (const f of parts) {
      out.push(...seg.push(f, t));
      t += (f.length / SR) * 1000;
    }
    const last = seg.flush();
    if (last) out.push(last);
    const covering = out.filter((s) => s.startMs < 6000 && s.endMs > 2000);
    expect(covering.length).toBeGreaterThan(0);
    expect(covering.every((s) => s.hasSpeech)).toBe(true);
  });

  it("marks segments with no speech so silence is never sent for transcription", () => {
    const { segments } = run([
      ["silence", 9000],
      ["speech", 4000],
      ["silence", 400],
    ]);
    expect(segments[0].hasSpeech).toBe(false);
    expect(segments[segments.length - 1].hasSpeech).toBe(true);
  });

  it("flush returns the remainder (which may be shorter than 3 s) and resets", () => {
    const { segments, last } = run([["speech", 9500]]);
    expect(segments.map(dur)).toEqual([8000]);
    expect(last && dur(last)).toBe(1500);
  });

  it("gives ordered indices and ids starting at seg-0001", () => {
    const { segments } = run([["speech", 17000]]);
    expect(segments.map((s) => s.id)).toEqual(["seg-0001", "seg-0002"]);
    expect(segments.map((s) => s.index)).toEqual([0, 1]);
  });

  it("property: segments are 3 to 8 s, ordered, contiguous, and keep every sample", () => {
    const part = fc.tuple(
      fc.constantFrom<"speech" | "silence">("speech", "silence"),
      fc.integer({ min: 1, max: 60 }),
    );
    fc.assert(
      fc.property(
        fc.array(part, { minLength: 1, maxLength: 12 }),
        fc.constantFrom(0.001, 0.01, 0.03),
        (parts, noise) => {
          const pattern = parts.map(([k, n]) => [k, n * 100] as ["speech" | "silence", number]);
          const { segments, last, totalSamples } = run(pattern, noise);
          let prevEnd = 0;
          for (const s of segments) {
            expect(dur(s)).toBeGreaterThanOrEqual(3000);
            expect(dur(s)).toBeLessThanOrEqual(8000);
            expect(s.startMs).toBe(prevEnd);
            expect(s.samples.length).toBe(Math.round((dur(s) / 1000) * SR));
            prevEnd = s.endMs;
          }
          if (last) {
            expect(last.startMs).toBe(prevEnd);
            expect(dur(last)).toBeLessThanOrEqual(8000);
          }
          const kept =
            segments.reduce((a, s) => a + s.samples.length, 0) + (last?.samples.length ?? 0);
          expect(kept).toBe(totalSamples);
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe("resample", () => {
  it("halves 32 kHz to 16 kHz", () => {
    const input = new Float32Array(3200).map((_, i) => Math.sin(i / 10));
    const out = resample(input, 32000, 16000);
    expect(out.length).toBe(1600);
  });

  it("converts 48 kHz to 16 kHz length", () => {
    expect(resample(new Float32Array(4800), 48000, 16000).length).toBe(1600);
    expect(resample(new Float32Array(441), 44100, 16000).length).toBe(160);
  });

  it("returns a copy when rates match", () => {
    const input = new Float32Array([0.1, 0.2]);
    const out = resample(input, 16000, 16000);
    expect([...out]).toEqual([...input]);
    expect(out).not.toBe(input);
  });

  it("keeps a constant signal constant", () => {
    const out = resample(new Float32Array(480).fill(0.25), 48000, 16000);
    for (const v of out) expect(v).toBeCloseTo(0.25, 5);
  });
});
