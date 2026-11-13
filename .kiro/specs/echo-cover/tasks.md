# Tasks: Echo Cover (see docs/BUILD-GUIDE.md)

- [x] 22. Echo Cover app (S22)
  - `?sample=sales` runs scripted sales (cover-01, cover-04, cover-02); `apps/echo-cover/e2e/sales.spec.ts`; checklist sources still `verified: false` (22a)
  - question card, record per seller, comparison table, confirm message
  - _Requirements: 1, 2, 3, 4, 5, 6_
- [ ] 22a. Verify every checklist item has a source (before release)
  - _Requirements: 7_
- [x] 23. Sample consult and trust page (S23, Cover part)
  - sample mode (`?sample=...&demo=1`, "Play sample consult" link): in memory, no microphone, no model, works offline (tested); `/trust` reads evals/results.json at build time
  - [ ] sample audio is silent: needs consults recorded by consenting actors with signed releases
  - _Requirements: 4_
