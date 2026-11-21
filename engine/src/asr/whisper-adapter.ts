/**
 * WhisperAdapter: on-device Whisper (transformers.js) running in a Web Worker.
 *
 * The engine stays free of browser APIs: this class only speaks a small message
 * protocol through an injected transport. The worker itself (which imports
 * @huggingface/transformers) lives in `@echo/ui` (src/platform/asr-worker.ts).
 *
 * - The worker tries WebGPU first and falls back to WebAssembly.
 * - transformers.js gives Whisper text (and optional timestamps) but no per-word
 *   confidence, so `words` is never set and confidence stays undefined (never guessed).
 */

import type { AsrAdapter, AsrTranscript, Result } from "../types";

export type AsrDevice = "webgpu" | "wasm";

export type WorkerRequest =
  | {
      type: "load";
      id: number;
      model: string;
      devices: AsrDevice[];
      /** Medicine names for the Whisper prompt, most important first (see asr/prompt.ts) */
      medicines?: string[];
      /** Plain words for the prompt instead of medicine names (buildWordsPrompt) */
      words?: string[];
    }
  | { type: "transcribe"; id: number; samples: Float32Array };

export type WorkerReply =
  | { type: "loaded"; id: number; device: AsrDevice }
  | { type: "result"; id: number; text: string; ms: number }
  | { type: "error"; id: number; error: string };

/** How the adapter talks to its worker (a real Worker in the browser, a fake in tests). */
export interface AsrTransport {
  post(request: WorkerRequest): void;
  onReply(listener: (reply: WorkerReply) => void): void;
}

export interface WhisperOptions {
  /** Hugging Face model id; see docs/SPIKES.md for the choice */
  model?: string;
  devices?: AsrDevice[];
  /**
   * Medicine names to prompt Whisper with (most important first). Measured on 48 spoken
   * test sentences (docs/SPIKES.md): with base.en, names recovered went from 32 to 38.
   * Empty list turns the prompt off.
   */
  medicines?: string[];
  /**
   * Plain words to prompt with instead of medicine names (Echo Cover). On the owner's five
   * recordings, sales words kept 18 of 18 facts against 15 with the medicine prompt
   * (docs/SPIKES.md, Nov 21, 2026).
   */
  words?: string[];
}

/** base.en: better medicine names than tiny.en in the S16 bench, about 2x slower (docs/SPIKES.md). */
export const DEFAULT_WHISPER_MODEL = "Xenova/whisper-base.en";

/** Remove Whisper's non-speech markers such as "[BLANK_AUDIO]" or "(music)" and tidy spaces. */
export function cleanWhisperText(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class WhisperAdapter implements AsrAdapter {
  readonly id: string;
  /** Device the worker ended up on, once loaded */
  device: AsrDevice | undefined;
  /** Worker-measured time for the last segment, for the latency spike */
  lastLatencyMs: number | undefined;

  private readonly model: string;
  private readonly devices: AsrDevice[];
  private readonly medicines: string[] | undefined;
  private readonly words: string[] | undefined;
  private nextId = 1;
  private loading: Promise<Result<void>> | undefined;
  private readonly waiting = new Map<number, (reply: WorkerReply) => void>();

  constructor(
    private readonly transport: AsrTransport,
    options: WhisperOptions = {},
  ) {
    this.model = options.model ?? DEFAULT_WHISPER_MODEL;
    this.devices = options.devices ?? ["webgpu", "wasm"];
    this.medicines = options.medicines;
    this.words = options.words;
    this.id = `whisper:${this.model}`;
    transport.onReply((reply) => {
      const resolve = this.waiting.get(reply.id);
      if (resolve) {
        this.waiting.delete(reply.id);
        resolve(reply);
      }
    });
  }

  private request(build: (id: number) => WorkerRequest): Promise<WorkerReply> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.transport.post(build(id));
    });
  }

  /** Load the model (once). Safe to call early to start the download. */
  load(): Promise<Result<void>> {
    if (!this.loading) {
      this.loading = this.request((id) => ({
        type: "load",
        id,
        model: this.model,
        devices: this.devices,
        ...(this.words && this.words.length > 0
          ? { words: this.words }
          : this.medicines
            ? { medicines: this.medicines }
            : {}),
      })).then((reply): Result<void> => {
        if (reply.type === "loaded") {
          this.device = reply.device;
          return { ok: true, value: undefined };
        }
        this.loading = undefined; // allow a retry
        return {
          ok: false,
          error: reply.type === "error" ? reply.error : "Unexpected reply while loading",
        };
      });
    }
    return this.loading;
  }

  async transcribe(samples: Float32Array, sampleRate: number): Promise<Result<AsrTranscript>> {
    if (sampleRate !== 16000) {
      return { ok: false, error: `Expected 16 kHz audio, got ${sampleRate} Hz` };
    }
    const loaded = await this.load();
    if (!loaded.ok) return loaded;

    const reply = await this.request((id) => ({ type: "transcribe", id, samples }));
    if (reply.type === "result") {
      this.lastLatencyMs = reply.ms;
      return { ok: true, value: { text: cleanWhisperText(reply.text) } };
    }
    return {
      ok: false,
      error: reply.type === "error" ? reply.error : "Unexpected reply while transcribing",
    };
  }
}
