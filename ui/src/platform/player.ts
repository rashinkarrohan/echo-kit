/**
 * Plays audio held in memory on the device (for "Hear it" and "Slower").
 * Uses an <audio> element with a WAV blob, which keeps pitch when slowed.
 */

import { encodeWav } from "@echo/engine";
import type { Result } from "@echo/engine";

export interface Player {
  play(chunks: Float32Array[], sampleRate: number, rate: number): Promise<Result<void>>;
  stop(): void;
}

export function joinChunks(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export function createPlayer(): Player {
  let audio: HTMLAudioElement | undefined;
  let url: string | undefined;
  const stop = (): void => {
    audio?.pause();
    if (url) URL.revokeObjectURL(url);
    audio = undefined;
    url = undefined;
  };
  return {
    stop,
    async play(chunks, sampleRate, rate) {
      stop();
      const samples = joinChunks(chunks);
      if (samples.length === 0) return { ok: false, error: "No audio for this part" };
      url = URL.createObjectURL(new Blob([encodeWav(samples, sampleRate)], { type: "audio/wav" }));
      audio = new Audio(url);
      audio.playbackRate = rate;
      try {
        await audio.play();
        return { ok: true, value: undefined };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Audio could not play" };
      }
    },
  };
}
