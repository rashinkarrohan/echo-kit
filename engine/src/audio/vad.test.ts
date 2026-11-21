import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { SILERO_CONTEXT, SILERO_FRAME, hasSpeechFrames, sileroInputs } from "./vad";

describe("sileroInputs (frames for Silero VAD v5/v6)", () => {
  it("makes one 576-sample input per whole 512-sample frame", () => {
    const inputs = sileroInputs(new Float32Array(512 * 3 + 100));
    expect(inputs).toHaveLength(3);
    for (const x of inputs) expect(x.length).toBe(SILERO_CONTEXT + SILERO_FRAME);
  });

  it("starts with silence as context, then carries the last 64 samples of each frame", () => {
    const samples = Float32Array.from({ length: 1024 }, (_, i) => i + 1);
    const [first, second] = sileroInputs(samples);
    expect([...first.slice(0, SILERO_CONTEXT)].every((v) => v === 0)).toBe(true);
    expect(first[SILERO_CONTEXT]).toBe(1);
    expect([...second.slice(0, SILERO_CONTEXT)]).toEqual([...samples.slice(448, 512)]);
    expect([...second.slice(SILERO_CONTEXT)]).toEqual([...samples.slice(512, 1024)]);
  });

  it("is empty for audio shorter than one frame", () => {
    expect(sileroInputs(new Float32Array(100))).toEqual([]);
  });
});

describe("hasSpeechFrames", () => {
  it("needs a few speech frames (about 160 ms), not one click", () => {
    expect(hasSpeechFrames([0.9])).toBe(false);
    expect(hasSpeechFrames([0.9, 0.9, 0.9, 0.9, 0.9])).toBe(true);
    expect(hasSpeechFrames([0.1, 0.2, 0.3, 0.4, 0.49, 0.2])).toBe(false);
  });

  it("property: more confident frames never turn speech into no speech", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { maxLength: 40 }),
        fc.nat({ max: 39 }),
        (probs, i) => {
          if (!hasSpeechFrames(probs) || probs.length === 0) return;
          const raised = [...probs];
          raised[i % raised.length] = 1;
          expect(hasSpeechFrames(raised)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
