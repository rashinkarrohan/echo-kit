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
