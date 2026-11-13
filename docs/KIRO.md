# How Kiro was used (write-up evidence tracker)

The rules require answers to eight prompts. Fill one dated note, one commit link and one sentence on impact for each, as you build. Do not write this from memory on the last night. Do not claim a feature that was not really used.

| Prompt | What to record | Date | Commit or file | Impact in one sentence |
|---|---|---|---|---|
| Kiro IDE, CLI, Web, Crew: how did they differ? | What each was best at; where each limited you | | | |
| Custom agents | Agents created (schema writer, red-team); which Kiro app; effect on the build | | | |
| Agent hooks | Each hook, its trigger, the workflow it automated, time saved | Nov 13, 2026 | `.kiro/hooks/` (4 files), `scripts/check-copy.mjs`, `scripts/scaffold-evals.mjs`, `evals/src/validate-schemas.ts` | Four hooks: schema YAML saved, then validate all schemas; spec task completed, then `pnpm test && pnpm evals`; copy file saved, then flag advice or ranking wording; new schema created, then draft an eval case. Commands checked by hand (see S24 note below); the IDE triggers themselves have not been seen firing yet. |
| Spec-driven development | How the specs were structured; compare one module built spec-first and one vibe-coded | | | |
| Steering docs | The single rule that changed Kiro's output most | | | |
| MCP | The custom eval server; what it enabled | | | |
| Property-based testing | Requirements with properties; at least one bug PBT caught that unit tests missed | | | |
| Kiro powers | Powers used; the echo-kit power published; third-party tooling gained | | | |

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
