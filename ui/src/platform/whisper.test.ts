import { describe, it, expect } from "vitest";
import type { WorkerReply, WorkerRequest } from "@echo/engine";
import { promptOptions, workerTransport } from "./whisper";
import type { WorkerLike } from "./whisper";

describe("promptOptions", () => {
  it("Echo Care: the user's own medicines first, then the common list", () => {
    const { medicines = [] } = promptOptions("", { medicines: ["Glimepiride", "co-codamol"] });
    expect(medicines.slice(0, 2)).toEqual(["Glimepiride", "co-codamol"]);
    expect(medicines).toContain("metformin");
  });
  it("Echo Cover: plain words instead of medicine names", () => {
    expect(promptOptions("", { words: ["pair", "commission"] })).toEqual({
      words: ["pair", "commission"],
    });
  });
  it("?prompt=0 turns every prompt off", () => {
    expect(promptOptions("?prompt=0", { medicines: ["glimepiride"] })).toEqual({ medicines: [] });
    expect(promptOptions("?prompt=0", { words: ["pair"] })).toEqual({ medicines: [] });
  });
});

describe("workerTransport", () => {
  it("transfers a copy of the samples so the caller keeps its audio", () => {
    const posted: Array<{ msg: WorkerRequest; transfer?: Transferable[] }> = [];
    const worker: WorkerLike = {
      postMessage: (msg, transfer) => posted.push({ msg, ...(transfer ? { transfer } : {}) }),
      addEventListener: () => {},
    };
    const samples = new Float32Array([0.1, 0.2, 0.3]);
    workerTransport(worker).post({ type: "transcribe", id: 1, samples });

    const sent = posted[0].msg as Extract<WorkerRequest, { type: "transcribe" }>;
    expect(sent.samples).not.toBe(samples);
    expect([...sent.samples]).toEqual([...samples]);
    expect(posted[0].transfer?.[0]).toBe(sent.samples.buffer);
    expect(samples.length).toBe(3);
  });

  it("passes load requests through unchanged and delivers replies", () => {
    let handler: ((e: MessageEvent<WorkerReply>) => void) | undefined;
    const posted: WorkerRequest[] = [];
    const worker: WorkerLike = {
      postMessage: (msg) => posted.push(msg),
      addEventListener: (_t, l) => {
        handler = l;
      },
    };
    const replies: WorkerReply[] = [];
    const t = workerTransport(worker);
    t.onReply((r) => replies.push(r));
    t.post({ type: "load", id: 1, model: "m", devices: ["wasm"] });
    handler?.({ data: { type: "loaded", id: 1, device: "wasm" } } as MessageEvent<WorkerReply>);
    expect(posted[0]).toEqual({ type: "load", id: 1, model: "m", devices: ["wasm"] });
    expect(replies).toEqual([{ type: "loaded", id: 1, device: "wasm" }]);
  });
});
