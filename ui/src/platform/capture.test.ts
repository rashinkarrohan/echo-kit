import { describe, it, expect, vi } from "vitest";
import { ConsentLedger, ConsentRequiredError, CONSENT_WORDING_VERSION } from "@echo/engine";
import type { AudioSegment } from "@echo/engine";
import { startCapture } from "./capture";
import type { CaptureContext, CaptureDeps, CaptureNode, CapturePort } from "./capture";

function fakeDeps(opts: { rate?: number; refuse16k?: boolean; micError?: string } = {}) {
  const port: CapturePort = { onmessage: null };
  const node: CaptureNode = { connect: vi.fn(), disconnect: vi.fn() };
  const trackStop = vi.fn();
  const close = vi.fn(() => Promise.resolve());
  const getUserMedia = vi.fn<CaptureDeps["getUserMedia"]>(() => {
    if (opts.micError)
      return Promise.reject(Object.assign(new Error("x"), { name: opts.micError }));
    return Promise.resolve({ getTracks: () => [{ stop: trackStop }] });
  });
  const ctx = (rate: number): CaptureContext => ({
    sampleRate: rate,
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    createSilentSink: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    close,
  });
  const deps: CaptureDeps = {
    getUserMedia,
    createContext: (sr) => (sr && opts.refuse16k ? undefined : ctx(sr ?? opts.rate ?? 48000)),
    createWorkletNode: () => Promise.resolve({ node, port }),
  };
  return { deps, port, getUserMedia, trackStop, close };
}

function consented() {
  const ledger = new ConsentLedger();
  ledger.grant("record", CONSENT_WORDING_VERSION);
  return ledger;
}

describe("startCapture consent gate (PB10)", () => {
  it("throws without record consent and never asks for the microphone", async () => {
    const { deps, getUserMedia } = fakeDeps();
    await expect(
      startCapture({ ledger: new ConsentLedger(), onSegment: () => {}, deps }),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("throws after consent is withdrawn", async () => {
    const ledger = consented();
    await ledger.withdraw("record");
    const { deps, getUserMedia } = fakeDeps();
    await expect(startCapture({ ledger, onSegment: () => {}, deps })).rejects.toBeInstanceOf(
      ConsentRequiredError,
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("transcribe or share consent alone is not enough", async () => {
    const ledger = new ConsentLedger();
    ledger.grant("transcribe", CONSENT_WORDING_VERSION);
    ledger.grant("share", CONSENT_WORDING_VERSION);
    const { deps, getUserMedia } = fakeDeps();
    await expect(startCapture({ ledger, onSegment: () => {}, deps })).rejects.toBeInstanceOf(
      ConsentRequiredError,
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe("startCapture", () => {
  it("asks for the microphone with echo cancellation and noise suppression", async () => {
    const { deps, getUserMedia } = fakeDeps();
    const r = await startCapture({ ledger: consented(), onSegment: () => {}, deps });
    expect(r.ok).toBe(true);
    expect(getUserMedia.mock.calls[0][0].audio).toMatchObject({
      echoCancellation: true,
      noiseSuppression: true,
    });
  });

  it("reports permission denied as a designed error, not a crash", async () => {
    const { deps } = fakeDeps({ micError: "NotAllowedError" });
    expect(await startCapture({ ledger: consented(), onSegment: () => {}, deps })).toEqual({
      ok: false,
      error: "permission-denied",
    });
  });

  it("falls back to the device rate and resamples frames to 16 kHz segments", async () => {
    const { deps, port } = fakeDeps({ refuse16k: true, rate: 48000 });
    const segments: AudioSegment[] = [];
    const r = await startCapture({ ledger: consented(), onSegment: (s) => segments.push(s), deps });
    expect(r.ok && r.value.deviceSampleRate).toBe(48000);

    // 9 s of a loud tone at 48 kHz, in 128-sample quanta
    const total = 48000 * 9;
    for (let i = 0; i < total; i += 128) {
      const frame = new Float32Array(128).map(
        (_, j) => 0.3 * Math.sin((2 * Math.PI * 180 * (i + j)) / 48000),
      );
      port.onmessage?.({ data: frame });
    }
    expect(segments).toHaveLength(1);
    expect(segments[0].endMs - segments[0].startMs).toBe(8000);
    expect(segments[0].samples.length).toBe(16000 * 8);
  });

  it("stop releases the microphone and returns the remainder", async () => {
    const { deps, port, trackStop, close } = fakeDeps({ rate: 16000 });
    const r = await startCapture({ ledger: consented(), onSegment: () => {}, deps });
    for (let i = 0; i < 16000; i += 128)
      port.onmessage?.({ data: new Float32Array(128).fill(0.2) });
    const last = r.ok ? await r.value.stop() : undefined;
    expect(trackStop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(last && last.endMs - last.startMs).toBe(1000);
    expect(port.onmessage).toBeNull();
  });
});
