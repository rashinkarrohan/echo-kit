/**
 * Web Worker that runs Whisper with transformers.js, on the device.
 * Protocol: see WorkerRequest / WorkerReply in @echo/engine (asr/whisper-adapter.ts).
 *
 * Tries WebGPU first and falls back to WebAssembly. Audio arrives as 16 kHz mono
 * samples and never leaves the device; the only network use is the one-time model
 * download from Hugging Face, which the browser caches.
 */

import { pipeline } from "@huggingface/transformers";
import type { AsrDevice, WorkerReply, WorkerRequest } from "@echo/engine";

/** The parts of the worker global scope used here (avoids mixing DOM and WebWorker libs). */
interface WorkerScope {
  postMessage(message: WorkerReply): void;
  onmessage: ((event: { data: WorkerRequest }) => void) | null;
  navigator?: { gpu?: unknown };
}

type Transcriber = (audio: Float32Array) => Promise<unknown>;

const scope = globalThis as unknown as WorkerScope;
let transcriber: Transcriber | undefined;

/** Precision per device. To be confirmed by the latency spike (docs/SPIKES.md). */
const DTYPES = {
  webgpu: { encoder_model: "fp32", decoder_model_merged: "q4" },
  wasm: "q8",
} as const;

function textOf(output: unknown): string {
  const first: unknown = Array.isArray(output) ? output[0] : output;
  if (typeof first === "object" && first !== null && "text" in first) {
    const text = (first as { text: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : "Speech engine error";
}

async function load(model: string, devices: AsrDevice[]): Promise<AsrDevice> {
  let lastError: unknown;
  for (const device of devices) {
    if (device === "webgpu" && !scope.navigator?.gpu) continue;
    try {
      const asr = await pipeline("automatic-speech-recognition", model, {
        device,
        dtype: DTYPES[device],
      });
      transcriber = (audio) => asr(audio);
      return device;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(
    lastError === undefined ? "No speech engine device is available" : message(lastError),
  );
}

scope.onmessage = (event) => {
  const req = event.data;
  void (async () => {
    try {
      if (req.type === "load") {
        const device = await load(req.model, req.devices);
        scope.postMessage({ type: "loaded", id: req.id, device });
        return;
      }
      if (!transcriber) {
        scope.postMessage({ type: "error", id: req.id, error: "Speech model is not loaded" });
        return;
      }
      const t0 = performance.now();
      const output = await transcriber(req.samples);
      scope.postMessage({
        type: "result",
        id: req.id,
        text: textOf(output),
        ms: Math.round(performance.now() - t0),
      });
    } catch (e) {
      scope.postMessage({ type: "error", id: req.id, error: message(e) });
    }
  })();
};
