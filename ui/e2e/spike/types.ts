/** Result the S16 spike page puts on `window.__spike` (read by Playwright, shown on the phone). */
export interface SpikeSegment {
  id: string;
  startMs: number;
  endMs: number;
  hasSpeech: boolean;
  text?: string;
  ms?: number;
  msPer5sAudio?: number;
  error?: string;
}

export interface SpikeResult {
  userAgent: string;
  model: string;
  device?: string;
  /** Silero VAD loaded in the speech worker */
  speechCheck?: boolean;
  crossOriginIsolated: boolean;
  clipSeconds?: number;
  loadMs?: number;
  segments: SpikeSegment[];
  text: string;
  /** `text` after the engine's normaliseText (numbers as digits), for checking */
  normalisedText: string;
  error?: string;
}
