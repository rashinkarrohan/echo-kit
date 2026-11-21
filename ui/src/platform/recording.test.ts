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
});
