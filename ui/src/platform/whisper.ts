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

/** What to prompt the speech engine with, per app. */
export interface SpeechVocabulary {
  /** Echo Care: the user's own medicines, put before the common medicine names */
  medicines?: readonly string[];
  /** Echo Cover: plain sales words, used instead of medicine names */
  words?: readonly string[];
}

/**
 * Whisper prompt options: plain words when the app gives them (Echo Cover), otherwise the
 * user's own medicines followed by the common list (Echo Care). `?prompt=0` turns it off.
 */
export function promptOptions(
  search: string,
  { medicines = [], words = [] }: SpeechVocabulary = {},
): Pick<WhisperOptions, "medicines" | "words"> {
  if (new URLSearchParams(search).get("prompt") === "0") return { medicines: [] };
  if (words.length > 0) return { words: [...words] };
  return { medicines: [...medicines, ...DRUG_DICTIONARY.drugs] };
}

/**
 * Create an on-device Whisper adapter running in a module worker, prompted as
 * `promptOptions` describes.
 */
export function createWhisperAdapter(
  options: WhisperOptions = {},
  vocabulary: SpeechVocabulary = {},
): WhisperAdapter {
  const worker = new Worker(new URL("./asr-worker.ts", import.meta.url), { type: "module" });
  const search = typeof location === "undefined" ? "" : location.search;
  return new WhisperAdapter(workerTransport(worker), {
    model: modelFromQuery(search),
    ...promptOptions(search, vocabulary),
    ...options,
  });
}
