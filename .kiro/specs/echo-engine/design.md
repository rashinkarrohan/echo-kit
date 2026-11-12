# Design: Echo Engine

## Data flow
consent → capture → segmenter → ASR adapter → captions + entity guard → (on stop) extractor → anchor validator → verifier → gap check → receipt → local store. The eval harness runs the same modules from pre-made segments.

## Modules (engine/src)
`types.ts`, `schema/`, `text/normalise.ts`, `segments.ts`, `guard/` (care-detectors, cover-detectors, flagTokens, registry), `extract/rules-extractor.ts`, `validate/validate-fact.ts`, `verify/verify.ts`, `gap/gap-check.ts`, `label/compare.ts`, `compare/compare-quotes.ts`, `readback/readback.ts`, `consent/ledger.ts`, `store/store.ts`, `audio/segmenter.ts`, `asr/` (adapter interface, WhisperAdapter, MockAdapter), `session/session.ts`.

## Types and interfaces
Use exactly the types in docs/PRD.md ("Data model and interfaces" and "Cover-specific types"). Errors are `Result` values, except the consent gate which throws.

## Correctness properties (fast-check)
PB1 anchor soundness | PB2 no anchor, no claim | PB3 noise invariance | PB4 idempotence | PB5 numeric faithfulness | PB6 flag completeness | PB7 comparison symmetry | PB8 read-back reflexivity | PB9 time ordering | PB10 consent gate | PB11 comparison neutrality.

## Error handling
Never guess: missing confidence stays undefined; unparsable audio or schema returns `Result.err`; the UI shows designed error states.

## Testing strategy
Vitest unit tests; fast-check properties first; `evals/` scripted consults; Playwright for browser behaviour; no real personal data anywhere.
