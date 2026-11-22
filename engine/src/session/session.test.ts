import { describe, it, expect } from "vitest";
import { ConversationSession } from "./session";
import type { SessionEvents } from "./session";
import { MockAdapter } from "../asr/mock-adapter";
import { ConsentLedger, ConsentRequiredError, CONSENT_WORDING_VERSION } from "../consent/ledger";
import { MemoryStore } from "../store/store";
import { runPipeline } from "../pipeline";
import type { AudioSegment } from "../audio/segmenter";
import type { AsrAdapter, AsrTranscript, ConversationSchema, Result, Segment } from "../types";

const schema: ConversationSchema = {
  id: "doctor-visit",
  skin: "care",
  detectors: ["number", "drug", "frequency", "date"],
  disclaimer:
    "Echo records and summarises what was said. It is not medical advice and not an interpreter.",
  facts: [
    {
      key: "medicine",
      fields: ["name", "dose", "frequency", "duration"],
      cues: { anchor: "@drug", windowWords: 25 },
    },
    {
      key: "follow_up",
      fields: ["when", "what"],
      cues: { any: ["come back", "see me"], windowWords: 15 },
    },
  ],
  checklist: [
    {
      id: "q-how-to-take",
      text: "How much and how often?",
      sourceUrl: "user-planned",
      cues: { all: [["@number"], ["@frequency"]] },
    },
    {
      id: "q-side-effects",
      text: "Side effects?",
      sourceUrl: "user-planned",
      cues: { any: ["side effect"] },
    },
  ],
  nextSteps: [{ label: "Ask your doctor to confirm anything marked Check this" }],
};

const lines = [
  "Good morning, please sit down.",
  "I want to start you on metformin, five hundred milligrams, twice daily after food.",
  "Take it for three months.",
  "Please come back and see me in three months.",
];

function audio(i: number, hasSpeech = true): AudioSegment {
  return {
    id: `seg-${String(i + 1).padStart(4, "0")}`,
    index: i,
    startMs: i * 5000,
    endMs: (i + 1) * 5000,
    samples: new Float32Array(80000).fill(i / 10),
    hasSpeech,
  };
}

function consented(...purposes: Array<"record" | "transcribe">) {
  const ledger = new ConsentLedger();
  for (const p of purposes) ledger.grant(p, CONSENT_WORDING_VERSION);
  return ledger;
}

function session(overrides: Partial<ConstructorParameters<typeof ConversationSession>[0]> = {}) {
  const store = new MemoryStore();
  const s = new ConversationSession({
    id: "visit-1",
    schema,
    asr: new MockAdapter(lines),
    ledger: consented("record", "transcribe"),
    store,
    now: () => 1000,
    ...overrides,
  });
  return { s, store };
}

function record<K extends keyof SessionEvents>(
  s: ConversationSession,
  event: K,
): Array<SessionEvents[K]> {
  const out: Array<SessionEvents[K]> = [];
  s.on(event, (p) => out.push(p));
  return out;
}

describe("ConversationSession consent (PB10)", () => {
  it("start throws without record consent", () => {
    const { s } = session({ ledger: consented("transcribe") });
    expect(() => s.start()).toThrow(ConsentRequiredError);
  });

  it("start throws without transcribe consent", () => {
    const { s } = session({ ledger: consented("record") });
    expect(() => s.start()).toThrow(ConsentRequiredError);
  });

  it("audio arriving after consent is withdrawn is dropped, not transcribed", async () => {
    const ledger = consented("record", "transcribe");
    const { s } = session({ ledger });
    const errors = record(s, "error");
    s.start();
    await ledger.withdraw("record");
    const r = await s.addAudio(audio(0));
    expect(r.ok).toBe(false);
    expect(errors.map((e) => e.code)).toEqual(["consent-withdrawn"]);
    expect(s.transcript()).toEqual([]);
  });

  it("audio before start is refused", async () => {
    const { s } = session();
    expect((await s.addAudio(audio(0))).ok).toBe(false);
  });
});

describe("ConversationSession events", () => {
  it("emits a caption, then flags, for each segment in order", async () => {
    const { s } = session();
    const events: string[] = [];
    s.on("caption", (c) => events.push(`caption ${c.segment.id}`));
    s.on("flags", (f) =>
      events.push(
        `flags ${f.segmentId} ${f.tokens
          .map((t) => t.kind)
          .sort()
          .join(",")}`,
      ),
    );
    s.start();
    for (let i = 0; i < 2; i++) await s.addAudio(audio(i));
    expect(events).toEqual([
      "caption seg-0001",
      "flags seg-0001 ",
      "caption seg-0002",
      "flags seg-0002 drug,frequency,frequency,number",
    ]);
  });

  it("raises a Please-repeat prompt when a dose is heard without a medicine name", async () => {
    const asr = new MockAdapter([
      "Your sugar is a bit high.",
      "Take five hundred milligrams twice daily.",
    ]);
    const { s } = session({ asr });
    const prompts = record(s, "prompt");
    s.start();
    await s.addAudio(audio(0));
    await s.addAudio(audio(1));
    expect(prompts).toEqual([{ kind: "missing-medicine-name", segmentId: "seg-0002" }]);
  });

  it("raises a prompt for a medicine name that only sounds like a known one", async () => {
    const { s } = session({ asr: new MockAdapter(["Take meriforming 500 milligrams."]) });
    const prompts = record(s, "prompt");
    s.start();
    await s.addAudio(audio(0));
    expect(prompts).toEqual([
      {
        kind: "unclear-medicine-name",
        segmentId: "seg-0001",
        heard: "meriforming",
        suggestion: "metformin",
      },
    ]);
  });

  it("uses the user's own medicines list for captions, prompts and the receipt", async () => {
    const heard = ["Keep taking the blamepiride, two milligrams with breakfast."];
    const without = session({ asr: new MockAdapter(heard) }).s;
    const withList = session({ asr: new MockAdapter(heard), medicines: ["Glimepiride"] }).s;
    const flags = record(withList, "flags");
    const prompts = record(withList, "prompt");
    for (const s of [without, withList]) {
      s.start();
      await s.addAudio(audio(0));
    }
    expect(flags[0].tokens.find((t) => t.kind === "drug")).toMatchObject({
      value: "blamepiride",
      suggestion: "glimepiride",
    });
    expect(prompts).toEqual([
      {
        kind: "unclear-medicine-name",
        segmentId: "seg-0001",
        heard: "blamepiride",
        suggestion: "glimepiride",
      },
    ]);
    const a = await without.stop();
    const b = await withList.stop();
    if (!a.ok || !b.ok) throw new Error("no receipt");
    const medicine = (r: typeof b.value) => r.facts.find((f) => f.key === "medicine");
    // The heard word is kept and the line is Check this: the list never confirms a name.
    expect(medicine(b.value)).toMatchObject({
      fields: { name: "blamepiride", dose: "2 milligrams" },
      stamp: "check_this",
    });
    expect(medicine(a.value)?.fields["name"]).toBe("blamepiride");
  });

  it("a medicine name only the prompted hearing wrote is Check this, in captions and the receipt", async () => {
    const asr = new MockAdapter([
      {
        text: "Do you use antihistamines like acetaminophen, ten milligrams?",
        unconfirmed: ["acetaminophen"],
      },
    ]);
    const { s } = session({ asr });
    const flags = record(s, "flags");
    const prompts = record(s, "prompt");
    s.start();
    await s.addAudio(audio(0));
    expect(flags[0].tokens.find((t) => t.kind === "drug")).toMatchObject({
      value: "acetaminophen",
      unconfirmed: true,
    });
    expect(prompts).toEqual([
      { kind: "unconfirmed-medicine-name", segmentId: "seg-0001", heard: "acetaminophen" },
    ]);
    const r = await s.stop();
    if (!r.ok) throw new Error(r.error);
    expect(r.value.facts.find((f) => f.key === "medicine")).toMatchObject({
      fields: { name: "acetaminophen" },
      stamp: "check_this",
      checkReason: "unconfirmed-name",
    });
    expect(s.transcript()[0].unconfirmedNames).toEqual(["acetaminophen"]);
  });

  it("raises no medicine prompts for a schema without the drug detector", async () => {
    const cover: ConversationSchema = {
      ...schema,
      id: "sale",
      skin: "cover",
      detectors: ["money", "number"],
    };
    const { s } = session({ schema: cover, asr: new MockAdapter(["It is 500 mg of something."]) });
    const prompts = record(s, "prompt");
    s.start();
    await s.addAudio(audio(0));
    expect(prompts).toEqual([]);
  });

  it("keeps segment order even when the speech engine answers out of order", async () => {
    const slowFirst: AsrAdapter = {
      id: "slow-first",
      transcribe(samples): Promise<Result<AsrTranscript>> {
        const first = samples[0] === 0;
        return new Promise((resolve) =>
          setTimeout(
            () => resolve({ ok: true, value: { text: first ? "first" : "second" } }),
            first ? 30 : 1,
          ),
        );
      },
    };
    const { s } = session({ asr: slowFirst });
    const captions = record(s, "caption");
    s.start();
    const a = s.addAudio(audio(0));
    const b = s.addAudio(audio(1));
    await Promise.all([a, b]);
    expect(captions.map((c) => c.segment.text)).toEqual(["first", "second"]);
  });

  it("does not send silent segments to the speech engine", async () => {
    const { s } = session({ asr: new MockAdapter(["only line"]) });
    s.start();
    await s.addAudio(audio(0, false));
    await s.addAudio(audio(1));
    expect(s.transcript().map((t) => t.text)).toEqual(["", "only line"]);
  });

  it("a failed transcription is reported, keeps its place in the timeline, and never gets made-up text", async () => {
    const { s } = session({ asr: new MockAdapter([]) });
    const errors = record(s, "error");
    s.start();
    await s.addAudio(audio(0));
    expect(errors).toEqual([
      expect.objectContaining({ code: "transcription-failed", segmentId: "seg-0001" }),
    ]);
    expect(s.transcript()).toEqual([
      { id: "seg-0001", index: 0, startMs: 0, endMs: 5000, text: "" },
    ]);
  });

  it("refuses audio that overlaps the previous segment", async () => {
    const { s } = session();
    s.start();
    await s.addAudio(audio(1));
    expect((await s.addAudio(audio(0))).ok).toBe(false);
  });
});

describe("ConversationSession receipt", () => {
  async function full() {
    const ctx = session();
    const receipts = record(ctx.s, "receipt");
    ctx.s.start();
    for (let i = 0; i < lines.length; i++) await ctx.s.addAudio(audio(i));
    const result = await ctx.s.stop();
    return { ...ctx, receipts, result };
  }

  it("produces the same facts and checklist as the shared pipeline (the eval harness path)", async () => {
    const { result } = await full();
    const segments: Segment[] = lines.map((text, i) => ({
      id: audio(i).id,
      index: i,
      startMs: i * 5000,
      endMs: (i + 1) * 5000,
      text,
    }));
    const expected = runPipeline(segments, schema);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.facts).toEqual(expected.facts);
    expect(result.value.checklist).toEqual(expected.checklist);
    expect(result.value.facts.map((f) => f.key)).toEqual(["medicine", "follow_up"]);
  });

  it("fills the receipt from the schema and builds read-back for medicines", async () => {
    const { result } = await full();
    if (!result.ok) throw new Error(result.error);
    expect(result.value).toMatchObject({
      conversationId: "visit-1",
      schemaId: "doctor-visit",
      timestamp: 1000,
      disclaimer: schema.disclaimer,
      nextSteps: schema.nextSteps,
      labelFlags: [],
    });
    expect(result.value.readBack.map((r) => r.heard)).toEqual([
      "metformin, 500 milligrams, twice daily, 3 months",
    ]);
    expect(result.value.readBack[0].mark).toBe("unmarked");
  });

  it("stores the transcript and receipt on the device, but not audio by default", async () => {
    const { store } = await full();
    expect(await store.getReceipt("visit-1")).toMatchObject({
      ok: true,
      value: { conversationId: "visit-1" },
    });
    expect(await store.getSession("visit-1")).toMatchObject({
      ok: true,
      value: { id: "visit-1", segments: { length: 4 } },
    });
    expect(await store.getAudio("visit-1")).toEqual({ ok: true, value: [] });
  });

  it("stores audio only when the user opted in", async () => {
    const { s, store } = session({ keepAudio: true });
    s.start();
    await s.addAudio(audio(0));
    await s.stop();
    const stored = await store.getAudio("visit-1");
    expect(stored.ok && stored.value.length).toBe(1);
  });

  it("keeps audio in memory for 'Hear it' playback", async () => {
    const { s } = await full();
    const clips = s.audioFor(["seg-0002", "seg-0003"]);
    expect(clips.map((c) => c.length)).toEqual([80000, 80000]);
  });

  it("emits the receipt once; stopping again returns the same receipt", async () => {
    const { s, receipts, result } = await full();
    const again = await s.stop();
    expect(receipts).toHaveLength(1);
    expect(again).toEqual(result);
  });

  it("waits for segments still being transcribed before building the receipt", async () => {
    const { s } = session();
    s.start();
    for (let i = 0; i < lines.length; i++) void s.addAudio(audio(i));
    const result = await s.stop();
    expect(result.ok && result.value.facts.map((f) => f.key)).toEqual(["medicine", "follow_up"]);
  });

  it("refuses audio after stop", async () => {
    const { s } = await full();
    expect((await s.addAudio(audio(9))).ok).toBe(false);
  });

  it("passes word confidence through to the transcript only when the engine gives it", async () => {
    const asr = new MockAdapter([
      { text: "metformin twice daily", words: [{ word: "metformin", confidence: 0.4 }] },
    ]);
    const { s } = session({ asr });
    s.start();
    await s.addAudio(audio(0));
    expect(s.transcript()[0].words).toEqual([{ word: "metformin", confidence: 0.4 }]);
  });
});
