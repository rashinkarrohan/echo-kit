/**
 * Browser wiring for the engine's WhisperAdapter: starts the speech worker and
 * connects it through the adapter's message transport.
 */

import { DRUG_DICTIONARY, WhisperAdapter } from "@echo/engine";
import { modelFromQuery } from "./whisper-models";
import type { AsrTransport, WhisperOptions, WorkerReply, WorkerRequest } from "@echo/engine";

/** The parts of a Worker the transport uses. */
export interface WorkerLike {
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerReply>) => void): void;
}

export function workerTransport(worker: WorkerLike): AsrTransport {
  return {
    post(request) {
      if (request.type === "transcribe") {
        // copy, then transfer the copy, so the caller keeps its samples for playback
        const samples = request.samples.slice();
        worker.postMessage({ ...request, samples }, [samples.buffer]);
      } else {
        worker.postMessage(request);
      }
    },
    onReply(listener) {
      worker.addEventListener("message", (event) => listener(event.data));
    },
  };
}

export { WHISPER_MODELS, modelFromQuery } from "./whisper-models";

/**
 * Create an on-device Whisper adapter running in a module worker. By default it prompts
 * Whisper with the most common medicine names; `?prompt=0` turns that off.
 */
export function createWhisperAdapter(options: WhisperOptions = {}): WhisperAdapter {
  const worker = new Worker(new URL("./asr-worker.ts", import.meta.url), { type: "module" });
  const search = typeof location === "undefined" ? "" : location.search;
  const promptOff = new URLSearchParams(search).get("prompt") === "0";
  return new WhisperAdapter(workerTransport(worker), {
    model: modelFromQuery(search),
    ...(promptOff ? { medicines: [] } : { medicines: [...DRUG_DICTIONARY.drugs] }),
    ...options,
  });
}
