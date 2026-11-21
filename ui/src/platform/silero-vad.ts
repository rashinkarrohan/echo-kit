/**
 * Silero VAD v6 (MIT, Silero Team; model file in ./models with its licence) for the speech
 * worker: is there speech in this segment at all? Segments without speech are not sent to
 * Whisper, which otherwise writes words on coughs, knocks, fans and breaths.
 *
 * The runtime is injected (onnxruntime-web in the worker, a fake in tests). Framing and the
 * decision come from the engine (engine/src/audio/vad.ts).
 */
import { hasSpeechFrames, sileroInputs } from "@echo/engine";

export interface VadTensor {
  type: string;
  data: Float32Array | BigInt64Array;
  dims: readonly number[];
}

/** The parts of onnxruntime-web used here. */
export interface VadRuntime {
  tensor(type: "float32" | "int64", data: Float32Array | BigInt64Array, dims: number[]): VadTensor;
  run(feeds: Record<string, VadTensor>): Promise<Record<string, VadTensor>>;
}

export class SileroVad {
  constructor(private readonly runtime: VadRuntime) {}

  /** Speech probabilities for each 32 ms frame of a 16 kHz segment (fresh state per segment). */
  async probabilities(samples: Float32Array): Promise<number[]> {
    const sr = this.runtime.tensor("int64", BigInt64Array.from([16000n]), [1]);
    let state = this.runtime.tensor("float32", new Float32Array(2 * 128), [2, 1, 128]);
    const probs: number[] = [];
    for (const input of sileroInputs(samples)) {
      const out = await this.runtime.run({
        input: this.runtime.tensor("float32", input, [1, input.length]),
        state,
        sr,
      });
      probs.push(Number((out["output"].data as Float32Array)[0]));
      state = out["stateN"];
    }
    return probs;
  }

  async hasSpeech(samples: Float32Array): Promise<boolean> {
    return hasSpeechFrames(await this.probabilities(samples));
  }
}
