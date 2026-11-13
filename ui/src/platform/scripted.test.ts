import { describe, it, expect, vi, afterEach } from "vitest";
import { playScript, scriptedAudio, scriptedLines } from "./scripted";
import { createPlayer, joinChunks } from "./player";

const consult = {
  id: "c",
  segments: [
    { id: "seg-0001", startMs: 0, endMs: 4000, text: "one" },
    { id: "seg-0002", startMs: 4000, endMs: 9000, text: "two" },
  ],
};

afterEach(() => vi.useRealTimers());

describe("scripted consults", () => {
  it("makes silent 16 kHz segments with the consult's ids and times", () => {
    const audio = scriptedAudio(consult);
    expect(audio.map((a) => [a.id, a.startMs, a.endMs, a.samples.length, a.hasSpeech])).toEqual([
      ["seg-0001", 0, 4000, 64000, true],
      ["seg-0002", 4000, 9000, 80000, true],
    ]);
    expect(scriptedLines(consult)).toEqual(["one", "two"]);
  });

  it("sends each segment when it ends, scaled by speed, and can pause", async () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const run = playScript(scriptedAudio(consult), (s) => sent.push(s.id), { speed: 10 });
    vi.advanceTimersByTime(399);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(["seg-0001"]);
    run.pause();
    vi.advanceTimersByTime(5000);
    expect(sent).toEqual(["seg-0001"]);
    run.resume();
    vi.advanceTimersByTime(500);
    expect(sent).toEqual(["seg-0001", "seg-0002"]);
    await run.done;
  });

  it("stop ends playback", async () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const run = playScript(scriptedAudio(consult), (s) => sent.push(s.id));
    run.stop();
    vi.advanceTimersByTime(20000);
    await run.done;
    expect(sent).toEqual([]);
  });
});

describe("player", () => {
  it("joins chunks in order", () => {
    expect([...joinChunks([new Float32Array([1, 2]), new Float32Array([3])])]).toEqual([1, 2, 3]);
  });

  it("reports when there is no audio to play", async () => {
    expect(await createPlayer().play([], 16000, 1)).toEqual({
      ok: false,
      error: "No audio for this part",
    });
  });
});
