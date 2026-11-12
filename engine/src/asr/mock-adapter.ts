/**
 * MockAdapter: a scripted speech engine for tests, evals and the sample-consult mode.
 * Returns the scripted lines in order, one per segment. When the script runs out it
 * returns an error; it never makes text up.
 */

import type { AsrAdapter, AsrTranscript, Result } from "../types";

export class MockAdapter implements AsrAdapter {
  readonly id = "mock";
  private next = 0;
  private readonly lines: AsrTranscript[];

  constructor(lines: Array<string | AsrTranscript>) {
    this.lines = lines.map((l) => (typeof l === "string" ? { text: l } : { ...l }));
  }

  transcribe(_samples: Float32Array, sampleRate: number): Promise<Result<AsrTranscript>> {
    if (sampleRate !== 16000) {
      return Promise.resolve({ ok: false, error: `Expected 16 kHz audio, got ${sampleRate} Hz` });
    }
    const line = this.lines[this.next];
    if (!line) {
      return Promise.resolve({ ok: false, error: "Mock script has no more lines" });
    }
    this.next += 1;
    return Promise.resolve({ ok: true, value: { ...line } });
  }
}
