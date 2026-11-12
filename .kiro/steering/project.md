---
inclusion: always
---
# Echo Kit: project context for Kiro

Kiroween 2026, **Skeleton Crew** category. Deadline: **Dec 4, 2026, 2:00 PM PT** (3:30 AM IST on Dec 5). Plan to submit Dec 3. Updated Nov 12, 2026.

**All development uses Kiro only** (IDE, CLI, Web and Crew). The rules require the project to be built with Kiro, and insufficient use of Kiro can disqualify an entry.

## What we are building
**Echo Kit**: a browser-based skeleton that turns a consented spoken conversation into a *receipt you can check*, built first for older adults (65+) with unaided hearing loss and their adult children. Every fact links to the audio it came from; anything uncertain is flagged, never guessed. English-first, US then UK.

- `engine/` (the skeleton): consent ledger, capture and chunking, speech adapter, captions, entity-guard framework, schema-driven extraction, deterministic anchor check, verifier, receipt store, gap check, schema loader, eval harness.
- `apps/echo-care/` (App 1): doctor visit and pharmacy counter. Hearing Mode: captions, flags on doses, drug names, frequencies and dates, one-tap "Please repeat" card, read-back with a speaker-facing screen, doctor card. Label check (spoken instruction vs a label photo). Patient-controlled family share.
- `apps/echo-cover/` (App 2): hearing-aid purchase conversations. Money, percentage, duration and commission detectors; pre-purchase question card; **quote comparison across two or more sellers**; gap check against a sourced checklist; confirm-in-writing draft.
- Separate repo (bonus): `echo-auditor-crew`, a Kiro Crew judge-and-verify workflow that re-runs evals. Newly created under the same GitHub account.
- The two apps must be genuinely distinct. Echo Cover is never cut below F10 and F15.

## Hard rules from the official rules
- Public GitHub repo with a visible open-source license (About section); `/.kiro` at the root and NEVER in `.gitignore`.
- Skeleton Crew: two separate app folders. New work only (after Oct 30, 2026); disclose pre-existing code.
- Demo video under 3 minutes, public on YouTube, recorded on the device it was built for (a phone), no third-party trademarks or copyrighted music. All materials in English.
- Free and unrestricted for testing until Jan 29, 2027. Judges may judge from text, images and video alone, so README and docs must stand alone.
- Entry must be solely owned and original, with every third-party model, dataset and API licence recorded. Anyone in the video needs a written release.
- The write-up answers eight prompts: IDE/CLI/Web/Crew, custom agents, hooks, spec-driven vs vibe coding, steering, MCP, property-based testing, powers (see docs/KIRO.md).
- Full matrix: docs/RULES-COMPLIANCE.md.

## Product rules (never break)
1. No anchor, no claim: a fact whose quote is not a verbatim substring of the normalised transcript is rejected **in code**.
2. No medical, legal or financial advice. No dose calculations. No ranking or recommending sellers. Say "said", "sounds like", "check this".
3. Audio and transcripts stay on the device by default. Separate consent per purpose, with all-party consent wording everywhere. No keys in the browser. Any cloud call goes through a capped proxy, transcript text only, behind a visible toggle.
4. English default: on-device speech through an adapter interface. Hindi/Hinglish is a stretch goal only. Numbers can arrive as words: normalise before checking.
5. Anchors are segment-level (3 to 8 s). Do not assume browser word timestamps or per-word confidence; both are open spikes.
6. Captions are never presented as certain. Always show uncertainty.
7. Claims discipline: say "studies suggest". Never say "Echo reduces errors", never quote mis-selling percentages for hearing-impaired people, never claim legal-evidence value, never claim no other app does this. See docs/CLAIMS.md.
8. `engine/` never imports from `apps/`. Code copied between the two apps is a defect.

## Working style
One feature per spec task. Write tests first from the acceptance criteria and properties (PB1 to PB11), then implement. Run the eval harness before reporting done. Small commits naming the feature ID. Ask when a requirement is ambiguous or an open decision blocks the work.

## Where to look
docs/BUILD-GUIDE.md (the step-by-step order to build in) | .kiro/specs/ (requirements, design and tasks per spec) | docs/PRD.md (features F1 to F15, data model, tests, build order, compliance) | docs/SPEC-SEED.md | docs/CONTEXT.md | docs/PLAN.md | docs/RULES-COMPLIANCE.md | docs/CLAIMS.md | docs/SOURCES.md. `private/` is local only (gitignored); never commit it.
