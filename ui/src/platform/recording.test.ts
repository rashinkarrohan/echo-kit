import { describe, it, expect } from "vitest";
import {
  ConsentLedger,
  ConsentRequiredError,
  CONSENT_WORDING_VERSION,
  MemoryStore,
} from "@echo/engine";
import type { AsrAdapter, ConversationSchema } from "@echo/engine";
import { RecordingController } from "./recording";
import type { CaptureDeps } from "./capture";

const schema: ConversationSchema = {
  id: "doctor-visit",
  skin: "care",
  detectors: ["number", "drug", "frequency", "date"],
  disclaimer: "d",
  facts: [
    {
      key: "medicine",
      fields: ["name", "dose", "frequency"],
      cues: { anchor: "@drug", windowWords: 25 },
    },
  ],
  checklist: [],
  nextSteps: [],
};

const consult = {
  id: "c1",
  segments: [
    { id: "seg-0001", startMs: 0, endMs: 4000, text: "Your sugar is high." },
    {
      id: "seg-0002",
      startMs: 4000,
      endMs: 9000,
      text: "Start metformin, five hundred milligrams, twice daily.",
    },
  ],
};

const consented = () => {
  const l = new ConsentLedger();
  l.grant("record", CONSENT_WORDING_VERSION);
  l.grant("transcribe", CONSENT_WORDING_VERSION);
  return l;
};

describe("RecordingController (scripted)", () => {
  it("refuses to start without consent", async () => {
    const c = new RecordingController();
    await expect(
      c.start({
        sessionId: "s",
        schema,
        ledger: new ConsentLedger(),
        source: { kind: "scripted", consult },
      }),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(c.state.status).toBe("idle");
  });

  it("captions arrive with flags, then stop builds and stores the receipt", async () => {
    const store = new MemoryStore();
    const c = new RecordingController();
    await c.start({
      sessionId: "s1",
      schema,
      ledger: consented(),
      store,
      source: { kind: "scripted", consult, speed: 1000 },
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(c.state.lines.map((l) => l.segment.text)).toEqual(consult.segments.map((s) => s.text));
    expect(c.state.lines[1].tokens.map((t) => t.kind)).toContain("drug");
    const r = await c.stop();
    expect(r.ok && r.value.facts.map((f) => f.fields["name"])).toEqual(["metformin"]);
    expect(c.state.status).toBe("done");
    expect((await store.getReceipt("s1")).ok).toBe(true);
    expect(c.audioFor(["seg-0002"])[0].length).toBe(80000);
  });

  it("passes the user's own medicines list to the session", async () => {
    const misheard = {
      id: "c2",
      segments: [{ id: "seg-0001", startMs: 0, endMs: 5000, text: "Keep the blamepiride, 2 mg." }],
    };
    const c = new RecordingController();
    await c.start({
      sessionId: "s2",
      schema,
      ledger: consented(),
      medicines: ["glimepiride"],
      source: { kind: "scripted", consult: misheard, speed: 1000 },
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(c.state.lines[0].tokens.find((t) => t.kind === "drug")?.suggestion).toBe("glimepiride");
    const r = await c.stop();
    expect(r.ok && r.value.facts[0]).toMatchObject({
      fields: { name: "blamepiride" },
      stamp: "check_this",
    });
  });

  it("discard stops playback without storing a receipt", async () => {
    const store = new MemoryStore();
    const c = new RecordingController();
    await c.start({
      sessionId: "discarded",
      schema,
      ledger: consented(),
      store,
      source: { kind: "scripted", consult, speed: 1 },
    });
    await c.discard();
    expect(c.state.status).toBe("idle");
    await new Promise((r) => setTimeout(r, 30));
    expect(c.state.lines).toEqual([]);
    expect(await store.getReceipt("discarded")).toEqual({ ok: true, value: undefined });
  });

  it("plays the actor recording for a scripted consult that has one", async () => {
    const recording = new Float32Array(9 * 16000).fill(0.25);
    const c = new RecordingController();
    await c.start({
      sessionId: "voiced",
      schema,
      ledger: consented(),
      source: {
        kind: "scripted",
        consult: { ...consult, audioUrl: "samples/test.wav" },
        speed: 1000,
        loadAudio: (url) => {
          expect(url).toBe("samples/test.wav");
          return Promise.resolve({ ok: true, value: recording });
        },
      },
    });
    await new Promise((r) => setTimeout(r, 30));
    await c.stop();
    expect(c.hasAudio).toBe(true);
    expect(c.audioFor(["seg-0002"])[0][0]).toBe(0.25);
  });

  it("has no audio to offer when the recording cannot be loaded, or there is none", async () => {
    const failed = new RecordingController();
    await failed.start({
      sessionId: "no-file",
      schema,
      ledger: consented(),
      source: {
        kind: "scripted",
        consult: { ...consult, audioUrl: "samples/missing.wav" },
        speed: 1000,
        loadAudio: () => Promise.resolve({ ok: false, error: "404" }),
      },
    });
    expect(failed.hasAudio).toBe(false);

    const textOnly = new RecordingController();
    await textOnly.start({
      sessionId: "text-only",
      schema,
      ledger: consented(),
      source: { kind: "scripted", consult, speed: 1000 },
    });
    expect(textOnly.hasAudio).toBe(false);
  });

  it("pause stops new segments until resumed", async () => {
    const c = new RecordingController();
    await c.start({
      sessionId: "s2",
      schema,
      ledger: consented(),
      source: { kind: "scripted", consult, speed: 100 },
    });
    c.pause();
    expect(c.state.status).toBe("paused");
    await new Promise((r) => setTimeout(r, 120));
    expect(c.state.lines).toEqual([]);
    c.resume();
    await new Promise((r) => setTimeout(r, 150));
    expect(c.state.lines).toHaveLength(2);
  });
});

describe("RecordingController (live)", () => {
  const asr = (): AsrAdapter & { load: () => Promise<{ ok: true; value: undefined }> } => ({
    id: "fake",
    load: () => Promise.resolve({ ok: true, value: undefined }),
    transcribe: () => Promise.resolve({ ok: true, value: { text: "hello" } }),
  });

  it("shows permission denied when the microphone is refused, without loading the model", async () => {
    let loaded = false;
    const deps: CaptureDeps = {
      getUserMedia: () =>
        Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" })),
      createContext: () => undefined,
      createWorkletNode: () => Promise.reject(new Error("unused")),
    };
    const c = new RecordingController();
    await c.start({
      sessionId: "s3",
      schema,
      ledger: consented(),
      source: {
        kind: "live",
        captureDeps: deps,
        createAsr: () => ({
          ...asr(),
          load: () => ((loaded = true), Promise.resolve({ ok: true, value: undefined })),
        }),
      },
    });
    expect(c.state.status).toBe("permission-denied");
    expect(loaded).toBe(false);
  });

  /**
   * Capture deps whose microphone plays `seconds` of a loud tone, one 128-sample frame at a time.
   * With `pulsed`, the tone is on for 2 s and off for 1 s, so every 3 s segment holds speech.
   */
  const toneDeps = (seconds: number, pulsed = false): CaptureDeps => {
    const port: { onmessage: ((e: { data: unknown }) => void) | null } = { onmessage: null };
    return {
      getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: () => {} }] }),
      createContext: () => ({
        sampleRate: 16000,
        createMediaStreamSource: () => ({
          connect: () => {
            setTimeout(() => {
              for (let i = 0; i < seconds * 16000; i += 128)
                port.onmessage?.({
                  data: new Float32Array(128).map((_, j) =>
                    pulsed && (i + j) % 48000 >= 32000
                      ? 0
                      : 0.3 * Math.sin((2 * Math.PI * 180 * (i + j)) / 16000),
                  ),
                });
            }, 0);
          },
          disconnect: () => {},
        }),
        createSilentSink: () => ({ connect: () => {}, disconnect: () => {} }),
        close: () => Promise.resolve(),
      }),
      createWorkletNode: () =>
        Promise.resolve({ node: { connect: () => {}, disconnect: () => {} }, port }),
    };
  };

  it("shows how much of the speech model has downloaded, then clears it", async () => {
    let report: ((loaded: number, total: number) => void) | undefined;
    let finish: (() => void) | undefined;
    const c = new RecordingController();
    const started = c.start({
      sessionId: "progress",
      schema,
      ledger: consented(),
      source: {
        kind: "live",
        captureDeps: toneDeps(0.2),
        createAsr: (onProgress) => {
          report = onProgress;
          return {
            ...asr(),
            load: () =>
              new Promise((resolve) => {
                finish = () => resolve({ ok: true, value: undefined });
              }),
          };
        },
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(c.state.status).toBe("loading-model");
    report?.(12_000_000, 90_000_000);
    expect(c.state.progress).toEqual({ loaded: 12_000_000, total: 90_000_000 });
    finish?.();
    await started;
    expect(c.state.status).toBe("recording");
    expect(c.state.progress).toBeUndefined();
    await c.discard();
  });

  it("stops with a clear error when the speech engine keeps failing, instead of showing no captions", async () => {
    const c = new RecordingController();
    await c.start({
      sessionId: "failing",
      schema,
      ledger: consented(),
      source: {
        kind: "live",
        captureDeps: toneDeps(30, true),
        createAsr: () => ({
          ...asr(),
          transcribe: () => Promise.resolve({ ok: false, error: "out of memory" }),
        }),
      },
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(c.state.status).toBe("error");
    expect(c.state.error).toContain("out of memory");
    await c.discard();
  });

  it("keeps going when only one segment fails", async () => {
    let calls = 0;
    const c = new RecordingController();
    await c.start({
      sessionId: "one-bad",
      schema,
      ledger: consented(),
      source: {
        kind: "live",
        captureDeps: toneDeps(30),
        createAsr: () => ({
          ...asr(),
          transcribe: () =>
            Promise.resolve(
              ++calls === 1
                ? { ok: false as const, error: "hiccup" }
                : { ok: true as const, value: { text: "hello" } },
            ),
        }),
      },
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(c.state.status).toBe("recording");
    expect(c.state.lines.length).toBeGreaterThan(0);
    await c.discard();
  });
});
