# How Kiro was used (write-up evidence tracker)

The rules require answers to eight prompts. Fill one dated note, one commit link and one sentence on impact for each, as you build. Do not write this from memory on the last night. Do not claim a feature that was not really used.

| Prompt | What to record | Date | Commit or file | Impact in one sentence |
|---|---|---|---|---|
| Kiro IDE, CLI, Web, Crew: how did they differ? | What each was best at; where each limited you | | | *To fill in by the owner: only the Kiro IDE has been used so far; Crew is Step 28.* |
| Custom agents | Agents created (schema writer, red-team); which Kiro app; effect on the build | Nov 13, 2026 | `.kiro/agents/red-team.md`, `.kiro/agents/schema-writer.md`, `evals/redteam/NOTES.md`, `evals/consults/redteam-01.json` | The red-team pass found 15 of 21 scripted attacks where Echo accepted a fact nobody said (none unanchored); the worst gave metformin the aspirin dose from the same sentence. The extractor fix took that to 7 of 21, and the best attack now runs in every eval. On Nov 21 the schema-writer agent added eval case care-12 inside its write sandbox, passing first time. |
| Agent hooks | Each hook, its trigger, the workflow it automated, time saved | Nov 13, 2026 | `.kiro/hooks/` (4 files), `scripts/check-copy.mjs`, `scripts/scaffold-evals.mjs`, `evals/src/validate-schemas.ts` | Four hooks: schema YAML saved, then validate all schemas; spec task completed, then `pnpm test && pnpm evals`; copy file saved, then flag advice or ranking wording; new schema created, then draft an eval case. Commands checked by hand (see S24 note below); the IDE triggers themselves have not been seen firing yet. |
| Spec-driven development | How the specs were structured; compare one module built spec-first and one vibe-coded | | | |
| Steering docs | The single rule that changed Kiro's output most | | | |
| MCP | The custom eval server; what it enabled | Nov 13, 2026 | `mcp-eval/src/server.ts`, `.kiro/settings/mcp.json` | Kiro runs the eval harness and reads a failing case in chat: with the broken extractor, `show_case care-05` showed "Okafor", "meals" and "surgery" accepted as medicine names with real quotes, which is exactly what the "invented" metric exists to catch. |
| Property-based testing | Requirements with properties; at least one bug PBT caught that unit tests missed | | | |
| Kiro powers | Powers used; the echo-kit power published; third-party tooling gained | Nov 13, 2026 | `powers/echo-kit/` (plugin.json, mcp.json, skills/add-conversation-type), `apps/echo-care/schemas/physio-visit.yaml`, `evals/consults/physio-0{1,2}.json` | Following the power's skill produced a third conversation type (physiotherapy visit) whose two eval cases passed first time (5/5 facts, 0 invented). Installing it via the Powers panel is still to do. |

## Experiment log
List what you tried, what failed and why (the judging criteria name experimentation).

## Kiro-only statement
All development of this project used Kiro only (IDE, CLI, Web and Crew). Note which Kiro app was used for which task.

### S24 hooks, Nov 13, 2026
Created with Kiro's hook tool (`createHook`); Kiro loads them at the next session start, so they could not fire in the session that created them. Each command was run by hand the same day:
- `pnpm -s check:schemas` (Validate schemas on save): passed for 3 schemas. With `--release` it fails on `hearing-aid-sale.yaml` because its checklist sources are still `verified: false`, which is the intended block before release.
- `pnpm test && pnpm evals` (after a spec task): all tests and 15 eval consults passed.
- `pnpm -s check:copy` (copy saved): passed on the three copy files; a scratch file with "You should take two tablets" and "the best deal" was flagged with exit code 1.
- `node scripts/scaffold-evals.mjs` (new schema): given hook-style JSON naming a temporary schema, it wrote `evals/drafts/test-scaffold-01.json` with TODO markers (the draft and schema were then removed).
**Still to record:** each hook firing on its real IDE trigger in a new session (save a schema, save a copy file, create a schema, complete a spec task), with the result.

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
