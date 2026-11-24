/**
 * Which Whisper models the apps can use, and how each one is loaded (docs/SPIKES.md).
 * Kept apart from the worker so the choices can be unit-tested.
 */

import { DEFAULT_WHISPER_MODEL } from "@echo/engine";
import type { AsrDevice } from "@echo/engine";

/**
 * Speech models to choose from with `?model=tiny|base|small|turbo`.
 * turbo is the most accurate on medicine names (46/48 found on the bench, unprompted, 8-bit)
 * but is a large download (about 1 GB) and several seconds per segment on a laptop CPU.
 */
export const WHISPER_MODELS = {
  tiny: "Xenova/whisper-tiny.en",
  base: "Xenova/whisper-base.en",
  small: "Xenova/whisper-small.en",
  turbo: "onnx-community/whisper-large-v3-turbo",
} as const;

export type WhisperModelName = keyof typeof WHISPER_MODELS;

function isModelName(name: string): name is WhisperModelName {
  return Object.prototype.hasOwnProperty.call(WHISPER_MODELS, name);
}

/** Model named in the page address, or the default. */
export function modelFromQuery(search: string): string {
  const name = new URLSearchParams(search).get("model");
  return name !== null && isModelName(name) ? WHISPER_MODELS[name] : DEFAULT_WHISPER_MODEL;
}

/** English-only models end in ".en"; multilingual ones need language and task tokens. */
export function isMultilingual(model: string): boolean {
  return !/\.en$/i.test(model);
}

/**
 * Whisper's medicine-name prompt helps the small English models. turbo repeats the prompt
 * back on real speech ("Medicines, metformin, ... diapos, diapos, ..."), and without it
 * turbo already found 46/48 names on the bench, so turbo runs unprompted.
 */
export function usesMedicinePrompt(model: string): boolean {
  return !/large/i.test(model);
}

/**
 * Precision per device. Large models use 8-bit weights (about 1 GB): 4-bit heard the actor
 * clip's "metformin" as "merifoamin". 8-bit on WebGPU is not measured yet (docs/SPIKES.md).
 */
export function dtypeFor(model: string, device: AsrDevice): ModelDtype {
  if (/large/i.test(model)) return "q8";
  return device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8";
}

/** Weight precision, for the whole model or per part. */
export type ModelDtype = "q4" | "q8" | { encoder_model: "fp32"; decoder_model_merged: "q4" };

/**
 * Which devices to try, in order. Phones and tablets use WebAssembly only: WebGPU on a phone
 * is not measured (docs/SPIKES.md), and a WebGPU model that loads but fails while transcribing
 * left the screen with no captions. `?device=webgpu` or `?device=wasm` overrides, for testing.
 */
export function devicesFor(search: string, userAgent: string, maxTouchPoints: number): AsrDevice[] {
  const asked = new URLSearchParams(search).get("device");
  if (asked === "webgpu") return ["webgpu", "wasm"];
  if (asked === "wasm") return ["wasm"];
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  const phone =
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return phone || asked !== null ? ["wasm"] : ["webgpu", "wasm"];
}
