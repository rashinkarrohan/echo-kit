/**
 * RecordingController: runs one ConversationSession from a live microphone (with
 * on-device Whisper) or from a scripted consult, and keeps what the screens need:
 * status, caption lines, Please-repeat prompts and the receipt. Shared by both apps.
 * No React here; apps subscribe to changes.
 */

import { ConversationSession, MockAdapter } from "@echo/engine";
import type {
  AsrAdapter,
  AudioSegment,
  ConsentLedger,
  ConversationSchema,
  EchoStore,
  Receipt,
  RepeatPrompt,
  Result,
} from "@echo/engine";
import type { CaptionLine } from "../components/CaptionView";
import { startCapture } from "./capture";
import type { CaptureDeps, CaptureHandle } from "./capture";
import { playScript, scriptedAudio, scriptedLines } from "./scripted";
import type { ScriptPlayback, ScriptedConsult } from "./scripted";
import { loadSampleAudio } from "./sample-audio";
import type { LoadAudio } from "./sample-audio";
import { createWhisperAdapter } from "./whisper";

export type RecordingStatus =
  | "idle"
  | "starting"
  | "loading-model"
  | "recording"
  | "paused"
  | "stopping"
  | "done"
  | "permission-denied"
  | "error";

export type RecordingSource =
  | {
      kind: "live";
      createAsr?: () => AsrAdapter & { load?: () => Promise<Result<void>> };
      captureDeps?: CaptureDeps;
    }
  | {
      kind: "scripted";
      consult: ScriptedConsult;
      speed?: number;
      /** Loads `consult.audioUrl`; defaults to fetching and decoding the bundled file */
      loadAudio?: LoadAudio;
    };

export interface RecordingOptions {
  sessionId: string;
  schema: ConversationSchema;
  ledger: ConsentLedger;
  store?: EchoStore;
  seller?: string;
  /** Echo Care: the user's own medicines; prompts the speech engine and the name matcher */
  medicines?: readonly string[];

  source: RecordingSource;
}

export interface RecordingSnapshot {
  status: RecordingStatus;
  lines: CaptionLine[];
  prompts: RepeatPrompt[];
  receipt?: Receipt;
  error?: string;
}

export class RecordingController {
  private snapshot: RecordingSnapshot = { status: "idle", lines: [], prompts: [] };
  private readonly listeners = new Set<() => void>();
  private session: ConversationSession | undefined;
  private capture: CaptureHandle | undefined;
  private script: ScriptPlayback | undefined;
  private paused = false;
  private pending: Array<Promise<unknown>> = [];
  private audioAvailable = false;

  get state(): RecordingSnapshot {
    return this.snapshot;
  }

  /**
   * True when "Hear it" can play real audio: a live recording, or a sample whose actor
   * recording loaded. False for silent text-only samples, so no dead buttons are shown.
   */
  get hasAudio(): boolean {
    return this.audioAvailable;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<RecordingSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of [...this.listeners]) l();
  }

  /** Throws ConsentRequiredError (by design) without record and transcribe consent. */
  async start(options: RecordingOptions): Promise<void> {
    if (this.session) return;
    const { source } = options;
    const asr: AsrAdapter & { load?: () => Promise<Result<void>> } =
      source.kind === "scripted"
        ? new MockAdapter(scriptedLines(source.consult))
        : (
            source.createAsr ??
            (() =>
              createWhisperAdapter(
                {},
                {
                  ...(options.medicines ? { medicines: options.medicines } : {}),
                  // The schema's own words (Echo Cover) replace the medicine prompt.
                  ...(options.schema.speechWords ? { words: options.schema.speechWords } : {}),
                },
              ))
          )();

    const session = new ConversationSession({
      id: options.sessionId,
      schema: options.schema,
      asr,
      ledger: options.ledger,
      ...(options.store ? { store: options.store } : {}),
      ...(options.seller !== undefined ? { seller: options.seller } : {}),
      ...(options.medicines && options.medicines.length > 0
        ? { medicines: options.medicines }
        : {}),
    });
    session.start(); // consent gate
    this.session = session;
    this.set({ status: "starting", lines: [], prompts: [] });

    session.on("caption", ({ segment }) =>
      this.set({ lines: [...this.snapshot.lines, { segment, tokens: [] }] }),
    );
    session.on("flags", ({ segmentId, tokens }) =>
      this.set({
        lines: this.snapshot.lines.map((l) => (l.segment.id === segmentId ? { ...l, tokens } : l)),
      }),
    );
    session.on("prompt", (p) => this.set({ prompts: [...this.snapshot.prompts, p] }));
    session.on("error", (e) => {
      if (e.code === "store-failed") this.set({ error: e.message });
    });

    const add = (segment: AudioSegment): void => {
      if (this.paused) return; // audio during a pause is not kept
      this.pending.push(session.addAudio(segment));
    };

    if (source.kind === "scripted") {
      let recording: Float32Array | undefined;
      if (source.consult.audioUrl) {
        const loaded = await (source.loadAudio ?? loadSampleAudio)(source.consult.audioUrl);
        // Without the file the sample still runs; the apps then say audio is not available.
        if (loaded.ok) recording = loaded.value;
      }
      if (this.session !== session) return; // discarded while loading
      this.audioAvailable = recording !== undefined;
      this.set({ status: "recording" });
      this.script = playScript(scriptedAudio(source.consult, 16000, recording), add, {
        speed: source.speed ?? 1,
      });
      return;
    }

    // Ask for the microphone first, so a refusal shows at once, then load the model.
    const captured = await startCapture({
      ledger: options.ledger,
      onSegment: add,
      ...(source.captureDeps ? { deps: source.captureDeps } : {}),
    });
    if (!captured.ok) {
      this.set({ status: captured.error === "audio-unavailable" ? "error" : "permission-denied" });
      return;
    }
    this.capture = captured.value;
    this.audioAvailable = true;
    if (asr.load) {
      this.set({ status: "loading-model" });
      const loaded = await asr.load();
      if (!loaded.ok) {
        await this.capture.stop();
        this.set({ status: "error", error: loaded.error });
        return;
      }
    }
    if (this.snapshot.status === "loading-model") this.set({ status: "recording" });
  }

  pause(): void {
    if (this.snapshot.status !== "recording") return;
    this.paused = true;
    this.script?.pause();
    this.set({ status: "paused" });
  }

  resume(): void {
    if (this.snapshot.status !== "paused") return;
    this.paused = false;
    this.script?.resume();
    this.set({ status: "recording" });
  }

  /** Stop recording, build the receipt and store it on the device. */
  async stop(): Promise<Result<Receipt>> {
    const session = this.session;
    if (!session) return { ok: false, error: "Not recording" };
    this.set({ status: "stopping" });
    this.script?.stop();
    if (this.capture) {
      const last = await this.capture.stop();
      if (last && !this.paused) this.pending.push(session.addAudio(last));
    }
    await Promise.all(this.pending);
    const result = await session.stop();
    this.set(
      result.ok
        ? { status: "done", receipt: result.value }
        : { status: "error", error: result.error },
    );
    return result;
  }

  /** Stop capture without building or storing a receipt. Used only after explicit discard. */
  async discard(): Promise<void> {
    this.script?.stop();
    if (this.capture) await this.capture.stop();
    await Promise.all(this.pending);
    this.script = undefined;
    this.capture = undefined;
    this.session = undefined;
    this.pending = [];
    this.paused = false;
    this.audioAvailable = false;
    this.snapshot = { status: "idle", lines: [], prompts: [] };
    for (const listener of [...this.listeners]) listener();
  }

  /** In-memory audio of the given segments, for "Hear it". */
  audioFor(segmentIds: string[]): Float32Array[] {
    return this.session?.audioFor(segmentIds) ?? [];
  }
}
