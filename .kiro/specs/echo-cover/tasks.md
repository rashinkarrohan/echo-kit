# Tasks: Echo Cover (see docs/BUILD-GUIDE.md)

- [x] 22. Echo Cover app (S22)
  - `?sample=sales` runs scripted sales (cover-01, cover-04, cover-02); `apps/echo-cover/e2e/sales.spec.ts`; checklist sources still `verified: false` (22a)
  - question card, record per seller, comparison table, confirm message
  - _Requirements: 1, 2, 3, 4, 5, 6_
- [ ] 22a. Verify every checklist item has a source (before release)
  - _Requirements: 7_
- [x] 23. Sample consult and trust page (S23, Cover part)
  - sample mode (`?sample=...&demo=1`, "Play sample consult" link): in memory, no microphone, no model, works offline (tested); `/trust` reads evals/results.json at build time
  - [x] actor recordings of cover-01, cover-04 and cover-02 (docs/RECORDING-SCRIPT.md) split into the script's segments; `public/samples/*.mp3`, cached offline; Hear it plays them (tested: speech in every segment, `ui/e2e/tests/sample-audio.spec.ts`)
  - [x] signed release recorded in docs/RELEASES.md (Nov 21, 2026); recordings committed
  - _Requirements: 4_
- [x] 24. Echo Cover design pack (S19 polish, Nov 23, 2026)
  - phone (390 px) and desktop (1280 px) layouts from the owner's design pack, in `apps/echo-cover/src/design/` (scoped `.cv` styles, so Echo Care is untouched); self-hosted Atkinson Hyperlegible Next; cover palette in `ui/src/tokens.ts` and `ui/src/styles.css`; the text-size control and its hooks moved into `@echo/ui` so neither app copies them
  - flow: Home, Before we start (On/Off switches), Plan questions, Who are you talking to, live captions, seller receipt, Seller ledger, Confirm in writing, Test results, Saved conversations
  - pure logic tested first (`ledger`, palette contrast); e2e rewritten for the new flow with axe at both sizes
  - deviations from the pack, on purpose: the consent line about keeping a recording says sound is not saved; questions start off, not pre-chosen; the live screen has no Back link while the microphone may be on; sellers-so-far list replaced by receipt links on the ledger
