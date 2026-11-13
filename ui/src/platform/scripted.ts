/**
 * Scripted consults (actors only) fed into a session as if they were being recorded.
 * Used by the sample mode and by browser tests. No microphone, no speech model.
 * Audio is silent here; the sample-consult mode with recorded audio is Step 23.
 */

import type { AudioSegment } from "@echo/engine";

export interface ScriptedConsult {
  id: string;
  segments: Array<{ id: string; startMs: number; endMs: number; text: string }>;
}

export function scriptedAudio(consult: ScriptedConsult, sampleRate = 16000): AudioSegment[] {
  return consult.segments.map((s, index) => ({
    id: s.id,
    index,
    startMs: s.startMs,
    endMs: s.endMs,
    samples: new Float32Array(Math.round(((s.endMs - s.startMs) / 1000) * sampleRate)),
    hasSpeech: true,
  }));
}

export function scriptedLines(consult: ScriptedConsult): string[] {
  return consult.segments.map((s) => s.text);
}

export interface ScriptPlayback {
  pause(): void;
  resume(): void;
  stop(): void;
  /** Resolves when every segment has been sent, or playback is stopped */
  readonly done: Promise<void>;
}

/** Send each segment when it would have finished being spoken, divided by `speed`. */
export function playScript(
  segments: AudioSegment[],
  onSegment: (segment: AudioSegment) => void,
  { speed = 1 }: { speed?: number } = {},
): ScriptPlayback {
  let next = 0;
  let elapsed = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startedAt = 0;
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));

  const schedule = (): void => {
    const segment = segments[next];
    if (!segment) {
      finish();
      return;
    }
    const wait = Math.max(0, segment.endMs / speed - elapsed);
    startedAt = Date.now();
    timer = setTimeout(() => {
      elapsed += Date.now() - startedAt;
      next += 1;
      onSegment(segment);
      schedule();
    }, wait);
  };

  schedule();
  return {
    done,
    pause() {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      elapsed += Date.now() - startedAt;
    },
    resume() {
      if (timer === undefined && next < segments.length) schedule();
    },
    stop() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      next = segments.length;
      finish();
    },
  };
}
