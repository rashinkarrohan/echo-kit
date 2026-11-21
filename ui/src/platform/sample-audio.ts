/**
 * Loads a bundled actor recording for a sample consult and decodes it to 16 kHz mono,
 * the rate the session and player use. Same-origin static file only; cached offline by
 * the app's service worker. Browser-only (Web Audio).
 */

import { resample } from "@echo/engine";
import type { Result } from "@echo/engine";

export type LoadAudio = (url: string) => Promise<Result<Float32Array>>;

export const loadSampleAudio: LoadAudio = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, error: `Sample audio not found (${response.status})` };
    const bytes = await response.arrayBuffer();
    // An offline context decodes without needing a user gesture or an audio device.
    const context = new OfflineAudioContext(1, 1, 44100);
    const decoded = await context.decodeAudioData(bytes);
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
    }
    return { ok: true, value: resample(mono, decoded.sampleRate, 16000) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sample audio could not be read" };
  }
};
