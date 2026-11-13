/**
 * S16 latency spike page. Loads on-device Whisper through the real adapter and worker,
 * splits the bundled actor clip with the engine Segmenter, and times each segment.
 * Open it on the reference phone to measure there; Playwright reads the same result.
 * Query: ?model=Xenova/whisper-base.en&devices=wasm
 */

import { DEFAULT_WHISPER_MODEL, Segmenter, decodeWav, normaliseText, resample } from "@echo/engine";
import type { AsrDevice } from "@echo/engine";
import { createWhisperAdapter } from "../../src/platform/whisper";
import type { SpikeResult, SpikeSegment } from "./types";

const out = document.getElementById("out");
const status = document.getElementById("status");

function show(result: SpikeResult, note: string): void {
  if (status) status.textContent = note;
  if (out) out.textContent = JSON.stringify(result, null, 2);
}

async function run(): Promise<SpikeResult> {
  const params = new URLSearchParams(location.search);
  const model = params.get("model") ?? DEFAULT_WHISPER_MODEL;
  const devicesParam = params.get("devices");
  const devices = devicesParam ? (devicesParam.split(",") as AsrDevice[]) : undefined;
  const result: SpikeResult = {
    userAgent: navigator.userAgent,
    model,
    crossOriginIsolated: globalThis.crossOriginIsolated,
    segments: [],
    text: "",
    normalisedText: "",
  };

  const response = await fetch("/sample-10s.wav");
  const decoded = decodeWav(await response.arrayBuffer());
  if (!decoded.ok) return { ...result, error: decoded.error };
  const samples = resample(decoded.value.samples, decoded.value.sampleRate, 16000);
  result.clipSeconds = samples.length / 16000;

  show(result, "Loading the speech model (first time downloads it)…");
  const asr = createWhisperAdapter({ model, ...(devices ? { devices } : {}) });
  const t0 = performance.now();
  const loaded = await asr.load();
  result.loadMs = Math.round(performance.now() - t0);
  if (!loaded.ok) return { ...result, error: loaded.error };
  if (asr.device) result.device = asr.device;

  const segmenter = new Segmenter({ sampleRate: 16000 });
  const pieces = [];
  for (let i = 0; i < samples.length; i += 320) {
    pieces.push(...segmenter.push(samples.subarray(i, i + 320), (i / 16000) * 1000));
  }
  const last = segmenter.flush();
  if (last) pieces.push(last);

  for (const piece of pieces) {
    const seg: SpikeSegment = {
      id: piece.id,
      startMs: Math.round(piece.startMs),
      endMs: Math.round(piece.endMs),
      hasSpeech: piece.hasSpeech,
    };
    if (piece.hasSpeech) {
      show(result, `Transcribing ${piece.id}…`);
      const heard = await asr.transcribe(piece.samples, 16000);
      if (heard.ok) {
        seg.text = heard.value.text;
        if (asr.lastLatencyMs !== undefined) {
          seg.ms = asr.lastLatencyMs;
          seg.msPer5sAudio = Math.round((asr.lastLatencyMs / (piece.endMs - piece.startMs)) * 5000);
        }
      } else {
        seg.error = heard.error;
      }
    }
    result.segments.push(seg);
  }
  result.text = result.segments
    .map((s) => s.text ?? "")
    .filter((t) => t.length > 0)
    .join(" ");
  result.normalisedText = normaliseText(result.text);
  return result;
}

run()
  .then((result) => {
    show(result, result.error ? "Failed" : "Done");
    (window as unknown as { __spike: SpikeResult }).__spike = result;
  })
  .catch((e: unknown) => {
    const result: SpikeResult = {
      userAgent: navigator.userAgent,
      model: "",
      crossOriginIsolated: globalThis.crossOriginIsolated,
      segments: [],
      text: "",
      normalisedText: "",
      error: e instanceof Error ? e.message : "Unknown error",
    };
    show(result, "Failed");
    (window as unknown as { __spike: SpikeResult }).__spike = result;
  });
