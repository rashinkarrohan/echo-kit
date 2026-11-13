/**
 * Decode a 16-bit PCM mono WAV into floats in [-1, 1). Pure: works on bytes from a
 * file (Node) or a fetch (browser). Other formats are an error, not a guess.
 */

import type { Result } from "../types";

export interface DecodedWav {
  sampleRate: number;
  samples: Float32Array;
}

export function decodeWav(buffer: ArrayBuffer): Result<DecodedWav> {
  const view = new DataView(buffer);
  const tag = (at: number) =>
    at + 4 <= view.byteLength
      ? String.fromCharCode(
          view.getUint8(at),
          view.getUint8(at + 1),
          view.getUint8(at + 2),
          view.getUint8(at + 3),
        )
      : "";
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return { ok: false, error: "Not a WAV file" };

  let offset = 12;
  let format: { channels: number; rate: number; bits: number; code: number } | undefined;
  while (offset + 8 <= view.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      let code = view.getUint16(body, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the first 2 bytes of the subformat GUID
      if (code === 0xfffe && size >= 40) code = view.getUint16(body + 24, true);
      format = {
        code,
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      if (!format) return { ok: false, error: "WAV data comes before its format" };
      if (format.code !== 1 || format.bits !== 16 || format.channels !== 1) {
        return { ok: false, error: `Expected 16-bit PCM mono WAV, got ${JSON.stringify(format)}` };
      }
      const count = Math.floor(Math.min(size, view.byteLength - body) / 2);
      const samples = new Float32Array(count);
      for (let i = 0; i < count; i++) samples[i] = view.getInt16(body + i * 2, true) / 32768;
      return { ok: true, value: { sampleRate: format.rate, samples } };
    }
    offset = body + size + (size % 2);
  }
  return { ok: false, error: "WAV has no data chunk" };
}
