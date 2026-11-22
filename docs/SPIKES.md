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

**Test clip.** `ui/e2e/fixtures/sample-10s.wav`: 12.8 s, 16 kHz mono, read by Rohan Rashinkar (project owner) from the script "Take metformin, five hundred milligrams, twice daily after food. Come back and see me in three months." Recorded Nov 13, 2026 with Voice Memos, converted with `afconvert`. The WAV has no metadata chunks (checked: only `fmt `, `FLLR`, `data`). The original `.m4a` is kept only in `private/` (gitignored). Written release signed Nov 21, 2026 (docs/RELEASES.md).

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
3. ~~Record the written release for the test clip in `docs/RELEASES.md`.~~ Done Nov 21, 2026.

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

### Medicine names Echo does not know, Nov 18, 2026
The owner said "paracetamol" and the captions showed "paramet" / "baramet". Two causes, two fixes:
- **Prompt:** paracetamol ranked 64th, so it was not in base.en's 40-name prompt. UK/INN names now rank with their US name when that is higher (paracetamol with acetaminophen, 3rd), never lower than before (`scripts/build-drug-list.mjs`). Same 1,755 names; the 850 near-match names are unchanged. Bench, base.en + prompt, 48 clips: name heard exactly 30 → **34**, found 38 → **41**, dose 47 → 47; both paracetamol clips now heard exactly. One clip lost an exact name (prednisolone heard as prednisone, still shown as Check this with "Could also be"). No clip echoed the prompt. Four extra synthetic paracetamol clips (Daniel, Aman, Rishi, Samantha): 4/4 exact with the prompt, up from 2/4.
- **Unknown name before a dose:** "paramet" is too far from paracetamol to match by sound, and a looser match guessed wrong more often than right (bench misses: 15 right, 21 wrong, such as lidocaine for amlodipine), so Echo does not guess. Instead, when a segment has no medicine name, a word right before a dose ("paramet 500 mg", "calpol 5 ml") that is not everyday English is kept as heard and marked as a medicine name Echo does not know. It becomes a medicine line stamped Check this, with the dose kept. Everyday words come from SCOWL size 35 (docs/SOURCES.md) plus a short list of words said before doses ("sorry", "maybe", "breakfast"). Across all 329 eval, red-team and bench segments it flagged 21 words, all misheard medicine names, and no ordinary words. The red-team replay is unchanged (same 6 known invented facts).
- **UI:** captions show a boxed hint after the heard name ("Sounds like metformin?", "Could also be prednisolone?", "Not a medicine name Echo knows"); the recording screen shows a Check this card that says what was heard and to tap Please repeat; each Check this medicine on the receipt says why in plain words and to check the name on the label or with the pharmacist. Sample: `?sample=misheard&demo=1#/doctor-card` (care-11, actors).

## Accuracy work, Nov 21, 2026
Measured before deciding what to keep. All on the M4 laptop, Node CPU, whisper-base.en at 8 bits (the app's WebAssembly setting). Raw outputs are in `private/` (not committed).

### 1. The user's own medicines list (kept)
The user can type the medicines they take (Echo Care, "Your medicines"). Those names go first in Whisper's prompt, and a misheard word can match a listed name more loosely: any first sound, and about a third of the sound key may differ. It is only ever a "Sounds like" suggestion, stamped Check this; the heard word is kept.

**Bench** (`PERSONAL=with|without pnpm --filter @echo/evals exec vite-node src/asr-bench.ts ../private/asr-bench Xenova/whisper-base.en 40`; the 48 synthetic clips, list of 5 names):

| List | Name heard exactly | Name found | Wrong medicine named |
|---|---|---|---|
| No list (as before) | 34/48 | 41/48 | 0/48 |
| Prompt only, medicine on the list | 41/48 | 45/48 | 0/48 |
| Prompt and matching, medicine on the list | 41/48 | **47/48** | 0/48 |
| Prompt and matching, medicine **not** on the list | 34/48 | 41/48 | 1/48 |

The one wrong name when the medicine was not listed is prednisolone heard as "Prednisone": a real medicine, so it is still marked Check this with "Could also be prednisolone?". The only miss left with the list is "Drinepiride" (glimepiride).

**Text replay** (`private/asr-bench/personal-check.ts`): on 238 saved speech-engine transcripts from earlier runs, names found went from 182 to 205 with the medicine listed. Wrong names stayed at 3. One new wrong name appeared when the medicine was not listed: chlorpheniramine suggested for "Lichlorfenamine" (chlorphenamine). Across 145 eval segments, a 54-name list added no medicine name anywhere. The first version matched "dove sat in" to atorvastatin; joined words may no longer start with an everyday English word, and a unit test keeps it.

### 2. Different first sound against the whole list (rejected)
Allowing a different first sound for the full common-medicine list would recover 7 to 10 names in the replay but suggest 6 wrong real medicines, for example felodipine for "lodipine" (amlodipine) and lovastatin for "dovastatin" (atorvastatin). A wrong real medicine is worse than "Not a medicine name Echo knows", so this stays off. The personal list recovers those same names safely.

### 3. Other ways of saying how often (kept)
"When you need it", "if needed", "as required", "as and when", "every morning", "in the evening", "at bedtime" and "daily" on its own are now read as frequencies; the live captions and the label check share one "as needed" list. This fixed the only missed field in the evals (care-04, "two puffs, when you need it"). It also exposed a hazard, which was fixed in the same change: once "in the evening" was read, red-team attack 13 ("warfarin five milligrams every other day, in the evening") would have become a daily evening dose. "Every other day", "every N days", "once a week" and "N times a week" are now counted first, and attack 13 runs in every `pnpm evals`.

### 4. "Two" heard as "to" (kept)
The bench clip "two puffs when needed" came back as "to puffs". After take, use, inhaler, puffer or spray, "to" or "too" before tablets, capsules, puffs, drops or sprays is now flagged as an unclear dose: the caption says "Sounds like 2 puffs?", Echo asks for a repeat, and the medicine line is Check this. The dose is never filled in from it, and "switch you to tablets" is left alone.

### 5. Real voice, and a prompt per conversation type (kept)
`pnpm --filter @echo/evals exec vite-node src/real-voice.ts` runs the owner's five recordings of the sample scripts (23 segments, 296 words, one speaker, a quiet room) through the app's speech set-up and the same scoring as `pnpm evals`. The scorer now treats "$3,800" and "3800 dollars", "12%" and "12 percent", "500mg" and "500 milligrams" as the same value (unit tests in `evals/src/harness.test.ts`; different amounts or units still disagree).

| Prompt | Word error rate | Facts kept | Invented |
|---|---|---|---|
| Medicine names for every recording (before) | 14.5% | 15/18 | 2 |
| Medicine names for Echo Care, sales words for Echo Cover (now) | **13.2%** | **18/18** | **0** |
| Same, plus the Care recordings' medicines on a personal list | 12.8% | 18/18 | 0 |

With the medicine prompt, "for the pair" was heard as "for the bear" and "for the pay", and "every sale" as "every cell", so two prices lost their "per pair" and two commission sentences were garbled. Echo Cover's schema now names its own `speechWords` (hearing aids, pair, per aid, fitting, follow-up, warranty, trial, refund, finance, interest, monthly, commission, salary, sale), which replace the medicine prompt for that conversation type.

**Prompt echo check** (`private/actor-audio/prompt-echo.ts`): each prompt was run on near-silence (the five recordings' lead-ins, three noise levels, digital silence). The first sales prompt was a phrase ("the price for the pair, ...") and on one lead-in Whisper wrote "The price for the pair is $100,000.", which would have become a price nobody said. As a plain word list ("Words: hearing aids, pair, ...") it wrote no sales words on any of the 9 clips, and the medicine prompt wrote no medicine names. So `speechWords` must be a list of plain terms; the schema loader rejects punctuation and any entry longer than three words.

**Limits:** one speaker, a quiet room, scripts the speaker wrote, 5 recordings. This is a regression check, not an accuracy claim for real visits.

## Word timestamps and per-word confidence, Nov 22, 2026 (spike closed: not adopted)
**Question:** can transformers.js give word times and word confidence, and does low confidence mark misheard medicine names?

**Method:** `private/asr-bench/confidence.ts` used `onnx-community/whisper-base.en_timestamped` (q8, Node CPU) on the 48 bench clips with the medicine prompt. A custom logits processor records the probability of each token greedy decoding picks; a word's confidence is the lowest of its tokens. `return_token_timestamps` gives start times.

**What works:** both signals come out of the existing `generate()` call with the prompt, so the plumbing is possible.

**Why it is not used:**
- **Medicine names are always uncertain.** A correctly heard name usually scores low: furosemide 0.12, clopidogrel 0.13, warfarin 0.22, pantoprazole 0.18, against misheard names at 0.03 to 0.10.
  - Splitting at 0.11 would have separated this sample, but the margin is 0.02 on 48 clips.
  - Some misheard names score higher than correct ones ("Blamepyride" 0.37, "Chlorphenyramine" 0.25).
- **Low scores often mean a choice of spelling, not a mishearing.** "milligrams" scores 0.35 to 0.6 because Whisper hesitates between "mg" and "milligrams". "three" scores 0.50 for the same reason ("3" or "three").
- **Over all words, the trade-off is poor.** At a 0.3 cut-off, 14 of 37 misheard words and 9 of 249 correct words are flagged. At 0.5, the counts are 28 of 37 and 39 of 249.

Flagging that many words, mostly medicine names that were heard correctly, would work against the research on deaf and hard-of-hearing users. They benefited from highlighting a few key words, and reacted poorly to confidence markup across the whole caption (see the research report).

**Decision:** keep the current safety signals. These are sound-alike and unknown-name checks, the two-value conflict rule, and "Please repeat". Word-level confidence stays undefined, and Echo never guesses it. Revisit if a calibrated method appears, for example comparing two models on flagged segments.

## Speech check with Silero VAD, Nov 22, 2026 (adopted)
`private/actor-audio/vad-check.ts` ran the inputs below through the engine's Segmenter, then Silero VAD v6 (MIT, 2.3 MB, onnxruntime):
- the owner's five recordings, with their lead-ins;
- synthetic non-speech: cough-like bursts at three levels, a clap, door knocks, and a fan hum at two levels.

| | Non-speech segments sent to Whisper | Speech segments held back |
|---|---|---|
| Energy gate (before) | 11 (all 5 lead-ins, 3 bursts, clap, knocks, the louder hum) | 0 of 24 |
| Energy gate, then Silero (now) | **0** | **0 of 24** |

Speech segments scored 48% to 91% speech frames; non-speech scored 0%. The rule is at least 5 speech frames (160 ms). This matters because Whisper wrote words on exactly these sounds: "Thank you." on lead-ins and, with a sentence-like prompt, a made-up price.

The check runs in the speech worker before Whisper, so non-speech also saves Whisper time on the phone. The model is cached with the speech runtime. If the model cannot load, the worker falls back to the energy gate, and the real-worker browser test asserts that it did load.

**Limits:** the non-speech sounds are synthetic, and real clinic noise (other voices, a television) is not tested. A second person talking is speech, so it still goes to Whisper.

## Real doctor speech: PriMock57, Nov 22, 2026
**Data:** [PriMock57](https://github.com/babylonhealth/primock57) (Babylon Health, CC BY 4.0). These are mock UK primary-care consultations with separate doctor and patient audio and human transcripts. I used 12 of them: the ones where the doctor names medicines from Echo's list (`evals/src/primock-pick.ts`). That is 114 minutes of doctor-channel audio from several clinicians. The data stays in `private/primock57/` and is used for evaluation only, never in the demo.

**Method:** `pnpm --filter @echo/evals exec vite-node src/primock.ts` runs the app's live path on the laptop CPU:
- Segmenter, 3 to 8 s.
- Silero speech check.
- whisper-base.en at 8 bits with the medicine prompt.
- The second hearing (below).
- The doctor-visit pipeline.

The human transcript goes through the same pipeline. Echo's facts from the human transcript are the reference, so this measures what real speech recognition costs Echo, with no hand-made answers. Numbers only are kept in `evals/primock-results.json`.

**Results, as shipped:**

| Measure | Result |
|---|---|
| Word error rate, doctor channel | 36.5% (38.0% without the speech check). Published figures for this data are about 31% for Google and Azure, with a different normalisation |
| Medicine names said (exact, per consultation) that Echo showed | 27 of 37 |
| Names Echo showed that the doctor never said | 6, all shown as "Sounds like …?" or as a sound-alike |
| Medicine facts from the human transcript also built from speech | 30 of 46; 27 of those with every field agreeing |
| Extra medicine facts (no counterpart) | 6, **all stamped Check this** |
| Wrong medicine stamped Heard clearly | **0** |
| Speech check | 161 of 1,223 energy-gate segments skipped. At most 27 of 11,123 transcript words fell in skipped segments |

**What the real speech found, and what changed:**
1. **Ordinary words in the medicine list.**
   - Found: "treated", "dehydrated", "purified", "depleted", "aggregated" and "engineered" came from FDA substance names, so "you're dehydrated" counted as naming a medicine.
   - Fix: the list builder drops forms of everyday words, and a test checks the list (1,755 to 1,749 names).
2. **Ordinary words joined into medicines.**
   - Found: "try that in" became tretinoin. "Racing at", "moment and", "pretty as", "recommend it" and "notes on" also became medicines; "notes on" even became a medicine fact.
   - Fix: a join of words that are all everyday English is never matched. Names shown that the doctor never said dropped from 12 to 6 (one more was a scoring artifact).
   - Cost: three saved bench transcripts that were only recovered through such joins ("Listen April" for lisinopril, "Setter is in" for cetirizine). With no name heard, these now get the "dose heard without a medicine name" repeat prompt.
3. **The prompt wrote a different medicine.**
   - Found: the doctor said "antihistamines like cetirizine", and the segment ended mid-word. The prompted pass wrote "antistamins like acetaminophen", an exact, common name from the prompt, stamped Heard clearly.
   - Fix, a second hearing: when the prompted text has an exact medicine name, the worker hears the same audio again without the prompt. Each name must sound like something in that second hearing (`confirmsName`: one to three words, sound key within about a third).
   - Results: on PriMock57, 20 of 20 correct names were backed up and the substitution was caught, so the fact is Check this with "a second listen did not hear it clearly". On the 48-clip bench, 33 of 34 correct names were backed up.
   - Cost: one extra decode only on segments with a medicine name (18 in 114 minutes). On the 10-second browser clip, the medicine segment took 1.8 s against 1.0 s for the other.

**Still open:**
- **The 8 s cut splits words.** "cetirizine" was cut across two segments.
- **Garbled names give wrong "Sounds like" suggestions:**
  - "hydrochlorothiazone" suggested hydrochlorothiazide when the doctor said hydrocortisone;
  - "Metorizin" suggested metolazone for cetirizine.
  - These are Check this, but the suggested name is wrong.
- **Missed names:** clindamycin, nitrofurantoin and trimethoprim were missed in one noisy consultation (48% WER).
- **Limits:** UK accents, mostly younger speakers and telemedicine audio. This is one dataset, not a clinic.
