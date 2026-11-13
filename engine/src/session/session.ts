/**
 * ConversationSession: one consented conversation, from audio segments to a receipt.
 *
 *   capture (ui) -> addAudio(segment) -> speech adapter -> "caption" event
 *                                                       -> "flags" event (entity guard)
 *   stop()       -> extract -> validate -> verify -> gap check (runPipeline)
 *                -> Receipt -> local store -> "receipt" event
 *
 * - start() is the consent gate: it throws without "record" and "transcribe" consent.
 *   Audio that arrives after either consent is withdrawn is dropped.
 * - Segments are processed in the order they arrive, even if the speech engine answers
 *   out of order. Silent segments are not sent to the speech engine.
 * - A failed transcription is reported and kept as an empty segment, so the timeline
 *   stays honest; no text is ever made up.
 * - Audio is kept in memory for playback and only stored if the user opted in.
 * No UI and no browser APIs here.
 */

import type {
  AsrAdapter,
  ConversationSchema,
  Extractor,
  FlaggedToken,
  Receipt,
  Result,
  Segment,
} from "../types";
import type { AudioSegment } from "../audio/segmenter";
import type { ConsentLedger } from "../consent/ledger";
import type { EchoStore } from "../store/store";
import { runPipeline, flagSegment } from "../pipeline";
import { buildReadBack } from "../readback/readback";

const ASR_SAMPLE_RATE = 16000;

export type SessionState = "idle" | "recording" | "stopped";

export type SessionErrorCode =
  | "not-recording"
  | "consent-withdrawn"
  | "out-of-order"
  | "transcription-failed"
  | "store-failed";

export interface SessionEvents {
  caption: { segment: Segment; hasSpeech: boolean };
  flags: { segmentId: string; tokens: FlaggedToken[] };
  receipt: Receipt;
  error: { code: SessionErrorCode; message: string; segmentId?: string };
}

export interface SessionOptions {
  id: string;
  schema: ConversationSchema;
  asr: AsrAdapter;
  ledger: ConsentLedger;
  store?: EchoStore;
  /** Defaults to the deterministic rules extractor */
  extractor?: Extractor;
  /** Echo Cover: the seller name the user typed */
  seller?: string;
  /** Store audio on the device (opt-in; off by default) */
  keepAudio?: boolean;
  now?: () => number;
}

type Listeners = { [K in keyof SessionEvents]: Array<(payload: SessionEvents[K]) => void> };

/** Fact keys read back to the speaker, per skin (UI-SPEC: medicines in Echo Care). */
const READ_BACK_KEYS: Record<ConversationSchema["skin"], string[]> = {
  care: ["medicine"],
  cover: [],
};

export class ConversationSession {
  private state: SessionState = "idle";
  private readonly segments: Segment[] = [];
  private readonly audio = new Map<string, Float32Array>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastEndMs = Number.NEGATIVE_INFINITY;
  private createdAt = 0;
  private result: Result<Receipt> | undefined;
  private readonly listeners: Listeners = { caption: [], flags: [], receipt: [], error: [] };
  private readonly now: () => number;

  constructor(private readonly options: SessionOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  get id(): string {
    return this.options.id;
  }

  get status(): SessionState {
    return this.state;
  }

  on<K extends keyof SessionEvents>(
    event: K,
    listener: (payload: SessionEvents[K]) => void,
  ): () => void {
    const list = this.listeners[event];
    list.push(listener);
    return () => {
      const i = list.indexOf(listener);
      if (i >= 0) list.splice(i, 1);
    };
  }

  private emit<K extends keyof SessionEvents>(event: K, payload: SessionEvents[K]): void {
    for (const listener of [...this.listeners[event]]) listener(payload);
  }

  private fail<T>(code: SessionErrorCode, message: string, segmentId?: string): Result<T> {
    this.emit("error", { code, message, ...(segmentId !== undefined ? { segmentId } : {}) });
    return { ok: false, error: `${code}: ${message}` };
  }

  /** The consent gate. Throws ConsentRequiredError without record and transcribe consent. */
  start(): void {
    this.options.ledger.assertConsent("record");
    this.options.ledger.assertConsent("transcribe");
    if (this.state !== "idle") return;
    this.state = "recording";
    this.createdAt = this.now();
  }

  /** Add one 3 to 8 s segment from capture. Resolves once it is transcribed and flagged. */
  addAudio(segment: AudioSegment): Promise<Result<Segment>> {
    if (this.state !== "recording") {
      return Promise.resolve(
        this.fail("not-recording", "The session is not recording", segment.id),
      );
    }
    const { ledger } = this.options;
    if (!ledger.has("record") || !ledger.has("transcribe")) {
      return Promise.resolve(
        this.fail("consent-withdrawn", "Consent was withdrawn; audio dropped", segment.id),
      );
    }
    if (segment.startMs < this.lastEndMs) {
      return Promise.resolve(
        this.fail("out-of-order", "Segment overlaps the previous one", segment.id),
      );
    }
    this.lastEndMs = segment.endMs;

    // Transcription may start at once, but results are applied strictly in arrival order.
    const transcription = segment.hasSpeech
      ? this.options.asr.transcribe(segment.samples, ASR_SAMPLE_RATE)
      : undefined;
    const run = this.queue.then(() => this.apply(segment, transcription));
    this.queue = run;
    return run;
  }

  private async apply(
    audio: AudioSegment,
    transcription: ReturnType<AsrAdapter["transcribe"]> | undefined,
  ): Promise<Result<Segment>> {
    let text = "";
    let words: Segment["words"];
    if (transcription) {
      const heard = await transcription;
      if (heard.ok) {
        text = heard.value.text;
        words = heard.value.words;
      } else {
        this.fail("transcription-failed", heard.error, audio.id);
      }
    }

    const segment: Segment = {
      id: audio.id,
      index: audio.index,
      startMs: audio.startMs,
      endMs: audio.endMs,
      text,
      ...(words !== undefined ? { words } : {}),
    };
    this.segments.push(segment);
    this.audio.set(audio.id, audio.samples);

    if (this.options.keepAudio && this.options.store) {
      const saved = await this.options.store.saveAudio(this.id, audio.samples.slice().buffer);
      if (!saved.ok) this.fail("store-failed", saved.error, audio.id);
    }

    this.emit("caption", { segment: { ...segment }, hasSpeech: audio.hasSpeech });
    if (text.length > 0) {
      this.emit("flags", {
        segmentId: segment.id,
        tokens: flagSegment(segment, this.options.schema),
      });
    }
    return { ok: true, value: { ...segment } };
  }

  /** Stop: wait for pending segments, then build, store and emit the receipt (once). */
  async stop(): Promise<Result<Receipt>> {
    if (this.result) return this.result;
    if (this.state !== "recording") {
      return this.fail("not-recording", "The session was never started");
    }
    this.state = "stopped";
    await this.queue;

    const { schema, store, extractor, seller } = this.options;
    const { facts, checklist } = runPipeline(this.segments, schema, extractor);
    const receipt: Receipt = {
      conversationId: this.id,
      schemaId: schema.id,
      timestamp: this.now(),
      ...(seller !== undefined ? { seller } : {}),
      facts,
      checklist,
      readBack: buildReadBack(facts, READ_BACK_KEYS[schema.skin]),
      labelFlags: [],
      disclaimer: schema.disclaimer,
      nextSteps: schema.nextSteps,
    };

    if (store) {
      const savedSession = await store.saveSession({
        id: this.id,
        schemaId: schema.id,
        createdAt: this.createdAt,
        segments: this.transcript(),
      });
      const savedReceipt = savedSession.ok ? await store.saveReceipt(receipt) : savedSession;
      if (!savedReceipt.ok) {
        this.result = this.fail("store-failed", savedReceipt.error);
        return this.result;
      }
    }

    this.result = { ok: true, value: receipt };
    this.emit("receipt", receipt);
    return this.result;
  }

  /** The transcript so far (copies). */
  transcript(): Segment[] {
    return this.segments.map((s) => ({ ...s }));
  }

  /** In-memory audio for the given segments, for "Hear it" playback. */
  audioFor(segmentIds: string[]): Float32Array[] {
    return segmentIds
      .map((id) => this.audio.get(id))
      .filter((a): a is Float32Array => a !== undefined);
  }
}
