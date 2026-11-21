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
import { buildMedicinePrompt, buildWordsPrompt } from "@echo/engine";
import type { AsrDevice, WorkerReply, WorkerRequest } from "@echo/engine";
import { dtypeFor, isMultilingual, usesMedicinePrompt } from "./whisper-models";

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

type Transcriber = (audio: Float32Array) => Promise<string>;
let transcriber: Transcriber | undefined;

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
  const processor = await AutoProcessor.from_pretrained(model);
  const tokenizer = await AutoTokenizer.from_pretrained(model);
  const whisper = await WhisperForConditionalGeneration.from_pretrained(model, {
    device,
    dtype: dtypeFor(model, device),
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

  return async (audio) => {
    const { input_features } = (await processor(audio)) as { input_features: Tensor };
    const out = (await whisper.generate({
      inputs: input_features,
      decoder_input_ids: init,
      max_new_tokens: 120,
    })) as Tensor;
    const ids = (out.tolist() as Array<Array<number | bigint>>)[0].map(Number).slice(init.length);
    return tokenizer.decode(ids, { skip_special_tokens: true });
  };
}

async function load(model: string, devices: AsrDevice[], prompt: PromptSource): Promise<AsrDevice> {
  let lastError: unknown;
  for (const device of devices) {
    if (device === "webgpu" && !(await hasWebGpuAdapter())) continue;
    try {
      transcriber = await loadOn(model, device, prompt);
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
        const device = await load(req.model, req.devices, {
          medicines: req.medicines ?? [],
          words: req.words ?? [],
        });
        scope.postMessage({ type: "loaded", id: req.id, device });
        return;
      }
      if (!transcriber) {
        scope.postMessage({ type: "error", id: req.id, error: "Speech model is not loaded" });
        return;
      }
      const t0 = performance.now();
      const text = await transcriber(req.samples);
      scope.postMessage({
        type: "result",
        id: req.id,
        text,
        ms: Math.round(performance.now() - t0),
      });
    } catch (e) {
      scope.postMessage({ type: "error", id: req.id, error: message(e) });
    }
  })();
};
