/**
 * S16 spike: run on-device Whisper on a 16 kHz mono WAV, the way a session would.
 * The clip goes through the engine Segmenter, then each speech segment is transcribed
 * and timed. This measures Node on the machine it runs on, not a phone browser.
 *
 *   pnpm --filter @echo/evals spike:asr [wav] [model] [dtype]
 *
 * Downloads the model from Hugging Face once (cached). Prints JSON.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "@huggingface/transformers";
import { Segmenter, cleanWhisperText, normaliseText } from "@echo/engine";
import { evalsDir } from "./files";

/** Read a 16-bit PCM mono 16 kHz WAV into floats. */
export function readWav16k(bytes: Buffer): Float32Array {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file");
  }
  let offset = 12;
  let format: { channels: number; rate: number; bits: number } | undefined;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        channels: bytes.readUInt16LE(body + 2),
        rate: bytes.readUInt32LE(body + 4),
        bits: bytes.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      if (!format || format.channels !== 1 || format.rate !== 16000 || format.bits !== 16) {
        throw new Error(`Expected 16-bit mono 16 kHz, got ${JSON.stringify(format)}`);
      }
      const out = new Float32Array(size / 2);
      for (let i = 0; i < out.length; i++) out[i] = bytes.readInt16LE(body + i * 2) / 32768;
      return out;
    }
    offset = body + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

function textOf(output: unknown): string {
  const first: unknown = Array.isArray(output) ? output[0] : output;
  if (typeof first === "object" && first !== null && "text" in first) {
    const t = (first as { text: unknown }).text;
    return typeof t === "string" ? t : "";
  }
  return "";
}

async function main(): Promise<void> {
  const arg = (i: number) => (process.argv[i] ? process.argv[i] : undefined);
  const wav = resolve(arg(2) ?? resolve(evalsDir, "..", "ui/e2e/fixtures/sample-10s.wav"));
  const model = arg(3) ?? "Xenova/whisper-tiny.en";
  const dtype = (arg(4) ?? "q8") as "q8" | "fp32" | "fp16" | "q4";
  const samples = readWav16k(readFileSync(wav));

  const t0 = performance.now();
  const asr = await pipeline("automatic-speech-recognition", model, { device: "cpu", dtype });
  const loadMs = performance.now() - t0;

  const t1 = performance.now();
  const whole = cleanWhisperText(textOf(await asr(samples)));
  const wholeMs = performance.now() - t1;

  const segmenter = new Segmenter({ sampleRate: 16000 });
  const segments = [];
  for (let i = 0; i < samples.length; i += 320) {
    segments.push(...segmenter.push(samples.subarray(i, i + 320), (i / 16000) * 1000));
  }
  const last = segmenter.flush();
  if (last) segments.push(last);

  const perSegment = [];
  for (const s of segments) {
    if (!s.hasSpeech) {
      perSegment.push({ id: s.id, startMs: s.startMs, endMs: s.endMs, hasSpeech: false });
      continue;
    }
    const t = performance.now();
    const text = cleanWhisperText(textOf(await asr(s.samples)));
    const ms = performance.now() - t;
    perSegment.push({
      id: s.id,
      startMs: Math.round(s.startMs),
      endMs: Math.round(s.endMs),
      text,
      ms: Math.round(ms),
      msPer5sAudio: Math.round((ms / (s.endMs - s.startMs)) * 5000),
    });
  }

  const norm = normaliseText(whole);
  const expected = ["metformin", "500", "twice daily", "3 months"];
  console.log(
    JSON.stringify(
      {
        machine: `${process.platform} ${process.arch}, Node ${process.version}`,
        model,
        dtype,
        device: "cpu (onnxruntime-node)",
        clipSeconds: samples.length / 16000,
        loadMs: Math.round(loadMs),
        wholeClip: { text: whole, ms: Math.round(wholeMs) },
        heardExpected: Object.fromEntries(expected.map((e) => [e, ` ${norm} `.includes(` ${e} `)])),
        segments: perSegment,
      },
      null,
      2,
    ),
  );
}

void main();
