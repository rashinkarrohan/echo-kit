/**
 * Speech check with Silero VAD (v5/v6, MIT): the pure parts. The ONNX session runs on the
 * platform side (ui/src/platform/asr-worker.ts); this file only frames the audio and
 * decides from the per-frame speech probabilities.
 *
 * Why: Whisper writes words on non-speech (a cough, a knock, a fan, a breath), and the
 * energy gate in segmenter.ts lets those through. On the owner's recordings plus
 * synthetic non-speech, the energy gate passed 11 non-speech segments and Silero 0,
 * with no speech segment held back by either (docs/SPIKES.md, Nov 21, 2026).
 */

/** Silero v5/v6 read 512 samples at 16 kHz per step (32 ms)... */
export const SILERO_FRAME = 512;
/** ...plus the last 64 samples of the previous frame as context. */
export const SILERO_CONTEXT = 64;

/** One model input per whole frame: 64 samples of context, then the 512-sample frame. */
export function sileroInputs(samples: Float32Array): Float32Array[] {
  const out: Float32Array[] = [];
  let context = new Float32Array(SILERO_CONTEXT);
  for (let i = 0; i + SILERO_FRAME <= samples.length; i += SILERO_FRAME) {
    const input = new Float32Array(SILERO_CONTEXT + SILERO_FRAME);
    input.set(context, 0);
    input.set(samples.subarray(i, i + SILERO_FRAME), SILERO_CONTEXT);
    context = samples.slice(i + SILERO_FRAME - SILERO_CONTEXT, i + SILERO_FRAME);
    out.push(input);
  }
  return out;
}

export interface SpeechFrameOptions {
  /** A frame is speech above this probability (Silero's usual 0.5) */
  threshold?: number;
  /** At least this many speech frames (5 x 32 ms = 160 ms) for the segment to have speech */
  minFrames?: number;
}

/** Does a segment contain speech, from Silero's per-frame probabilities? */
export function hasSpeechFrames(
  probs: readonly number[],
  { threshold = 0.5, minFrames = 5 }: SpeechFrameOptions = {},
): boolean {
  let speech = 0;
  for (const p of probs) if (p > threshold) speech++;
  return speech >= minFrames;
}
