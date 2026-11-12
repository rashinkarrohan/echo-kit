# Spikes (fill as each is done; Kiro writes the decision)

| Spike | Question | Result | Decision | Date |
|---|---|---|---|---|
| S16 Speech | Model, download size, latency per 5 s segment on the reference phone, WebGPU vs WebAssembly | **Partly done.** Adapter, worker and mock built (see below). Model sizes known. **Latency not measured yet**: needs a consenting-actor test clip and the reference phone. | Provisional default `Xenova/whisper-tiny.en` (smallest). Revisit after the phone measurement. | Nov 12, 2026 (partial) |
| S16 Confidence | Does the engine expose per-word confidence? Word timestamps? | Per-word confidence: **not exposed** by the transformers.js speech pipeline (its output is text plus optional timestamps). Word timestamps: the docs show `return_timestamps: 'word'` for `Xenova/whisper-tiny.en`; **not tested yet**. | Treat confidence as unavailable: `words` stays undefined and is never guessed, so stamps rely on the anchor and field checks. Anchors stay segment-level (3 to 8 s); word timestamps are not relied on. | Nov 12, 2026 |
| S20 Label reading | On-device OCR vs manual entry | | | |
| Drug list | Public source, licence, format | | | |
| Cloud model | Needed at all? Provider, region, cost per consult, daily cap | | | |

## S16 notes

**Library.** `@huggingface/transformers` 4.3.2 (Apache-2.0), API checked Nov 12, 2026 at https://huggingface.co/docs/transformers.js/api/pipelines : `pipeline('automatic-speech-recognition', model, { device, dtype })`, then `transcriber(float32Array16kHz)` returns `{ text }`.

**Where the code is.**
- `engine/src/asr/whisper-adapter.ts`: `WhisperAdapter` (engine, no browser APIs; talks to the worker through a message transport), `cleanWhisperText` (drops markers such as `[BLANK_AUDIO]`).
- `engine/src/asr/mock-adapter.ts`: `MockAdapter` for tests, evals and sample-consult mode; errors when its script runs out instead of inventing text.
- `ui/src/platform/asr-worker.ts`: the Web Worker. Tries WebGPU, falls back to WebAssembly.
- `ui/src/platform/whisper.ts`: `createWhisperAdapter()` starts the worker.
- Silent segments are marked by the segmenter (`hasSpeech: false`) so they are not sent to Whisper, which can produce text from silence.

**Candidate models** (sizes from the Hugging Face API, Nov 12, 2026; both Apache-2.0 per their model cards):

| Model | WebAssembly (`q8`: encoder + decoder) | WebGPU as configured (`fp32` encoder + `q4` decoder) |
|---|---|---|
| `Xenova/whisper-tiny.en` | 10.1 + 30.7 = about 41 MB | 32.9 + 86.7 = about 120 MB |
| `Xenova/whisper-base.en` | 23.2 + 53.7 = about 77 MB | 82.5 + 123.6 = about 206 MB |

(Plus small tokenizer and config files. The WebGPU precision choice is provisional; a smaller WebGPU option such as `fp16` should be compared in the measurement.)

**Still to do before this spike is closed.**
1. A 10-second test clip read by a consenting actor with a signed release (script below), bundled for the Playwright test.
2. A Playwright test that loads the adapter in a browser and transcribes the clip.
3. Latency per 5 s segment on the reference phone, for WebGPU and WebAssembly, and first-load download time. Record the phone model and browser.
4. Decide tiny.en vs base.en from those numbers and a word-accuracy check on the clip.

**Suggested script for the test clip** (about 10 seconds, actors only, no real patient):
"Take metformin, five hundred milligrams, twice daily after food. Come back and see me in three months."
