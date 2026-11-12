import { describe, it, expect } from "vitest";
import { MockAdapter } from "./mock-adapter";
import { WhisperAdapter, cleanWhisperText } from "./whisper-adapter";
import type { AsrTransport, WorkerReply, WorkerRequest } from "./whisper-adapter";

const silence = (ms: number) => new Float32Array((ms / 1000) * 16000);

describe("MockAdapter", () => {
  it("returns scripted text in order, one call per segment", async () => {
    const asr = new MockAdapter(["Take metformin twice daily.", "Come back in two weeks."]);
    expect(await asr.transcribe(silence(4000), 16000)).toEqual({
      ok: true,
      value: { text: "Take metformin twice daily." },
    });
    expect(await asr.transcribe(silence(4000), 16000)).toEqual({
      ok: true,
      value: { text: "Come back in two weeks." },
    });
  });

  it("returns an error when the script runs out (never invents text)", async () => {
    const asr = new MockAdapter(["one"]);
    await asr.transcribe(silence(3000), 16000);
    const r = await asr.transcribe(silence(3000), 16000);
    expect(r.ok).toBe(false);
  });

  it("passes word confidence through only when the script has it", async () => {
    const asr = new MockAdapter([
      {
        text: "fifty milligrams",
        words: [
          { word: "fifty", confidence: 0.4 },
          { word: "milligrams", confidence: 0.9 },
        ],
      },
    ]);
    const r = await asr.transcribe(silence(3000), 16000);
    expect(r.ok && r.value.words?.[0]).toEqual({ word: "fifty", confidence: 0.4 });
  });

  it("rejects audio that is not 16 kHz", async () => {
    const r = await new MockAdapter(["x"]).transcribe(silence(3000), 48000);
    expect(r.ok).toBe(false);
  });
});

describe("cleanWhisperText", () => {
  it("trims and collapses spaces", () => {
    expect(cleanWhisperText("  Take it   twice daily. ")).toBe("Take it twice daily.");
  });

  it("drops non-speech markers Whisper emits for silence or noise", () => {
    expect(cleanWhisperText(" [BLANK_AUDIO]")).toBe("");
    expect(cleanWhisperText("(music) Take it [inaudible] daily")).toBe("Take it daily");
  });
});

/** In-memory stand-in for the Web Worker, recording what the adapter sends. */
function fakeWorker(reply: (req: WorkerRequest) => WorkerReply | undefined) {
  const sent: WorkerRequest[] = [];
  let listener: ((r: WorkerReply) => void) | undefined;
  const transport: AsrTransport = {
    post(req) {
      sent.push(req);
      const r = reply(req);
      if (r) queueMicrotask(() => listener?.(r));
    },
    onReply(fn) {
      listener = fn;
    },
  };
  return { transport, sent };
}

describe("WhisperAdapter", () => {
  it("loads the model once, then transcribes each segment through the worker", async () => {
    const { transport, sent } = fakeWorker((req) =>
      req.type === "load"
        ? { type: "loaded", id: req.id, device: "wasm" }
        : { type: "result", id: req.id, text: " Metformin, five hundred milligrams. ", ms: 812 },
    );
    const asr = new WhisperAdapter(transport, { model: "Xenova/whisper-tiny.en" });
    const r1 = await asr.transcribe(silence(5000), 16000);
    const r2 = await asr.transcribe(silence(5000), 16000);
    expect(r1).toEqual({ ok: true, value: { text: "Metformin, five hundred milligrams." } });
    expect(r2.ok).toBe(true);
    expect(sent.filter((s) => s.type === "load")).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "load",
      model: "Xenova/whisper-tiny.en",
      devices: ["webgpu", "wasm"],
    });
    expect(asr.device).toBe("wasm");
    expect(asr.lastLatencyMs).toBe(812);
  });

  it("never claims word confidence (Whisper in transformers.js does not give it)", async () => {
    const { transport } = fakeWorker((req) =>
      req.type === "load"
        ? { type: "loaded", id: req.id, device: "webgpu" }
        : { type: "result", id: req.id, text: "hello", ms: 1 },
    );
    const r = await new WhisperAdapter(transport).transcribe(silence(3000), 16000);
    expect(r.ok && r.value.words).toBeUndefined();
  });

  it("returns load and transcription errors as Result values", async () => {
    const failLoad = fakeWorker((req) => ({
      type: "error",
      id: req.id,
      error: "model download failed",
    }));
    expect(await new WhisperAdapter(failLoad.transport).transcribe(silence(3000), 16000)).toEqual({
      ok: false,
      error: "model download failed",
    });

    const failRun = fakeWorker((req) =>
      req.type === "load"
        ? { type: "loaded", id: req.id, device: "wasm" }
        : { type: "error", id: req.id, error: "out of memory" },
    );
    expect(await new WhisperAdapter(failRun.transport).transcribe(silence(3000), 16000)).toEqual({
      ok: false,
      error: "out of memory",
    });
  });

  it("rejects audio that is not 16 kHz without calling the worker", async () => {
    const { transport, sent } = fakeWorker(() => undefined);
    const r = await new WhisperAdapter(transport).transcribe(silence(3000), 44100);
    expect(r.ok).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("matches replies to requests by id", async () => {
    let pending: WorkerRequest[] = [];
    let listener: ((r: WorkerReply) => void) | undefined;
    const transport: AsrTransport = {
      post(req) {
        if (req.type === "load")
          queueMicrotask(() => listener?.({ type: "loaded", id: req.id, device: "wasm" }));
        else pending.push(req);
      },
      onReply(fn) {
        listener = fn;
      },
    };
    const asr = new WhisperAdapter(transport);
    const a = asr.transcribe(silence(3000), 16000);
    const b = asr.transcribe(silence(3000), 16000);
    await new Promise((r) => setTimeout(r, 0));
    const [first, second] = pending;
    pending = [];
    listener?.({ type: "result", id: second.id, text: "second", ms: 1 });
    listener?.({ type: "result", id: first.id, text: "first", ms: 1 });
    expect(await a).toEqual({ ok: true, value: { text: "first" } });
    expect(await b).toEqual({ ok: true, value: { text: "second" } });
  });
});
