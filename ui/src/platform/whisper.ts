/**
 * Browser wiring for the engine's WhisperAdapter: starts the speech worker and
 * connects it through the adapter's message transport.
 */

import { DRUG_DICTIONARY, WhisperAdapter } from "@echo/engine";
import { devicesFor, isLargeModel, modelFromQuery } from "./whisper-models";
import { DEFAULT_WHISPER_MODEL } from "@echo/engine";
import type {
  AsrTransport,
  Result,
  WhisperOptions,
  WorkerReply,
  WorkerRequest,
} from "@echo/engine";

/** The parts of a Worker the transport uses. */
export interface WorkerLike {
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerReply>) => void): void;
  addEventListener(type: "error", listener: (event: { message?: string }) => void): void;
  addEventListener(type: "messageerror", listener: (event: unknown) => void): void;
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
    onFailure(listener) {
      // A worker that crashes (out of memory on a phone) or whose script cannot load never
      // replies; without these the screen would wait for it forever.
      worker.addEventListener("error", (event) =>
        listener(event.message ? event.message : "the worker could not start"),
      );
      worker.addEventListener("messageerror", () => listener("a message could not be read"));
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
 * The model to load. A large model (about 1 GB) is only used after the person agrees to the
 * download; otherwise the default small model is used.
 */
function chosenModel(search: string): string {
  const model = modelFromQuery(search);
  if (
    !isLargeModel(model) ||
    typeof window === "undefined" ||
    typeof window.confirm !== "function"
  ) {
    return model;
  }
  const agreed = window.confirm(
    "This speech model is a download of about 1 GB. Continue only on Wi-Fi. Press Cancel to use the smaller default model.",
  );
  return agreed ? model : DEFAULT_WHISPER_MODEL;
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
    model: chosenModel(search),
    devices: devicesFor(
      search,
      typeof navigator === "undefined" ? "" : navigator.userAgent,
      typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
    ),
    ...promptOptions(search, vocabulary),
    ...options,
  });
}

/**
 * "Get ready": download the speech model now (about 100 MB, on Wi-Fi at home) so the first visit
 * does not wait. Loads it in a worker exactly as a visit would, so the browser caches the same
 * files, then stops the worker to free its memory. Nothing is recorded and no microphone is used.
 */
export async function prepareSpeechModel(
  onProgress: (loadedBytes: number, totalBytes: number) => void,
): Promise<Result<void>> {
  if (typeof Worker === "undefined") {
    return { ok: false, error: "this browser cannot run the speech model" };
  }
  const search = typeof location === "undefined" ? "" : location.search;
  let worker: Worker | undefined;
  try {
    worker = new Worker(new URL("./asr-worker.ts", import.meta.url), { type: "module" });
    const adapter = new WhisperAdapter(workerTransport(worker), {
      model: chosenModel(search),
      devices: devicesFor(
        search,
        typeof navigator === "undefined" ? "" : navigator.userAgent,
        typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
      ),
      medicines: [],
      onProgress,
    });
    return await adapter.load();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    worker?.terminate();
  }
}

/** The speech model this page uses (for the "ready" flag). */
export function speechModelName(): string {
  return modelFromQuery(typeof location === "undefined" ? "" : location.search);
}
