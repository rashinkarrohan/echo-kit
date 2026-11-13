# How Kiro was used (write-up evidence tracker)

The rules require answers to eight prompts. Fill one dated note, one commit link and one sentence on impact for each, as you build. Do not write this from memory on the last night. Do not claim a feature that was not really used.

| Prompt | What to record | Date | Commit or file | Impact in one sentence |
|---|---|---|---|---|
| Kiro IDE, CLI, Web, Crew: how did they differ? | What each was best at; where each limited you | | | |
| Custom agents | Agents created (schema writer, red-team); which Kiro app; effect on the build | | | |
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
