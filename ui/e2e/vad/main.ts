/**
 * Test page for the speech check: loads Silero VAD with onnxruntime-web in the browser,
 * exactly as the speech worker does, and exposes it to Playwright (tests/vad.spec.ts).
 */
import * as ort from "onnxruntime-web/webgpu";
import { SileroVad } from "../../src/platform/silero-vad";
import type { VadTensor } from "../../src/platform/silero-vad";

declare global {
  interface Window {
    vadHasSpeech?: (samples: number[]) => Promise<boolean>;
  }
}

const MODEL = new URL("../../src/platform/models/silero-vad-v6.onnx", import.meta.url);

async function main(): Promise<void> {
  const bytes = new Uint8Array(await (await fetch(MODEL)).arrayBuffer());
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  const vad = new SileroVad({
    tensor: (type, data, dims) => new ort.Tensor(type, data, dims) as unknown as VadTensor,
    run: async (feeds) =>
      (await session.run(feeds as unknown as ort.InferenceSession.FeedsType)) as unknown as Record<
        string,
        VadTensor
      >,
  });
  window.vadHasSpeech = (samples) => vad.hasSpeech(Float32Array.from(samples));
  const status = document.getElementById("status");
  if (status) status.textContent = "Ready.";
}

void main();
