/**
 * Web Worker that runs Whisper with transformers.js, on the device.
 * Protocol: see WorkerRequest / WorkerReply in @echo/engine (asr/whisper-adapter.ts).
 *
 * Tries WebGPU first and falls back to WebAssembly. Audio arrives as 16 kHz mono
 * samples and never leaves the device; the only network use is the one-time model
 * download from Hugging Face, which the browser caches.
 *
 * Prompt: when the load request carries `medicines` (Echo Care) or plain `words` (Echo
 * Cover), they are given to Whisper as a text prompt ("previous text"), which makes it
 * more likely to spell them right. The prompt is removed from the output; only what was
 * heard is returned.
 */

import {
  AutoProcessor,
  AutoTokenizer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";
import type { Tensor } from "@huggingface/transformers";
// The same onnxruntime-web build transformers.js loads (one runtime, one set of wasm files).
import * as ort from "onnxruntime-web/webgpu";
import {
  buildMedicinePrompt,
  buildWordsPrompt,
  exactMedicineNames,
  promptOnlyNames,
} from "@echo/engine";
import type { AsrDevice, WorkerReply, WorkerRequest } from "@echo/engine";
import { dtypeFor, isMultilingual, usesMedicinePrompt } from "./whisper-models";
import { DownloadProgress } from "./download-progress";
import type { DownloadEvent } from "./download-progress";
import { SileroVad } from "./silero-vad";
import type { VadTensor } from "./silero-vad";

/** The parts of the worker global scope used here (avoids mixing DOM and WebWorker libs). */
interface WorkerScope {
  postMessage(message: WorkerReply): void;
  onmessage: ((event: { data: WorkerRequest }) => void) | null;
  navigator?: { gpu?: { requestAdapter(): Promise<unknown> } };
}

const scope = globalThis as unknown as WorkerScope;

/**
 * `navigator.gpu` can exist with no usable adapter (headless browsers, many phones).
 * Ask for an adapter first, so we never download WebGPU weights we cannot run.
 */
async function hasWebGpuAdapter(): Promise<boolean> {
  try {
    const adapter = await scope.navigator?.gpu?.requestAdapter();
    return adapter !== null && adapter !== undefined;
  } catch {
    return false;
  }
}

/** Download progress for the load in flight, sent to the page at most every 250 ms. */
let downloads = new DownloadProgress();
let loadId = 0;
let lastProgressAt = 0;
function reportProgress(event: DownloadEvent): void {
  downloads.update(event);
  const now = Date.now();
  if (event.status !== "done" && now - lastProgressAt < 250) return;
  lastProgressAt = now;
  const { loaded, total } = downloads.totals();
  if (total > 0) scope.postMessage({ type: "progress", id: loadId, loaded, total });
}
const progress_callback = (event: unknown): void => reportProgress(event as DownloadEvent);

type Transcriber = (audio: Float32Array) => Promise<{ text: string; unconfirmed?: string[] }>;
let transcriber: Transcriber | undefined;

/** Silero VAD (about 2 MB, cached with the speech runtime). Without it, every segment the
 *  energy gate passes goes to Whisper, as before. */
let vad: SileroVad | undefined;
const VAD_MODEL = new URL("./models/silero-vad-v6.onnx", import.meta.url);

async function loadVad(): Promise<void> {
  if (vad) return;
  try {
    const bytes = new Uint8Array(await (await fetch(VAD_MODEL)).arrayBuffer());
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
    vad = new SileroVad({
      tensor: (type, data, dims) => new ort.Tensor(type, data, dims) as unknown as VadTensor,
      run: async (feeds) =>
        (await session.run(
          feeds as unknown as ort.InferenceSession.FeedsType,
        )) as unknown as Record<string, VadTensor>,
    });
  } catch {
    vad = undefined; // fall back to the energy gate alone
  }
}

function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : "Speech engine error";
}

interface PromptSource {
  medicines: string[];
  words: string[];
}

async function loadOn(
  model: string,
  device: AsrDevice,
  { medicines, words }: PromptSource,
): Promise<Transcriber> {
  const processor = await AutoProcessor.from_pretrained(model, { progress_callback });
  const tokenizer = await AutoTokenizer.from_pretrained(model, { progress_callback });
  const whisper = await WhisperForConditionalGeneration.from_pretrained(model, {
    device,
    dtype: dtypeFor(model, device),
    progress_callback,
  });

  const token = (t: string): number => tokenizer.convert_tokens_to_ids(t);
  const count = (s: string): number => tokenizer.encode(s, { add_special_tokens: false }).length;
  const prompt = !usesMedicinePrompt(model)
    ? ""
    : words.length > 0
      ? buildWordsPrompt(words, count)
      : buildMedicinePrompt(medicines, count);
  const language = isMultilingual(model) ? [token("<|en|>"), token("<|transcribe|>")] : [];
  const start = [token("<|startoftranscript|>"), ...language, token("<|notimestamps|>")];
  const init =
    prompt.length > 0
      ? [
          token("<|startofprev|>"),
          ...tokenizer.encode(prompt, { add_special_tokens: false }),
          ...start,
        ]
      : start;

  const decode = async (features: Tensor, ids0: number[]): Promise<string> => {
    const out = (await whisper.generate({
      inputs: features,
      decoder_input_ids: ids0,
      max_new_tokens: 120,
    })) as Tensor;
    const ids = (out.tolist() as Array<Array<number | bigint>>)[0].map(Number).slice(ids0.length);
    return tokenizer.decode(ids, { skip_special_tokens: true });
  };
  const medicinePrompt = prompt.length > 0 && words.length === 0;

  return async (audio) => {
    const { input_features } = (await processor(audio)) as { input_features: Tensor };
    const text = await decode(input_features, init);
    // Second hearing, only when the medicine prompt was used and an exact name was written:
    // the same audio without the prompt must back each name up (engine/src/guard/confirm.ts).
    if (!medicinePrompt || exactMedicineNames(text).length === 0) return { text };
    const unprompted = await decode(input_features, start);
    const unconfirmed = promptOnlyNames(text, unprompted);
    return unconfirmed.length > 0 ? { text, unconfirmed } : { text };
  };
}

/** What the current engine was loaded with, so a WebGPU failure can reload on WebAssembly. */
let loaded:
  | { model: string; devices: AsrDevice[]; prompt: PromptSource; device: AsrDevice }
  | undefined;

async function load(model: string, devices: AsrDevice[], prompt: PromptSource): Promise<AsrDevice> {
  let lastError: unknown;
  for (const device of devices) {
    if (device === "webgpu" && !(await hasWebGpuAdapter())) continue;
    try {
      transcriber = await loadOn(model, device, prompt);
      loaded = { model, devices, prompt, device };
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

/**
 * A WebGPU model can load and then fail while transcribing (drivers, memory). Reload on
 * WebAssembly once and try the same audio again, instead of failing every segment.
 */
async function transcribeWithFallback(
  audio: Float32Array,
): Promise<{ text: string; unconfirmed?: string[] }> {
  try {
    return await (transcriber as Transcriber)(audio);
  } catch (e) {
    const current = loaded;
    if (!current || current.device !== "webgpu" || !current.devices.includes("wasm")) throw e;
    transcriber = await loadOn(current.model, "wasm", current.prompt);
    loaded = { ...current, device: "wasm", devices: ["wasm"] };
    return await transcriber(audio);
  }
}

scope.onmessage = (event) => {
  const req = event.data;
  void (async () => {
    try {
      if (req.type === "load") {
        downloads = new DownloadProgress();
        loadId = req.id;
        lastProgressAt = 0;
        const [device] = await Promise.all([
          load(req.model, req.devices, {
            medicines: req.medicines ?? [],
            words: req.words ?? [],
          }),
          loadVad(),
        ]);
        scope.postMessage({ type: "loaded", id: req.id, device, speechCheck: vad !== undefined });
        return;
      }
      if (!transcriber) {
        scope.postMessage({ type: "error", id: req.id, error: "Speech model is not loaded" });
        return;
      }
      const t0 = performance.now();
      // No speech (a cough, a knock, a fan): Whisper is not asked, so it cannot invent words.
      if (vad && !(await vad.hasSpeech(req.samples))) {
        scope.postMessage({
          type: "result",
          id: req.id,
          text: "",
          ms: Math.round(performance.now() - t0),
          noSpeech: true,
        });
        return;
      }
      const { text, unconfirmed } = await transcribeWithFallback(req.samples);
      scope.postMessage({
        type: "result",
        id: req.id,
        text,
        ms: Math.round(performance.now() - t0),
        ...(unconfirmed ? { unconfirmed } : {}),
      });
    } catch (e) {
      scope.postMessage({ type: "error", id: req.id, error: message(e) });
    }
  })();
};
