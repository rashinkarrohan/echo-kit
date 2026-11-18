# Spikes (fill as each is done; Kiro writes the decision)

| Spike | Question | Result | Decision | Date |
|---|---|---|---|---|
| S16 Speech | Model, download size, latency per 5 s segment on the reference phone, WebGPU vs WebAssembly | **Laptop measured, phone not yet.** On an Apple M4 MacBook Air, `whisper-tiny.en` in headless Chromium (WebAssembly, cross-origin isolated) took about 320 to 590 ms per 5 s of audio; model load about 25 s from a warm cache. Download about 41 MB (WebAssembly). Heard numbers, frequency and follow-up correctly; **misheard the drug name** ("metformin" as "meriforming"). | Provisional: `Xenova/whisper-tiny.en` on WebAssembly. `whisper-base.en` was no better on the drug name in this clip and is about 2x slower. **Open until the reference phone is measured.** | Nov 13, 2026 (laptop) |
| S16 Confidence | Does the engine expose per-word confidence? Word timestamps? | Per-word confidence: **not exposed** by the transformers.js speech pipeline (text plus optional timestamps only). Word timestamps: documented (`return_timestamps: 'word'`), not tested. | Treat confidence as unavailable: `words` stays undefined and is never guessed. Anchors stay segment-level (3 to 8 s); word timestamps are not relied on. | Nov 12, 2026 |
| S20 Label reading | On-device OCR vs manual entry | **Not spiked.** tesseract.js was not tried: it needs a further language-data download, and its accuracy on small, curved pharmacy labels is unknown. | v1 uses manual entry: the user can take a photo to look at while typing the three fields (medicine, dose, how often) and confirms them; the photo is shown from memory only and never stored (tested). OCR can be added later behind the same form. | Nov 13, 2026 |
| Drug list | Public source, licence, format | FDA NDC Directory (public domain, CC0). 1,755 generic names; misheard names matched only to the 850 most-listed. | Use it (see S16 accuracy notes below). Brand names and India-specific names not included; ask before adding. | Nov 13, 2026 |
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

## S16 medicine-name accuracy, Nov 13, 2026
Live test by the owner showed a spoken medicine name captured as "Glory Fiend", "Glorofing", "Global", and "a medicine" wrongly flagged as amlodipine. Work done:
1. **Whisper prompt.** The worker gives Whisper the most common medicine names as a text prompt (about 40 names, 200 tokens, from `drugs.json` ranking) and strips it from the output. `?prompt=0` turns it off.
2. **Default model base.en** instead of tiny.en (`?model=tiny|base|small` to choose).
3. **Full drug list** (FDA, above) instead of 30 sample names.
4. **Sound-alike matching** (`engine/src/guard/drug-match.ts`): sound-key plus spelling distance, names split over 2 or 3 words joined, an English guard so ordinary words are not taken for medicines, function words never joined ("a medicine" fixed). Exact names that sound like another medicine (prednisone, prednisolone) are stamped Check this.

**Bench** (`evals/src/asr-bench.ts`): 24 sentences, each a medicine with a dose, read by two macOS system voices (Daniel en-GB, Aman en-IN), 48 clips, Node CPU, q8. Synthetic voices are cleaner than real speech, so real-world results will be lower. "Found" = the engine shows the right name, exactly or as "sounds like".

| Model | Prompt | Name exactly right | Name found (incl. sounds like) | Dose number right |
|---|---|---|---|---|
| tiny.en | no | 3/48 | 23/48 | 44/48 |
| tiny.en | yes | 23/48 | 38/48 | 46/48 |
| base.en | no | 18/48 | 32/48 | 45/48 |
| base.en | yes | 30/48 | 38/48 | 47/48 |
| small.en | yes | 34/48 | 41/48 | (not re-measured) |

**Risk found:** the prompt can turn a real name into a different prompted name (prednisolone heard as "prednisone", 2 clips with tiny.en). That is why exact names with sound-alikes are now Check this.
**Owner's clip in the browser** (base.en + prompt, headless Chromium, WebAssembly): "Take metformin 500 milligrams. Twice daily after food, come back and see me in three months." Model load about 42 s (first run), about 0.7 to 1.2 s per 5 s of audio on the M4 laptop: about 2x tiny.en. Phone speed is still unmeasured.
**Not fixed:** names Whisper turns into ordinary English words ("water in" for warfarin, "search align" for sertraline) are not recovered; the English guard deliberately blocks those. small.en is more accurate but about 250 MB and about 3x slower than base.en.

### Model comparison, Nov 13, 2026 (same 48 clips, Node CPU on the M4 laptop)
"Found" = engine shows the right medicine, exactly or as "sounds like". Times are total seconds for the run (both plain and prompted passes where a prompt applies), so compare them only roughly.

| Model | Licence | Download (quantised) | Runs in our browser stack | Prompt | Name exact | Name found | Dose right |
|---|---|---|---|---|---|---|---|
| whisper-tiny.en | Apache-2.0 | ~41 MB | yes | yes | 23 | 38 | 46 |
| whisper-base.en (default) | Apache-2.0 | ~77 MB | yes | yes | 30 | 38 | 47 |
| whisper-small.en | Apache-2.0 | ~250 MB | yes | yes | 34 | 41 | not re-measured |
| **whisper-large-v3-turbo** (q8, with `<\|en\|><\|transcribe\|>`) | MIT | ~1 GB (q8) | yes (`?model=turbo`) | no (see below) | 37 | **46** unprompted, 45 prompted | **48** |
| distil-small.en | MIT | ~170 MB | yes | no (prompt breaks it: 9/48) | 5 | 32 | 48 |
| moonshine-base | MIT | ~60 MB | yes | not supported | 9 | 28 | 46 |
| parakeet-tdt-0.6b-v2 (int8, onnx-asr) | CC-BY-4.0 | ~660 MB | no (needs a different runtime) | not supported | 24 | 39 | 48 |

Speed: Parakeet was by far the fastest (48 clips in 9.7 s, about 0.2 s each); large-v3-turbo the slowest on CPU (about 4 s per clip), so it needs WebGPU to keep up. Not tried: Google MedASR (medical model; Health AI Developer Foundations terms, gated download, needs the owner to accept the terms; its own docs say it can struggle with non-standard medication names).
Misses common to the best models are names turned into ordinary words: "low satan" (losartan), "a dovestatin" (atorvastatin), "water in" (warfarin), "search aligned" (sertraline). No model reached 48/48.

### large-v3-turbo in the app, Nov 12, 2026
The first turbo bench row was wrong about settings: the bench loaded 8-bit weights (hard-coded) and gave no language tokens, while the app used 4-bit. The bench now uses the requested precision and the same tokens as the app. Owner's real clip (sample-10s.wav), Node CPU:

| turbo settings | Heard |
|---|---|
| q4, language tokens, prompt | "Take merifoamin, 500 mg. Twice daily after four." |
| q4, language tokens, no prompt | "Take merformin 500 milligrams." (shown as "sounds like metformin") |
| q8, language tokens, prompt | "Medicines, metformin, 500 mg. Lentia, diapositeam, diapositeam, …" (prompt echoed, then a loop) |
| q8, language tokens, no prompt | "Take metformin 500 milligrams. twice daily after four." |
| base.en, prompt (default) | "Take metformin 500 milligrams. Twice daily after food" |

So in the app turbo runs at 8-bit with no medicine prompt. In headless Chromium (WebAssembly) the same setting heard "Tech merforamines 500 milligrams": not found, so it shows as an ordinary word. Load about 79 s cached, about 14 s per segment. Browser and Node results differ for the same weights, and a prompted turbo can repeat the prompt as if it were speech, so **base.en stays the default** and turbo is opt-in (`?model=turbo`). 8-bit on WebGPU and turbo on a phone are not measured.
