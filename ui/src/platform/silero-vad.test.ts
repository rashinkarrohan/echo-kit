import { describe, it, expect } from "vitest";
import { SileroVad } from "./silero-vad";
import type { VadRuntime } from "./silero-vad";

/** A fake runtime: speech probability is the frame's loudest sample; state counts calls. */
function fakeRuntime(): { runtime: VadRuntime; states: number[] } {
  const states: number[] = [];
  const runtime: VadRuntime = {
    tensor: (type, data, dims) => ({ type, data, dims }),
    run: (feeds) => {
      const input = feeds["input"].data as Float32Array;
      const state = (feeds["state"].data as Float32Array)[0];
      states.push(state);
      let max = 0;
      for (let i = 64; i < input.length; i++) max = Math.max(max, Math.abs(input[i]));
      return Promise.resolve({
        output: { type: "float32", data: new Float32Array([max]), dims: [1, 1] },
        stateN: { type: "float32", data: new Float32Array(256).fill(state + 1), dims: [2, 1, 128] },
      });
    },
  };
  return { runtime, states };
}

const loud = (frames: number): Float32Array => new Float32Array(512 * frames).fill(0.9);
const quiet = (frames: number): Float32Array => new Float32Array(512 * frames).fill(0.01);

describe("SileroVad", () => {
  it("says speech when enough frames are speech, and not for a short click", async () => {
    const { runtime } = fakeRuntime();
    const vad = new SileroVad(runtime);
    expect(await vad.hasSpeech(loud(6))).toBe(true);
    const click = quiet(20);
    click.fill(0.9, 512 * 3, 512 * 4);
    expect(await vad.hasSpeech(click)).toBe(false);
    expect(await vad.hasSpeech(quiet(20))).toBe(false);
  });

  it("threads the model state through a segment and starts fresh for the next", async () => {
    const { runtime, states } = fakeRuntime();
    const vad = new SileroVad(runtime);
    await vad.hasSpeech(quiet(3));
    await vad.hasSpeech(quiet(2));
    expect(states).toEqual([0, 1, 2, 0, 1]);
  });
});
