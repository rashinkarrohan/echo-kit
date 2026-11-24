/**
 * Microphone capture (browser). Consent first, then the microphone.
 *
 * - Calls ledger.assertConsent("record") before anything else; without consent the
 *   microphone is never requested.
 * - getUserMedia with echo cancellation and noise suppression, mono.
 * - An AudioContext at 16 kHz; if the browser refuses that rate, or delivers no audio at it,
 *   the device rate is used and frames are resampled to 16 kHz. The context is resumed (iOS).
 * - An AudioWorklet copies input frames to the main thread, where the engine's
 *   Segmenter turns them into 3 to 8 s segments.
 *
 * Audio stays in memory on the device. Nothing here stores or uploads it.
 * Browser APIs are injected (CaptureDeps) so the consent gate can be tested.
 */

import { Segmenter, resample } from "@echo/engine";
import type { AudioSegment, ConsentLedger, Result } from "@echo/engine";

export const TARGET_SAMPLE_RATE = 16000;
export const WORKLET_NAME = "echo-capture";

const REAL = Symbol("real-audio-context");
const REAL_NODE = Symbol("real-audio-node");

/** Copies channel 0 of each 128-sample render quantum to the main thread. */
export const WORKLET_SOURCE = `
class EchoCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("${WORKLET_NAME}", EchoCapture);
`;

/** The small parts of the Web Audio API that capture uses. */
export interface CaptureNode {
  connect(target: CaptureNode): void;
  disconnect(): void;
}
export interface CapturePort {
  onmessage: ((event: { data: unknown }) => void) | null;
}
export interface CaptureContext {
  readonly sampleRate: number;
  /** Wake a suspended context (needed on iOS Safari) */
  resume?(): Promise<void>;
  createMediaStreamSource(stream: CaptureStream): CaptureNode;
  createSilentSink(): CaptureNode;
  close(): Promise<void>;
}
export interface CaptureStream {
  getTracks(): Array<{ stop(): void }>;
}

export interface CaptureDeps {
  getUserMedia(constraints: { audio: Record<string, unknown> }): Promise<CaptureStream>;
  /** Try 16 kHz; return undefined if the browser refuses it */
  createContext(sampleRate?: number): CaptureContext | undefined;
  /** Load the worklet module and create the capture node */
  createWorkletNode(ctx: CaptureContext): Promise<{ node: CaptureNode; port: CapturePort }>;
}

export type CaptureError = "permission-denied" | "no-microphone" | "audio-unavailable";

export interface CaptureHandle {
  /** Rate the browser actually runs at (frames are resampled to 16 kHz) */
  readonly deviceSampleRate: number;
  /** Stop the microphone and return the final (possibly short) segment */
  stop(): Promise<AudioSegment | undefined>;
}

export interface CaptureOptions {
  ledger: ConsentLedger;
  onSegment: (segment: AudioSegment) => void;
  deps?: CaptureDeps;
  /**
   * Wait this long for the first audio before trying the device's own rate (and then giving up
   * with "audio-unavailable"). 0 or absent: do not wait.
   */
  firstFrameTimeoutMs?: number;
  /** How long to wait for the audio context to wake up (default 1500 ms) */
  resumeTimeoutMs?: number;
}

function classify(e: unknown): CaptureError {
  const name =
    typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-microphone";
  return "audio-unavailable";
}

/**
 * Start capturing. Throws ConsentRequiredError (by design) when there is no "record"
 * consent. Other failures are returned as Result errors for the designed error states.
 */
export async function startCapture(options: CaptureOptions): Promise<Result<CaptureHandle>> {
  options.ledger.assertConsent("record");
  const deps = options.deps ?? browserDeps();
  let stream: CaptureStream;
  try {
    stream = await deps.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (e) {
    return { ok: false, error: classify(e) };
  }
  // 16 kHz first (nothing to resample); then the device's own rate, because some phones accept
  // the 16 kHz request but then deliver no audio.
  for (const rate of [TARGET_SAMPLE_RATE, undefined] as const) {
    const handle = await tryContext(deps, stream, rate, options);
    if (handle) return { ok: true, value: handle };
  }
  stream.getTracks().forEach((t) => t.stop());
  return { ok: false, error: "audio-unavailable" };
}

const delay = (ms: number): Promise<false> =>
  new Promise((resolve) => setTimeout(() => resolve(false), ms));

/** Wake the audio context. iOS Safari starts it suspended; do not wait forever if it will not wake. */
async function resumeContext(ctx: CaptureContext, timeoutMs: number): Promise<void> {
  try {
    if (ctx.resume) await Promise.race([ctx.resume(), delay(timeoutMs)]);
  } catch {
    // The first-frame check below decides whether audio is really flowing.
  }
}

/** One attempt at a given context rate. Returns undefined (and cleans up) if it did not work. */
async function tryContext(
  deps: CaptureDeps,
  stream: CaptureStream,
  rate: number | undefined,
  options: CaptureOptions,
): Promise<CaptureHandle | undefined> {
  const ctx = deps.createContext(rate);
  if (!ctx) return undefined;
  let node: CaptureNode | undefined;
  let source: CaptureNode | undefined;
  let port: CapturePort | undefined;
  const cleanup = async (): Promise<void> => {
    if (port) port.onmessage = null;
    try {
      source?.disconnect();
      node?.disconnect();
    } catch {
      // Already disconnected.
    }
    await ctx.close().catch(() => {});
  };
  try {
    const made = await deps.createWorkletNode(ctx);
    node = made.node;
    port = made.port;
    source = ctx.createMediaStreamSource(stream);
    const sink = ctx.createSilentSink();
    const segmenter = new Segmenter({ sampleRate: TARGET_SAMPLE_RATE });
    let tMs = 0;
    let firstFrame: (() => void) | undefined;
    const arrived = new Promise<true>((resolve) => {
      firstFrame = () => resolve(true);
    });
    port.onmessage = (event) => {
      if (!(event.data instanceof Float32Array)) return;
      firstFrame?.();
      const frame = resample(event.data, ctx.sampleRate, TARGET_SAMPLE_RATE);
      for (const segment of segmenter.push(frame, tMs)) options.onSegment(segment);
      tMs += (frame.length / TARGET_SAMPLE_RATE) * 1000;
    };
    source.connect(node);
    node.connect(sink);
    await resumeContext(ctx, options.resumeTimeoutMs ?? 1500);
    const wait = options.firstFrameTimeoutMs ?? 0;
    if (wait > 0 && !(await Promise.race([arrived, delay(wait)]))) {
      await cleanup();
      return undefined;
    }
    const liveNode = node;
    const liveSource = source;
    const livePort = port;
    let stopped = false;
    return {
      deviceSampleRate: ctx.sampleRate,
      async stop() {
        if (stopped) return undefined;
        stopped = true;
        livePort.onmessage = null;
        liveSource.disconnect();
        liveNode.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        await ctx.close();
        return segmenter.flush();
      },
    };
  } catch {
    await cleanup();
    return undefined;
  }
}

/** Real browser implementations of CaptureDeps. */
export function browserDeps(): CaptureDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createContext(sampleRate) {
      try {
        const ctx = sampleRate ? new AudioContext({ sampleRate }) : new AudioContext();
        return {
          get sampleRate() {
            return ctx.sampleRate;
          },
          createMediaStreamSource: (stream) =>
            wrap(ctx.createMediaStreamSource(stream as MediaStream)),
          createSilentSink() {
            const gain = ctx.createGain();
            gain.gain.value = 0;
            gain.connect(ctx.destination);
            return wrap(gain);
          },
          resume: () => ctx.resume(),
          close: () => ctx.close(),
          // keep the real context reachable for createWorkletNode
          [REAL]: ctx,
        } as CaptureContext;
      } catch {
        return undefined;
      }
    },
    async createWorkletNode(wrapped) {
      const ctx = (wrapped as CaptureContext & { [REAL]: AudioContext })[REAL];
      const url = URL.createObjectURL(
        new Blob([WORKLET_SOURCE], { type: "application/javascript" }),
      );
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const node = new AudioWorkletNode(ctx, WORKLET_NAME);
      return { node: wrap(node), port: node.port as unknown as CapturePort };
    },
  };
}

function wrap(node: AudioNode): CaptureNode & { [REAL_NODE]: AudioNode } {
  return {
    [REAL_NODE]: node,
    connect(target) {
      node.connect((target as CaptureNode & { [REAL_NODE]: AudioNode })[REAL_NODE]);
    },
    disconnect: () => node.disconnect(),
  };
}
