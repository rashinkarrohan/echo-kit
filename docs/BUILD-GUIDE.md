# Echo Kit: step-by-step build guide for Kiro

> **History note (Nov 22, 2026).** This is the plan the project was built from, kept as a record of the spec-driven process. The steps reference two planning items that are not in the repo:
> - **The planning PRD.** Its data model lives in `engine/src/types.ts`, and its features in `.kiro/specs/` and docs/SPEC-SEED.md.
> - **The `seed/` starter files.** These were schemas, a sample drug list and four test conversations, all in the first commit (`523680d`). They were copied into place in Steps 1 and 14, and the superseded copies were removed.

All development uses Kiro only. This guide turns the PRD into ordered steps. Kiro must do **one step at a time**, in order, and must not start the next step until the current step's **Verify** command passes and the work is committed.

## How to run this guide in Kiro
1. Open the repo in Kiro. Steering files in `.kiro/steering/` load automatically.
2. Tell Kiro: "Read `.kiro/steering/`, `docs/PRD.md` and `docs/BUILD-GUIDE.md`. Run Step 0 only. Stop when Verify passes and report."
3. For each next step, paste the **Kiro prompt** for that step. Each step maps to a task in `.kiro/specs/echo-engine/tasks.md`, `echo-care/tasks.md` or `echo-cover/tasks.md`; tick the task when done.
4. Commit after every step with the message `S<number>: <title>`.
5. If a step is ambiguous or an open decision blocks it, Kiro stops and asks. Kiro never invents a source, a licence, a claim or a checklist item.

## Seeds and appendices (Kiro reads these; do not invent what they already specify)
- `seed/` mirrors the repo: copy `seed/apps/echo-care/schemas/*`, `seed/apps/echo-cover/schemas/*`, `seed/engine/data/drugs.sample.json` and `seed/evals/consults/*` into place in Step 1 and Step 14.
- `docs/appendix/DETECTOR-SPEC.md`: cue syntax, detector patterns and test vectors (Steps 2, 4, 5, 6, 9).
- `docs/appendix/DESIGN-TOKENS.md`: colours (contrast checked), type scale, motion rules (Step 18).
- `docs/appendix/UI-SPEC.md`: every screen, the final copy deck, states and definition of done (Steps 18 to 23).
- Schema rules: a checklist item's `sourceUrl` is either `user-planned` (the patient's own question) or a URL; items with `verified: false` are rejected in release builds until the source has been opened and recorded in docs/CLAIMS.md.

## Stack and conventions (fixed; do not change without asking)
- Language: TypeScript (`strict: true`, no `any`). Package manager: pnpm workspaces. Node 20+.
- Tests: Vitest; property-based tests with fast-check; browser tests with Playwright and `@axe-core/playwright`.
- Apps: Vite + React (PWA-capable). Engine: framework-free TypeScript. Schemas: YAML parsed with `yaml`.
- Local storage: IndexedDB through `idb`. Speech on device: `@huggingface/transformers` (Whisper) in a Web Worker, WebGPU with a WebAssembly fallback (confirm exact API in Step 16). Label OCR: `tesseract.js` (decision in Step 20).
- Repo layout:
```
engine/            @echo/engine   pure TypeScript: all logic, no DOM, no network
ui/                @echo/ui       React components and design tokens shared by both apps
apps/echo-care/    echo-care      Vite app, schemas: doctor-visit, pharmacy-counter
apps/echo-cover/   echo-cover     Vite app, schema: hearing-aid-sale
evals/             @echo/evals    scripted consults, runner, results.json
mcp-eval/          eval MCP server (Step 25)
proxy/             optional serverless proxy with spend cap (Step 29)
.kiro/             steering, hooks, specs (never in .gitignore)
docs/              PRD, build guide, claims, evidence, sources, privacy
```
- Rules for code: `engine/` never imports from `ui/` or `apps/`; apps never copy engine code; no network calls in `engine/`; every exported function has a test; errors are returned as `Result` values in `engine/`, never thrown (except the consent gate, which throws by design).
- Commands (create them in Step 0): `pnpm install`, `pnpm test` (all packages), `pnpm --filter @echo/engine test`, `pnpm evals`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter echo-care dev`, `pnpm --filter echo-cover dev`.

---
# PHASE A: setup and types

## Step 0: Repo and tooling
**Goal:** an empty but green workspace.
**Do:** create `pnpm-workspace.yaml` (engine, ui, apps/*, evals), root `package.json` scripts from the list above, `tsconfig.base.json` (strict), ESLint, Prettier, Vitest config, a CI workflow that runs `pnpm lint typecheck test evals` and **fails if `.kiro` appears in `.gitignore`**, a root `LICENSE` (open-source), `.gitignore` containing `private/` but not `.kiro`.
**Verify:** `pnpm install && pnpm lint && pnpm typecheck && pnpm test` all pass (zero tests is fine).
**Kiro prompt:** "Run Step 0 of docs/BUILD-GUIDE.md only. Create the workspace, tooling, CI check for .kiro, and commands. Do not write feature code."

## Step 1: Types and schema loader
**Goal:** the data model exists and schemas load and validate.
**Do:** in `engine/src/types.ts` define exactly the types in the PRD "Data model and interfaces" (ConsentRecord, WordConf, Segment, FlaggedToken with kinds number|drug|frequency|date|money|percent|duration|commission, Anchor, Stamp, Fact, ChecklistItem, ChecklistResult, ConversationSchema with `detectors`, ReadBackItem, LabelFlag, Receipt, QuoteRecord, EntityDetector, AsrAdapter, Extractor, RawFact, Rejected, Result). In `engine/src/schema/` write `loadSchema(yamlText): Result<ConversationSchema>` and `validateSchema`. Schema YAML fields: `id, detectors[], facts[{key,fields[],cues}], checklist[{id,text,sourceUrl,cues}], nextSteps[], disclaimer, skin`. Create three schema files with real structure but placeholder checklist wording marked `TODO-SOURCE`: `apps/echo-care/schemas/doctor-visit.yaml`, `pharmacy-counter.yaml`, `apps/echo-cover/schemas/hearing-aid-sale.yaml`.
**Rule:** `validateSchema` rejects any checklist item without a `sourceUrl` (the literal `user-planned` is allowed), and with `--release` rejects any item whose `verified` is `false`. Add the optional `verified?: boolean` field to `ChecklistItem` and note it in the PRD.
**Tests first:** loads a valid schema; rejects missing sourceUrl; rejects unknown detector id.
**Verify:** `pnpm --filter @echo/engine test`.
**Kiro prompt:** "Run Step 1. Define the types from the PRD exactly, write loadSchema and validateSchema with tests first, create the three schema files with TODO-SOURCE placeholders."

---
# PHASE B: engine logic (pure functions, test-first)

## Step 2: Text normalisation
**Goal:** one canonical way to normalise text for checking.
**Do:** `engine/src/text/normalise.ts`: `normaliseText(s)`: lowercase; strip punctuation except `% . $ £ €` and digits; collapse whitespace; convert number words to digits (zero to nineteen, tens, "hundred", "thousand", "a hundred", "half"); never merge "fifty" and "fifteen". `numberWordsToDigits`. Keep the original text elsewhere for display.
**Properties (fast-check):** idempotent (`normalise(normalise(x)) === normalise(x)`); "fifty" and "fifteen" give 50 and 15; digits already present are unchanged.
**Verify:** `pnpm --filter @echo/engine test text`.
**Kiro prompt:** "Run Step 2. Write the property tests first (idempotence, fifty vs fifteen), then normaliseText."

## Step 3: Segments and time utilities
**Do:** `engine/src/segments.ts`: `makeSegment(index, startMs, endMs, text)` creating ids `seg-0001`; `assertOrdered(segments)` returns Result (no overlaps, increasing times); `segmentsText(segments)` joins normalised text with single spaces; `rangeOf(segmentIds, segments)` returns start/end.
**Property PB9:** generated ordered segments always pass `assertOrdered`; any overlap fails.
**Verify:** `pnpm --filter @echo/engine test segments`.

## Step 4: Entity detectors for Echo Care
**Do:** `engine/src/guard/care-detectors.ts` and `flagTokens(segment, detectors, dictionary)` in `guard/index.ts`.
- number: digits with optional unit (mg, mcg, g, ml, units, tablets, capsules, drops, puffs) and bare numbers.
- frequency: once/twice/three/four times (a day|daily), every N hours, morning, night, as needed, before/after food, with a canonical form (`1/day`, `2/day`, `3/day`, `4/day`, `prn`).
- date: tomorrow, next week, weekday names, month names, "in N days/weeks".
- drug: match against `engine/data/drugs.sample.json` (about 30 common generic names; mark `"sample": true`); a near match at edit distance 1 produces `suggestion` but never replaces the heard text.
- `lowConfidence` is set only if the word confidence is present and below 0.6; otherwise false.
**Property PB6:** for generated sentences containing planted numbers, frequencies, dates and drugs, every planted token appears in the flagged output.
**Verify:** `pnpm --filter @echo/engine test guard`.
**Kiro prompt:** "Run Step 4. Write PB6 first. Implement Care detectors and flagTokens. Do not auto-correct any token."

## Step 5: Entity detectors for Echo Cover
**Do:** `guard/cover-detectors.ts`: money (currency symbols or words with amounts, "per month"), percent (`%`, "percent", "per cent"), duration (days, weeks, months, years, "trial", "return period"), commission (commission, incentive, bonus, kickback wording). Register by id in a detector registry; schemas name which ids they enable.
**Property:** same completeness property as PB6 for Cover tokens.
**Verify:** `pnpm --filter @echo/engine test guard`.

## Step 6: Rules extractor
**Goal:** deterministic extraction with no model.
**Do:** `engine/src/extract/rules-extractor.ts` implementing `Extractor`. For each schema fact, use its `cues` to find a window (default 25 words) in the joined transcript and fill fields from detector output: Care `medicine` = drug + dose + frequency (+ duration); `follow_up` = cue words (come back, follow up, review, next appointment) + date; `warning_sign` = cue phrases (if you, call, emergency, hospital, urgent) + the clause. Cover facts: `price` (money near price/total/cost), `financing` (percent near interest/APR + money), `trial_returns` (duration near trial/return/refund), `inclusions` (cue words fitting, follow-up visits, warranty), `commission` (commission wording). Each `RawFact` carries a verbatim `quote` copied from the original segment text and the segment ids.
**Tests first:** a scripted line "take metformin five hundred milligrams twice daily after food" yields one medicine fact whose quote is a substring of the transcript.
**Verify:** `pnpm --filter @echo/engine test extract`.
**Kiro prompt:** "Run Step 6. Implement the rules extractor only; do not add any model or network call."

## Step 7: Anchor validator (the core guarantee)
**Do:** `engine/src/validate/validate-fact.ts`: `validateFact(raw, transcript): Fact | Rejected` in plain code. Normalise transcript and quote with `normaliseText`; reject unless the normalised quote is a substring of the normalised joined transcript; compute the `Anchor` (segment ids, start, end); reject if the segments are not contiguous or outside the audio range.
**Properties:** PB1 anchor soundness; PB2 removing/altering a quote invalidates it; PB3 noise invariance (inserting filler words in the transcript never creates new accepted facts); PB4 idempotence; PB5 numeric faithfulness (every number in `fields` appears in the quote).
**Verify:** `pnpm --filter @echo/engine test validate`.
**Kiro prompt:** "Run Step 7. Write PB1 to PB5 first, then validateFact. This must be plain deterministic code with no model."

## Step 8: Verifier
**Do:** `engine/src/verify/verify.ts`: `verifyFacts(facts, transcript): Fact[]` assigns stamps: `heard_clearly` if every field value appears in its quote (normalised) and no flagged token in the quote is `lowConfidence`; otherwise `check_this`. Facts for checklist items not found are never fabricated; they come from the gap check.
**Tests:** a fact with a dose missing from its quote becomes `check_this`; a low-confidence token forces `check_this`.
**Verify:** `pnpm --filter @echo/engine test verify`.

## Step 9: Gap check
**Do:** `engine/src/gap/gap-check.ts`: `runGapCheck(facts, schema, transcript): ChecklistResult[]`. Each checklist item has `cues` (`any`/`all` regex groups). `answered` if all required groups match within a window of at most 3 consecutive segments (anchors attached); `unclear` if some groups match; else `not_discussed`. Never claim a speaker avoided a question.
**Test:** a scripted consult missing one item yields exactly that item as `not_discussed`.
**Verify:** `pnpm --filter @echo/engine test gap`.

## Step 10: Label comparison
**Do:** `engine/src/label/compare.ts`: `canonicalFrequency(text)`; `compareLabel(facts, label): LabelFlag[]` comparing medicine (normalised, case-insensitive), dose (value and unit) and frequency (canonical). Differences are flagged with the spoken value, the printed value and the audio anchor, never with a verdict on which is right.
**Property PB7:** flags depend only on the compared field values (swapping how they were obtained changes nothing).
**Test:** spoken "once daily" vs label "twice daily" yields exactly one flag.
**Verify:** `pnpm --filter @echo/engine test label`.

## Step 11: Quote comparison (Echo Cover)
**Do:** `engine/src/compare/compare-quotes.ts`: `compareQuotes(quotes: QuoteRecord[], fields: string[])` returning per field the value (or null meaning Not discussed) for each seller and a `differs` flag. It never ranks or recommends.
**Property PB11:** reordering conversations gives the same differences; output contains no ranking field.
**Test:** two scripted sales that differ in financing interest, and a third missing the field.
**Verify:** `pnpm --filter @echo/engine test compare`.

## Step 12: Read-back
**Do:** `engine/src/readback/readback.ts`: `buildReadBack(facts): ReadBackItem[]` (heard text such as "metformin 500 mg twice daily"); `applyMark(items, factKey, mark)`; `scoreReadBack(items, userText)` compares numbers and names in the user's spoken or typed answer with the facts. Items are only confirmed by an explicit user mark.
**Property PB8:** an answer identical to the facts matches fully.
**Verify:** `pnpm --filter @echo/engine test readback`.

## Step 13: Consent ledger and local store
**Do:** `engine/src/consent/ledger.ts` and `engine/src/store/store.ts` (IndexedDB via `idb`, with an in-memory implementation for tests). `ConsentLedger.grant(purpose, wordingVersion)`, `withdraw(purpose)`, `has(purpose)`, `assertConsent(purpose)` (throws if missing). `store.saveReceipt`, `getReceipt`, `deleteSession(id)` (deletes audio, transcript, receipt). Consent wording: all-party wording everywhere.
**Property PB10:** capture start fails without a matching consent record; withdrawal deletes the session's data.
**Verify:** `pnpm --filter @echo/engine test consent store`.

## Step 14: Eval harness
**Do:** `evals/` with `consults/*.json` (format: `{id, app, schemaId, segments:[{id,startMs,endMs,text}], planted:[{key,fields}], plantedGapItemIds:[]}`), `src/run.ts` running the full pipeline from segments (no audio): flag tokens, extract, validate, verify, gap check. Metrics: facts kept, dropped, **invented** (accepted facts not matching a planted fact), **unanchored** (must be 0 by construction), flagged-token recall, checklist accuracy, runs. Write `evals/results.json`. Exit code 1 if invented > 0 or unanchored > 0. Add a `--break` flag that swaps in a deliberately broken extractor to prove the run fails. Start from the four finished seeds in `seed/evals/consults/` (care-01, care-02, cover-01, cover-02) and write the remaining 11 (8 Care, 3 Cover) following `seed/evals/consults/README.md`. The harness also checks that every planted quote is a verbatim substring of its transcript, and runs the label and comparison expectations.
**Verify:** `pnpm evals` exits 0; `pnpm evals --break` exits non-zero.
**Kiro prompt:** "Run Step 14. Build the harness and the 15 scripted consults. Prove `--break` fails the run."

---
# PHASE C: browser input and output

## Step 15: Audio capture and segmenter
**Do:** `engine/src/audio/segmenter.ts` (pure): `Segmenter.push(frame: Float32Array, tMs)` returns completed segments; rules: minimum 3000 ms, maximum 8000 ms, cut at the first silence of at least 300 ms after the minimum, otherwise at the maximum; adaptive energy threshold. `apps/*` use a shared `ui`/`engine` browser module `capture.ts`: `getUserMedia` with echo cancellation and noise suppression, an AudioContext at 16 kHz (resample if unsupported), an AudioWorklet collecting frames. **Capture calls `assertConsent('record')` first.**
**Tests:** synthetic signals (speech-like bursts and silence) produce segments of 3 to 8 seconds, ordered, non-overlapping.
**Verify:** `pnpm --filter @echo/engine test audio`.

## Step 16: Speech adapter and latency spike
**Do:** `engine/src/asr/whisper-adapter.ts` implementing `AsrAdapter` with `@huggingface/transformers` in a Web Worker; try `device: 'webgpu'`, fall back to wasm; a `MockAdapter` for tests and evals. Write `docs/SPIKES.md` recording: model chosen and download size, latency per 5-second segment on the reference phone, whether per-word confidence or word timestamps are available (assume not), and a decision. Confirm the library's current API from its docs before coding.
**Verify:** a Playwright test loads the adapter in a browser and transcribes a bundled 10-second sample; latency is recorded in `docs/SPIKES.md`.
**Kiro prompt:** "Run Step 16. Check the library documentation first, implement the adapter and MockAdapter, and write the spike results. If confidence is unavailable, say so."

## Step 17: Live session pipeline
**Do:** `engine/src/session/session.ts`: `ConversationSession` orchestrating capture → adapter → captions (events) → flagged tokens (events) → on stop: extract → validate → verify → gap check → `Receipt` → store. Events: `caption`, `flags`, `receipt`, `error`. No UI here.
**Test:** with `MockAdapter` and synthetic segments, a full session produces a receipt identical to the eval harness output.
**Verify:** `pnpm --filter @echo/engine test session`.

---
# PHASE D: UI and the two apps

## Step 18: UI kit and design tokens
**Do:** `ui/` with CSS variables (colour, type scale, spacing; base text 20 px, tap targets at least 56 px; AA contrast), components: `CaptionView` (large text, `aria-live="polite"`), `FlaggedText` (highlight with an icon, never colour alone), `StampBadge` (Heard clearly, Check this, Not said), `AnchorChip` (plays the 5 seconds around an anchor at normal and slow speed), `ReceiptList`, `ConsentSheet`, `SpeakerCard` (large-text card for please-repeat, doctor card, pharmacist card), `ReadBackPanel`, `ChecklistView`, `ComparisonTable`. Every component has loading, empty, error and permission-denied variants. Respect `prefers-reduced-motion`. Two skins: `care` (card-based, calm, single column) and `cover` (ledger and table layout).
**Verify:** Playwright + axe test page renders every component and variant with zero serious violations.

## Step 19: Echo Care, doctor stage
**Do:** `apps/echo-care/` routes: `/consent`, `/doctor-card`, `/record`, `/read-back`, `/receipt`. Flow: consent sheet (per purpose) → doctor card (hearing-loss notice, request to face the patient and speak slowly, consent to record) → record with live captions, flagged tokens and a one-tap Please-repeat card → read-back with a speaker-facing screen → receipt (stamps, anchor chips, original quotes beside values). Wire to `ConversationSession`. Add disclaimers from the schema on every screen that could read as advice.
**Verify:** Playwright test with `MockAdapter` and a sample consult: the whole flow completes and every fact on the receipt has a working anchor chip.
**Kiro prompt:** "Run Step 19. Build the doctor-stage flow in apps/echo-care using @echo/ui. No advice text anywhere."

## Step 20: Echo Care, pharmacy stage and label check
**Do:** pharmacist card; reuse the record flow with the `pharmacy-counter` schema; label photo via `<input type="file" accept="image/*" capture="environment">`; read the label on device with `tesseract.js` if the spike shows it is usable, otherwise manual entry of the three fields; the user confirms the fields; call `compareLabel`. Photos are not stored unless the user opts in. Write the decision in `docs/SPIKES.md`.
**Verify:** Playwright: a scripted mismatch shows exactly one flag with both anchors, and no verdict on which is right.

## Step 21: Family share
**Do:** off by default; the patient chooses receipt, sections and recipient; export a large-print HTML or text file without audio by default through the Web Share API (download fallback); warn that a sent file cannot be recalled. No server upload in v1.
**Verify:** Playwright: with sharing off no share control appears; the exported file contains no audio.

## Step 22: Echo Cover
**Do:** `apps/echo-cover/` routes: `/consent`, `/questions` (pre-purchase card from the schema checklist with source links, tick-off), `/record` (seller name per conversation), `/compare` (side-by-side table via `compareQuotes` with anchors and Not discussed), `/confirm` (draft a "please confirm in writing" message listing what was promised, with a copy button; never send). Cover must look and read differently from Care (ledger layout, own copy), and shared logic must come from `engine/` only.
**Verify:** Playwright: two scripted sales that differ in financing show both values with anchors, a missing field shows Not discussed, and no ranking or recommendation appears.

## Step 23: Sample consult mode and trust dashboard
**Do:** in both apps a "Play sample consult" button that runs a bundled, pre-segmented scripted consult with audio recorded by consenting actors (no model download needed); a `/trust` page reading `evals/results.json` and showing kept, dropped, invented, unanchored, flagged-token recall and run count.
**Verify:** Playwright: sample consult works offline after first load; `/trust` shows the latest numbers.

---
# PHASE E: Kiro depth (each needs a dated note in `docs/KIRO.md`)

## Step 24: Hooks
Ask Kiro to create these hooks (confirm trigger names in Kiro's hook documentation first): (1) on save of any schema YAML → run schema validation; (2) when an agent task finishes → run `pnpm test && pnpm evals`; (3) on save of any app copy file → check for advice-like wording against the safety steering; (4) when a new schema file is created → scaffold eval cases for it. **Verify:** trigger each hook once and record the result in `docs/KIRO.md`.

## Step 25: Eval MCP server
Create `mcp-eval/`: an MCP server exposing tools `run_evals`, `list_failures`, `show_case(id)`. Register it for Kiro. **Verify:** Kiro calls `run_evals` and reads a failing case from a deliberately broken extractor.

## Step 26: echo-kit power
Package a Kiro power that teaches Kiro how to add a conversation type (schema, detectors, checklist with sources, eval cases, skin). Follow Kiro's "creating powers" documentation. **Verify:** installing the power and asking Kiro to add a third conversation type produces a schema, eval cases and a skin with tests passing.

## Step 27: Custom agents
Create a schema-writer agent and a red-team agent that tries to make the extractor produce a fact without an anchor or an invented fact. Record what each changed. **Verify:** the red-team agent's best attempt is added as an eval case and the suite still passes.

## Step 28: Crew app (separate repo)
Create a **new** public repo `echo-auditor-crew` under the same GitHub account, after Oct 30: a Kiro Crew workflow (judge-and-verify) that re-runs the evals on a schedule and reports regressions. Link it in the Devpost form with a feature description. **Verify:** one scheduled run completes and reports.

---
# PHASE F: harden and ship

## Step 29: Hardening and optional proxy
Accessibility pass on every screen (axe, keyboard, 200% zoom, screen-reader labels); offline check in airplane mode after the first load; browser table (one Android, one iPhone); designed error states. If a cloud model is used at all, build `proxy/` (authentication, rate limit, daily spend cap, transcript text only, no content in logs) behind a visible toggle; otherwise skip it and keep the rules extractor. **Freeze features on Nov 30.**

## Step 30: Deploy and Judge Quick Start
Deploy both apps to a free-tier static host that will stay up until **Jan 29, 2027**. README "Try it in 3 clicks" must work on a phone with no model download and no login.

## Step 31: Documentation
Finish `README.md`, `docs/CLAIMS.md` (open every source, record the date), `docs/EVIDENCE.md` (eval results, drug-name accuracy, interviews, recall comparison with sample sizes and limits), `docs/SOURCES.md` (every licence), `docs/PRIVACY.md`, `docs/KIRO.md` (all eight prompts with commit links).

## Step 32: Submission
Work through `docs/RULES-COMPLIANCE.md` and the submission-day checklist. Submit by Dec 3.

---
## Rules Kiro must follow in every step
1. One step at a time; Verify must pass before the next step; commit `S<number>: <title>`.
2. Tests first for every property (PB1 to PB11).
3. No anchor, no claim. No advice, no dose calculation, no ranking of sellers.
4. No network calls in `engine/`. No keys in the browser. Audio stays on the device by default.
5. Never add a source, licence, claim, dependency or checklist item that was not supplied or verified; record every licence in `docs/SOURCES.md`.
6. Never edit a test to make it pass; fix the code.
7. Stop and ask when blocked.
