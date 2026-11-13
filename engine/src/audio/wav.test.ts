import { describe, it, expect } from "vitest";
import { decodeWav } from "./wav";

function wav(
  samples: number[],
  opts: { rate?: number; channels?: number; bits?: number; extraChunk?: boolean } = {},
) {
  const { rate = 16000, channels = 1, bits = 16, extraChunk = false } = opts;
  const data = samples.length * 2;
  const extra = extraChunk ? 8 + 3 + 1 : 0; // odd-sized chunk plus pad byte
  const buf = new ArrayBuffer(44 + extra + data);
  const v = new DataView(buf);
  const str = (at: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + extra + data, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, bits, true);
  let at = 36;
  if (extraChunk) {
    str(at, "LIST");
    v.setUint32(at + 4, 3, true);
    at += 12;
  }
  str(at, "data");
  v.setUint32(at + 4, data, true);
  samples.forEach((s, i) => v.setInt16(at + 8 + i * 2, s, true));
  return buf;
}

describe("decodeWav", () => {
  it("decodes 16-bit mono PCM", () => {
    const r = decodeWav(wav([0, 16384, -32768]));
    expect(r.ok && r.value.sampleRate).toBe(16000);
    expect(r.ok && [...r.value.samples]).toEqual([0, 0.5, -1]);
  });

  it("skips other chunks, including odd-sized ones", () => {
    const r = decodeWav(wav([100], { extraChunk: true }));
    expect(r.ok && r.value.samples.length).toBe(1);
  });

  it("reports the real sample rate (callers resample)", () => {
    const r = decodeWav(wav([0], { rate: 48000 }));
    expect(r.ok && r.value.sampleRate).toBe(48000);
  });

  it("accepts WAVE_FORMAT_EXTENSIBLE holding PCM (what macOS afconvert writes)", () => {
    // fmt chunk of 40 bytes: code 0xFFFE, cbSize 22, valid bits, channel mask, subformat GUID (PCM = 1)
    const samples = [16384];
    const buf = new ArrayBuffer(12 + 8 + 40 + 8 + samples.length * 2);
    const v = new DataView(buf);
    const str = (at: number, s: string) =>
      [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, buf.byteLength - 8, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 40, true);
    v.setUint16(20, 0xfffe, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    v.setUint16(36, 22, true);
    v.setUint16(38, 16, true);
    v.setUint32(40, 4, true);
    v.setUint16(44, 1, true); // subformat: PCM
    str(60, "data");
    v.setUint32(64, 2, true);
    v.setInt16(68, 16384, true);
    const r = decodeWav(buf);
    expect(r.ok && [...r.value.samples]).toEqual([0.5]);
  });

  it("rejects extensible WAV whose subformat is not PCM", () => {
    const buf = new ArrayBuffer(70);
    const v = new DataView(buf);
    const str = (at: number, s: string) =>
      [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    str(0, "RIFF");
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 40, true);
    v.setUint16(20, 0xfffe, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint16(34, 16, true);
    v.setUint16(44, 3, true); // IEEE float
    str(60, "data");
    v.setUint32(64, 2, true);
    expect(decodeWav(buf).ok).toBe(false);
  });

  it("rejects stereo, non-WAV and missing data", () => {
    expect(decodeWav(wav([0, 0], { channels: 2 })).ok).toBe(false);
    expect(decodeWav(new ArrayBuffer(10)).ok).toBe(false);
    expect(decodeWav(wav([]).slice(0, 36)).ok).toBe(false);
  });
});
