# Spikes (fill as each is done; Kiro writes the decision)

| Spike | Question | Result | Decision | Date |
|---|---|---|---|---|
| S16 Speech | Model, download size, latency per 5 s segment on the reference phone, WebGPU vs WebAssembly | **Laptop measured, phone not yet.** On an Apple M4 MacBook Air, `whisper-tiny.en` in headless Chromium (WebAssembly, cross-origin isolated) took about 320 to 590 ms per 5 s of audio; model load about 25 s from a warm cache. Download about 41 MB (WebAssembly). Heard numbers, frequency and follow-up correctly; **misheard the drug name** ("metformin" as "meriforming"). | Provisional: `Xenova/whisper-tiny.en` on WebAssembly. `whisper-base.en` was no better on the drug name in this clip and is about 2x slower. **Open until the reference phone is measured.** | Nov 13, 2026 (laptop) |
| S16 Confidence | Does the engine expose per-word confidence? Word timestamps? | Per-word confidence: **not exposed** by the transformers.js speech pipeline (text plus optional timestamps only). Word timestamps: documented (`return_timestamps: 'word'`), not tested. | Treat confidence as unavailable: `words` stays undefined and is never guessed. Anchors stay segment-level (3 to 8 s); word timestamps are not relied on. | Nov 12, 2026 |
| S20 Label reading | On-device OCR vs manual entry | **Not spiked.** tesseract.js was not tried: it needs a further language-data download, and its accuracy on small, curved pharmacy labels is unknown. | v1 uses manual entry: the user can take a photo to look at while typing the three fields (medicine, dose, how often) and confirms them; the photo is shown from memory only and never stored (tested). OCR can be added later behind the same form. | Nov 13, 2026 |
| Drug list | Public source, licence, format | | | |
| Cloud model | Needed at all? Provider, region, cost per consult, daily cap | | | |

## S16 notes

**Library.** `@huggingface/transformers` 4.3.2 (Apache-2.0), API checked Nov 12, 2026 at https://huggingface.co/docs/transformers.js/api/pipelines : `pipeline('automatic-speech-recognition', model, { device, dtype })`, then `transcriber(float32Array16kHz)` returns `{ text }`.

**Where the code is.**
- `engine/src/asr/whisper-adapter.ts`: `WhisperAdapter` (no browser APIs; talks to the worker through a message transport) and `cleanWhisperText`.
- `engine/src/asr/mock-adapter.ts`: `MockAdapter` for tests, evals and sample-consult mode.
- `ui/src/platform/asr-worker.ts`: the Web Worker. Asks for a WebGPU adapter first and only then loads WebGPU weights; otherwise WebAssembly.
- `ui/e2e/spike/`: the spike page (also used on the phone). `ui/e2e/tests/asr.spec.ts`: the Playwright Verify.
- `evals/src/spike-asr.ts` (`pnpm --filter @echo/evals spike:asr [wav] [model] [dtype]`): the same measurement in Node.

**Test clip.** `ui/e2e/fixtures/sample-10s.wav`: 12.8 s, 16 kHz mono, read by Rohan Rashinkar (project owner) from the script "Take metformin, five hundred milligrams, twice daily after food. Come back and see me in three months." Recorded Nov 13, 2026 with Voice Memos, converted with `afconvert`. The WAV has no metadata chunks (checked: only `fmt `, `FLLR`, `data`). The original `.m4a` is kept only in `private/` (gitignored). **A written release for this recording is still needed** (see the end of this file).

### Measurements, Nov 13, 2026

Machine: Apple M4 MacBook Air (Mac16,12), 24 GB RAM, macOS. One run each, warm model cache unless noted, so treat the numbers as rough.

The Segmenter split the clip into "Take [drug] 500 milligrams." (0 to 4.86 s) and "twice daily after food. Come back and see me in three months." (4.86 to 12.54 s), plus a short silent tail that was not transcribed.

| Run | Model | Where | Per segment | Per 5 s of audio | Load |
|---|---|---|---|---|---|
| Browser, isolated | tiny.en q8 | Headless Chromium 158, WebAssembly, `crossOriginIsolated: true` | 573 ms, 489 ms | 590 ms, 318 ms | 24.7 s |
| Browser, not isolated | tiny.en q8 | Same, `crossOriginIsolated: false` (single thread) | 1095 ms, 1040 ms | 1127 ms, 677 ms | 43.0 s |
| Node | tiny.en q8 | onnxruntime-node, CPU | 275 ms, 310 ms | 283 ms, 202 ms | 16.5 s (first run, includes download) |
| Node | base.en q8 | onnxruntime-node, CPU | 493 ms, 391 ms (whole-clip run on the old 8 s cut) | 308 ms, 411 ms | 52.3 s (first run, includes download) |

WebGPU was not measured: headless Chromium reported no GPU adapter, so the worker fell back to WebAssembly as designed.

**What each model heard.**
- tiny.en (browser): "Take meriforming 500 milligrams. twice daily after food. Come back and see me in three months."
- tiny.en (Node, whole clip): "Take merforming 500 milligrams twice daily after four. Come back and see me in three months."
- base.en (Node, whole clip): "take my reforming 500 milligrams twice daily after food come back and see me in three months"

**Findings.**
1. Numbers, frequency, food timing and the follow-up came through. The drug name did not, in either model. With the edit-distance-1 near match, the misheard name was not flagged at all, so no medicine fact came out of this clip. **Fixed Nov 13 (both options):**
   - Names of 8 or more letters now near-match at up to about 30% edit distance when the first letter matches, and a name split in two ("merform in") is tried joined. The heard word is kept, the fact is stamped Check this, and common English words are tested not to match. The clip now gives "meriforming, 500 milligrams, twice daily", stamped Check this, with suggestion "metformin".
   - The session raises a "Please repeat" `prompt` event when a word only sounds like a drug, or when a dose with a unit is heard with no drug name in that segment or the one before.
2. Cross-origin isolation (COOP/COEP headers) roughly halves WebAssembly time. The apps' hosting must send these headers (Step 30).
3. The first real recording exposed two Segmenter problems: it cut mid-sentence at 8 s, because exact-zero samples at the start of the file dragged the noise floor to 0, and quiet speech was classed as silence. Both are fixed with tests. The clip now cuts at the speaker's pause after "milligrams".
4. On a laptop, transcription runs well under real time (about 0.1x). Whether the phone keeps up is the open question.

**Still to do before this spike is closed.**
1. Run the spike page on the reference phone and fill in the table: `pnpm --filter @echo/ui spike:asr` (serves on the Wi-Fi network), open the printed Network URL plus `/spike/` on the phone, wait for "Done", and copy the JSON. Phones block workers and cross-origin isolation on plain `http://` from another device, so the phone run may need an HTTPS tunnel or a deployed preview; to be confirmed when tried.
2. Decide tiny.en vs base.en from the phone numbers.
3. Record the written release for the test clip in `docs/RELEASES.md`.
