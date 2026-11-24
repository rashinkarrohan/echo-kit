# How Kiro was used (write-up evidence tracker)

The rules require answers to eight prompts. Fill one dated note, one commit link and one sentence on impact for each, as you build. Do not write this from memory on the last night. Do not claim a feature that was not really used.

| Prompt | What to record | Date | Commit or file | Impact in one sentence |
|---|---|---|---|---|
| Kiro IDE, CLI, Web, Crew: how did they differ? | What each was best at; where each limited you | | | *Evidence from Kiro's local session store (`~/.kiro/sessions`, Nov 12 to 24, 2026): two sessions, both Kiro IDE chats (autopilot, "vibe" mode), and no CLI or Web session in it. Crew is not built yet (separate repo). The owner can add a CLI or Web comparison only after really using them.* |
| Custom agents | Agents created (schema writer, red-team); which Kiro app; effect on the build. The session log records 14 sub-agent runs: red-team (Nov 13), schema-writer (Nov 21), five mostly read-only code-reading runs (Nov 18), and seven web-research runs (two on Nov 13, four on Nov 21, one on Nov 22). Roles of the last two groups are inferred from the tools each run used. | Nov 13, 2026 | `.kiro/agents/red-team.md`, `.kiro/agents/schema-writer.md`, `evals/redteam/NOTES.md`, `evals/consults/redteam-01.json` | The red-team pass found 15 of 21 scripted attacks where Echo accepted a fact nobody said (none unanchored); the worst gave metformin the aspirin dose from the same sentence. The extractor fix took that to 7 of 21, and the best attack now runs in every eval. On Nov 21 the schema-writer agent added eval case care-12 inside its write sandbox, passing first time. |
| Agent hooks | Each hook, its trigger, the workflow it automated, time saved | Nov 13, 2026 | `.kiro/hooks/` (4 files), `scripts/check-copy.mjs`, `scripts/scaffold-evals.mjs`, `evals/src/validate-schemas.ts` | Four hooks: schema YAML saved, then validate all schemas; spec task completed, then `pnpm test && pnpm evals`; copy file saved, then flag advice or ranking wording; new schema created, then draft an eval case. Commands were first checked by hand (S24 note below). The session log then records 43 real firings, all with status "completed" (that is, the command ran; the log does not say whether it passed): "Validate schemas on save" 7 times (Nov 13 to 21), "Check copy for advice wording" 35 times (Nov 18 to 22), "Scaffold eval cases for a new schema" once (Nov 13). "Run tests and evals after a task" never fired: it needs a spec task to be marked complete in Kiro's task UI, and the tasks were ticked in chat. |
| Spec-driven development | How the specs were structured; compare one module built spec-first and one vibe-coded | Nov 12 to 21, 2026 | `.kiro/specs/echo-engine/` (requirements, design with PB1 to PB11, 23 tasks, 20 done), `.kiro/specs/echo-care/`, `.kiro/specs/echo-cover/` | *Draft by Kiro from the repo, owner to confirm or rewrite:* the engine was built spec-first, task by task, with the properties written before the code; the Echo Care home page, Check this hints and visual polish (`9fd322f`, `a336c9b`) were vibe-coded in chat from the owner's feedback. These specs were written in chat, not through Kiro's spec workflow screens (the session was in "vibe" mode with the spec-plan option off), so describe the approach as "spec files used as the build plan", not as the spec-workflow feature. The two app design docs are two lines each, so the apps leaned on the shared spec and docs/appendix/UI-SPEC.md. The Nov 23 design packs were added as spec task 24 in each app (`.kiro/specs/echo-care/tasks.md`, `.kiro/specs/echo-cover/tasks.md`) and built in the order tests, then screens. |
| Steering docs | The single rule that changed Kiro's output most | Nov 12, 2026 | `.kiro/steering/` (`project`, `product`, `safety`, `tech` always included; `design` on `*.tsx, *.css, *.html`) | *Draft by Kiro, owner to choose:* two candidates from the repo. (1) "No anchor, no claim" became a code check (`engine/src/validate/validate-fact.ts`), so every fact is rejected unless its quote is in the transcript; the red team never got an unanchored fact through (0 of 21). (2) "Speech engines may write numbers as words: normalise before checking" led to `engine/src/text/normalise.ts`, which later also handled "one and a half". |
| MCP | The custom eval server; what it enabled | Nov 13, 2026 | `mcp-eval/src/server.ts`, `.kiro/settings/mcp.json` | Kiro ran the eval tools in chat on Nov 13 and again on Nov 21 (5 calls in the session log: `run_evals` once, `show_case` four times). For example, Kiro read a failing case in chat: with the broken extractor, `show_case care-05` showed "Okafor", "meals" and "surgery" accepted as medicine names with real quotes, which is exactly what the "invented" metric exists to catch. |
| Property-based testing | Requirements with properties; at least one bug PBT caught that unit tests missed | Nov 12, 2026 onward | PB1 to PB11 in `.kiro/specs/echo-engine/design.md`; 17 `fc.assert` properties in 10 test files (e.g. `engine/src/validate/validate-fact.test.ts`: PB1 to PB5; `engine/src/label/compare.test.ts`: PB7; `engine/src/compare/compare-quotes.test.ts`: PB11; `engine/src/consent/ledger.test.ts`: PB10) | One real failure is on record (session log, Nov 12, 2026, 16:37 to 16:39). The property "Cover token completeness" (PB6, written before the Cover detectors) failed with the counterexample amount 100, currency `$`, i.e. the text "price 100 $", and the money detector did not flag it. Kiro then fixed the detector for a reversed word order ("rupees 1000", found by an example test) and changed the generator to currency words only. **Be careful how you describe this:** symbols written before the amount ("$100", "£200") are covered by example tests, and "100 $" is not how a price is written, so this shows the property surfacing a mismatch between generated text and the detector, not a bug in a real transcript. No other failure is recorded; the commits `34a88f0` (S7) and `7366d3f` (S2) add tests with fixes but do not say a property found the problem. Decide yourself whether this counts. |
| Kiro powers | Powers used; the echo-kit power published; third-party tooling gained | Nov 13, 2026 | `powers/echo-kit/` (plugin.json, mcp.json, skills/add-conversation-type), `apps/echo-care/schemas/physio-visit.yaml`, `evals/consults/physio-0{1,2}.json` | Following the power's skill produced a third conversation type (physiotherapy visit) whose two eval cases passed first time (5/5 facts, 0 invented). Kiro's installed-powers list (`~/.kiro/powers/installed.json`) is empty, so installing it via the Powers panel is still to do. |

## Experiment log
List what you tried, what failed and why (the judging criteria name experimentation).

- **Nov 21, 2026, accuracy pass (Kiro IDE; details in docs/SPIKES.md):**
  - Kept: the user's own medicines list (names found 41 to 47 of 48 when listed).
  - Kept: more ways of saying how often, and "to puffs" flagged as an unclear dose.
  - Kept: a sales word list as Echo Cover's speech prompt (real voice: 15 to 18 of 18 facts kept).
  - Rejected: matching a different first sound against the whole medicine list (7 right, 6 wrong real medicines).
  - Rejected: a sentence-like prompt, which Whisper wrote out as a $100,000 price on near-silence.
  - Caught: the red-team replay found that reading "in the evening" turned "every other day" into a daily dose; fixed before commit.
  - A new fast-check property says a personal list only adds suggestions: heard words stay as heard and exact names are never dropped (`engine/src/guard/drug-match.test.ts`).
- **Nov 22, 2026, research then build (Kiro IDE; parallel research sub-agents, then measurement before each change):**
  - Kept: the Silero speech check (non-speech sent to Whisper: 11 to 0).
  - Kept: US sources for Echo Cover's questions.
  - Kept: a real-speech test on PriMock57. It found ordinary words in the medicine list, ordinary words joined into medicines, and a prompt-induced wrong name stamped Heard clearly. All three are fixed, the last with a second, unprompted hearing.
  - Rejected: per-word confidence. Medicine names heard correctly scored as low as misheard ones (docs/SPIKES.md).

- **Nov 23 to 24, 2026, design packs and phone hardening (Kiro IDE; commits `9efd37b`, `8b5d221`, `7c4fae3`, `767b778`, `cc57d49`):**
  - Done: both apps were rebuilt to the owner's design packs, each in its own scoped style layer (`apps/echo-care/src/design/`, `apps/echo-cover/src/design/`). The text-size control used by both moved into `@echo/ui` once, rather than being copied between apps. Care self-hosts its font (Atkinson Hyperlegible Next, OFL) instead of loading it from Google Fonts.
  - Done: a phone report ("recording works but no captions") led to a read of the capture, worker and adapter code. Kiro found places where a failure was silent: a crashed worker, no download progress, and a failed segment shown as "(no speech)". The fixes were written test first (new tests in `engine/src/asr/asr.test.ts`, `ui/src/platform/capture.test.ts`, `whisper-models.test.ts`, `download-progress.test.ts`, `recording.test.ts`).
  - Caught by a test: a new test for "three failed segments in a row stop the microphone" failed. Silent segments, which never reach the speech engine, were resetting the failure count. The count now resets only on a segment the engine actually read.
  - Rejected: keeping WebGPU first on phones (unmeasured, and a WebGPU model that loads but fails while transcribing left a blank screen), and a generic error message.
  - Not verified: real phones. The check was desktop Chromium with a Pixel 7 profile and a fake microphone (captions after about 33 s, medicine name, dose and frequency flagged). See docs/SPIKES.md.
  - Deploy: Vercel stopped building after commit `036a311`. Kiro found this by comparing the live bundle names with local builds, and added `.github/workflows/deploy.yml` (commit `448943f`). It needs two deploy-hook secrets that only the owner can create.

## Kiro-only statement
All development of this project used Kiro. What this file documents, by Kiro app:
- **Kiro IDE:** all code in this repository, the specs (`.kiro/specs/`), steering (`.kiro/steering/`), hooks (created with the `createHook` tool), the two custom agents, the eval MCP server and the echo-kit power.
- **Kiro CLI, Kiro Web and Kiro Crew:** no use is recorded in this repository. The separate `echo-auditor-crew` repository (the Crew bonus) is not part of this repo and has not been built or checked here. Until it exists and runs, do not describe the CLI, Web or Crew as used, and do not claim the Crew bonus.

### S24 hooks, Nov 13, 2026
Created with Kiro's hook tool (`createHook`); Kiro loads them at the next session start, so they could not fire in the session that created them. Each command was run by hand the same day:
- `pnpm -s check:schemas` (Validate schemas on save): passed for 3 schemas. With `--release` it fails on `hearing-aid-sale.yaml` because its checklist sources are still `verified: false`, which is the intended block before release.
- `pnpm test && pnpm evals` (after a spec task): all tests and 15 eval consults passed.
- `pnpm -s check:copy` (copy saved): passed on the three copy files; a scratch file with "You should take two tablets" and "the best deal" was flagged with exit code 1.
- `node scripts/scaffold-evals.mjs` (new schema): given hook-style JSON naming a temporary schema, it wrote `evals/drafts/test-scaffold-01.json` with TODO markers (the draft and schema were then removed).
**Still to record:** the hook "Run tests and evals after a task" firing on its real trigger, and whether each recorded firing passed (the session log shows only that it ran).

### S25 eval MCP server, Nov 13, 2026
`mcp-eval/` is a stdio MCP server (`@modelcontextprotocol/server` 2.4.0) with three tools: `run_evals`, `list_failures`, `show_case(id)`, each with an optional `broken` flag that swaps in the deliberately broken extractor. Registered in `.kiro/settings/mcp.json` as `echo-kit-evals`. Verified in Kiro the same day: `run_evals` passed (49/49 kept, 0 invented, 0 unanchored); `run_evals {broken: true}` failed (72 invented); `show_case {id: "care-05", broken: true}` listed the five invented facts with their quotes. `mcp-eval/src/server.test.ts` checks the same over stdio with the MCP client.

### S26 echo-kit power, Nov 13, 2026
Built to the current kiro.dev format (checked the same day via Kiro's docs: `plugin.json` manifest with `$schema`, `name`, `version`, `description`, `author`, `keywords`; optional `mcp.json`; skills as `skills/<name>/SKILL.md`). The power bundles the eval MCP server and one skill, `add-conversation-type`, plus a schema template.
Trial: following only the skill, Kiro added `physio-visit` (Echo Care, `care` skin, four user-planned checklist questions, no external sources) and two actor-scripted eval cases. Results: schema check passed (4 schemas); `pnpm evals` passed with 17 consults, 54/54 facts kept, 0 invented, 0 unanchored; `show_case physio-02` via MCP confirmed both facts with their quotes. Finding: "20 seconds, 3 times" is not captured because no extractor field takes it; the skill now says new field names stay empty until the extractor learns them.
**Still to do:** install the power from the Powers panel (Add Custom Power, Import power from a folder, choose `powers/echo-kit`), then ask Kiro in a fresh chat to add another conversation type and record whether the power activates on its keywords.

### S27 custom agents, Nov 13, 2026 (Kiro IDE)
Two workspace agents in `.kiro/agents/` (format checked against kiro.dev the same day: Markdown front matter with `name`, `description`, `tools`, `permissions`, `resources`; body is the prompt). Both may only write their own files: `red-team` writes `evals/consults/redteam-*.json` and `evals/redteam/**`; `schema-writer` writes schemas and eval cases; both are denied engine, UI, app and test code, `git commit`, `git push` and `git reset`.
**Red team, run Nov 13.** 21 scripted attacks (`evals/redteam/attacks/`, notes in `evals/redteam/NOTES.md`). Before the fix: 15 produced an invented fact, 0 an unanchored one (the quote check held every time). Worst: "Keep the aspirin at seventy-five milligrams once a day, and add metformin five hundred milligrams twice a day" gave **metformin 75 mg once a day**, with every value verbatim in the quote. Kept as `evals/consults/redteam-01.json`.
**What changed.** The rules extractor now builds medicine facts from clause positions (values before a drug count only inside its own clause, never across another drug), leaves a dose or frequency empty when two different values are heard for one drug (corrections such as "ten, sorry, five"), and reads "do not take" or "we are stopping that" across the whole clause. Nine unit tests come straight from the attacks (`engine/src/extract/rules-extractor.test.ts`, "Red-team attacks").
**After.** `pnpm evals` with redteam-01: 18 consults, 58/58 kept, 0 invented, 0 unanchored. Replaying all 21 attacks: invented facts down from 15 to 7.
**Still open (not fixed):** ranges ("between two and three tablets" keeps 3), "one and a half tablets" read as 0.5, an "if you" sentence about parking taken as a warning sign, "aspiring" matched to aspirin, and three seller-price traps (single-aid vs pair price, "per aid, so ... for the pair", "do we get a commission? We do not"). The harness also misses one class: it counted "0.5 tablets" for "one and a half" as a match (see NOTES.md).
**Schema writer:** not yet run as its own agent on Nov 13; the physio-visit type (S26) was written by following the same skill it loads. First run as its own agent on Nov 21 (next section).

### S27 schema-writer agent run, Nov 21, 2026 (Kiro IDE)
The main Kiro chat invoked the `schema-writer` agent with one bounded task: add a UK pharmacy-counter eval case not covered by the existing four, with doses spoken as words and one planted gap, without changing the schema unless a cue was missing.
- **What it wrote:** `evals/consults/care-12.json` only. It is a chemist counter with fictional speakers: nitrofurantoin "fifty milligram capsules" in one segment, "one capsule every six hours ... for three days" in the next, a "Sorry, was that every six hours?" repeat, side effects, a missed-dose instruction, storage, and "things to avoid" never mentioned.
- **What it did not touch:** the schema, engine, UI, app code and tests. Its permissions deny those paths and `git commit`, and the main chat reviewed and committed the file.
- **Result:** passed on the first loop. `pnpm evals`: 26 consults, 82/82 kept, 0 invented, 0 unanchored, checklist accuracy 100%. `pnpm test` and `pnpm check:schemas` passed.
- **What it reported:** every pharmacy gap topic is already used by another case, so `q-avoid` is planted again (as in care-02). Its loaded skill path is `powers/echo-kit/skills/`, not `.kiro/skills/`.
- **Limit:** this shows the agent works inside its sandbox on a small task. It did not need to tune cues, so the "fix the cues, not the test" loop was not exercised.

### S27 follow-up: the last red-team findings, Nov 21, 2026 (Kiro IDE)
The six attacks that still produced an invented fact were fixed, then moved from `evals/redteam/attacks/` into `evals/consults/`, so every `pnpm evals` now runs them:
- **12:** a spoken range is kept as one dose.
- **11 and 21:** "one and a half" now reads as 1.5.
- **15:** "questions about parking, call the clinic reception" is no longer a warning sign.
- **18 and 19:** a price takes its "per pair" or "per aid" from right after the amount.
- **20:** a statement about commission keeps the seller's answer, not the question.

Each fix has a unit test written first (`engine/src/text/normalise.test.ts`, `engine/src/guard/care-detectors.test.ts`, `evals/src/harness.test.ts`).

Results:
- `pnpm evals`: 25 consults, 79/79 kept, 0 invented, 0 unanchored.
- Replaying all 21 attacks plus the regular consults (39 in total): 0 invented. The only dropped fact is attack 17, which is dropped by design.

Commit `011ba92`; details in `evals/redteam/NOTES.md`.
