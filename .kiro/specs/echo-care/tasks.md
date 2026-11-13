# Tasks: Echo Care (see docs/BUILD-GUIDE.md)

- [x] 18. UI kit and design tokens (S18)
  - components with loading, empty, error and permission-denied variants; axe test page
  - `ui/e2e/gallery/` + `ui/e2e/tests/gallery.spec.ts` (axe zero serious/critical, reduced motion, 200% zoom, focus ring, skin distinctness); read-aloud (design steering) not built yet
  - _Requirements: 2, 4, 8_
- [x] 19. Doctor stage (S19)
  - consent, doctor card, record with live captions, Please repeat, read-back, receipt
  - hash routes (#/consent ...) for static hosting; `?sample=care-01` runs a scripted consult (silent audio until S23); `apps/echo-care/e2e/doctor-visit.spec.ts` (`pnpm --filter echo-care e2e`)
  - _Requirements: 1, 2, 3, 4, 8_
- [x] 20. Pharmacy stage and label check (S20)
  - manual entry with an optional photo (never stored); OCR not spiked (docs/SPIKES.md); `apps/echo-care/e2e/pharmacy-label.spec.ts`
  - _Requirements: 5_
- [x] 21. Family share (S21)
  - large-print HTML built on the device, no audio, everything escaped; Web Share with download fallback; `apps/echo-care/e2e/share.spec.ts`
  - _Requirements: 6_
- [x] 23. Sample consult and trust page (S23, Care part)
  - sample mode (`?sample=...&demo=1`, "Play sample consult" link): in memory, no microphone, no model, works offline (tested); `/trust` reads evals/results.json at build time
  - [ ] sample audio is silent: needs consults recorded by consenting actors with signed releases
  - _Requirements: 7_
