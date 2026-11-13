---
name: add-conversation-type
description: Add a new conversation type to Echo Kit (schema, detectors, sourced checklist, eval cases, skin) and prove it with the eval harness.
---

# Add a conversation type to Echo Kit

Use this when the user asks for a new kind of conversation, for example "a dentist visit" or "a care-home review". Work in the Echo Kit repo root. Read `.kiro/steering/` first; its rules win over anything here.

## Rules that never bend
- **No anchor, no claim.** Every fact needs a verbatim quote from the transcript. Never weaken `engine/src/validate/validate-fact.ts` to make a case pass.
- **No advice.** Copy says "said", "sounds like", "check this". No medical, legal or financial advice, no dose calculations, no ranking.
- **Never invent a source.** A checklist item's `sourceUrl` is either `user-planned` (the user's own question) or a URL the user gave you. If there is no source, use `user-planned` or ask. Leave `verified: false` on any URL until a person has opened it and recorded it in `docs/CLAIMS.md`.
- **Actors only.** Eval scripts are fictional. No real patients, customers, businesses or prices.
- **No copying between apps.** Shared code goes in `engine/` or `ui/`.

## Steps

### 1. Decide where it lives
- If it is a variant of an existing app (Care: health conversations; Cover: purchase conversations), add the schema to that app: `apps/echo-care/schemas/` or `apps/echo-cover/schemas/`.
- A genuinely new product needs a new app folder; ask the user before creating one.

### 2. Write the schema
Copy the shape of `references/schema-template.yaml`. Fields:
- `id`: kebab-case, unique across all apps.
- `skin`: `care` (calm cards) or `cover` (ledger). See step 5.
- `detectors`: only ids from the registry in `engine/src/guard/registry.ts`: `number`, `drug`, `frequency`, `date`, `money`, `percent`, `duration`, `commission`.
- `facts`: each `{ key, fields[], cues }`. A fact is triggered by `anchor: "@<detector>"` or by `any: [regex, ...]`. `windowWords` caps the span (default 25). Fields are filled by name, so reuse field names the extractor understands (`engine/src/extract/rules-extractor.ts`, `fill`): `name`, `dose`, `strength`, `frequency`, `how_to_take`, `duration`, `when`, `description`, `statement`, `amount`, `per`, `period`, `terms`, `rate`, `term`, `monthly`. A new field name will stay empty until the extractor learns it.
- `checklist`: each `{ id, text, sourceUrl, verified?, cues }`. Cues use `any: [...]` or `all: [[group], [group]]`. A regex alternative and a detector reference can be mixed: `"@frequency|morning|evening"`.
- `disclaimer` and `nextSteps`: copy the app's existing disclaimer wording.

Saving the file runs the **Validate schemas on save** hook. To check by hand: `pnpm check:schemas`.

Cue pitfalls found in this project (write cues to avoid them):
- Short phrases match too much: `"if you"` matched "on a Tuesday if you can". Prefer `"if you (feel|get|notice|...)"`.
- Cues are matched against the normalised text (lowercase, number words as digits, punctuation removed) and the original text.

### 3. Write the eval cases
Creating the schema file runs the **Scaffold eval cases for a new schema** hook, which drafts `evals/drafts/<id>-01.json`. Then:
- Write at least two scripted consults following `evals/consults/README.md`: segments of 3 to 8 seconds, ordered, no overlaps; every planted `quote` verbatim in the transcript; **exactly one** planted gap (a checklist item never mentioned).
- Vary them: numbers as words and digits, a filler word, a negation ("do not ..."), a field said in a later segment.
- Move each finished file to `evals/consults/`.

### 4. Prove it
- `pnpm evals` must pass with **0 invented and 0 unanchored** facts. Use this power's `evals` MCP tools: `run_evals`, then `list_failures` and `show_case` to see exactly which fact was invented or dropped and why.
- `pnpm evals --break` must still fail.
- If a planted fact is dropped, improve the schema cues first. Change the extractor only with a new unit test in `engine/src/extract/rules-extractor.test.ts`. Never edit a test to make it pass.
- `pnpm test`, `pnpm lint`, `pnpm typecheck` all pass.

### 5. Skin
Reuse `care` or `cover` (tokens in `ui/src/tokens.ts`, contrast tested in `ui/src/tokens.test.ts`). A new skin needs a new `SKINS` entry and a `.echo[data-skin="..."]` block in `ui/src/styles.css` with the same token names; the token test checks both and every text pair must reach 4.5:1. Never add a colour without that test passing.

### 6. Wire it into the app (if the user wants it in the UI)
Load the YAML with `?raw` in the app's `src/env.ts`, the same way `doctor-visit.yaml` is loaded, and add a scripted sample under `SAMPLES`. Add a Playwright test in the app's `e2e/` folder for the new flow.

### 7. Record it
Commit with the step or feature id. Note in `docs/KIRO.md` (Kiro powers row) that the power was used and what it produced.
