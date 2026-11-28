# Contributing

Thanks for looking. Echo Kit is a hackathon project, so small, focused changes are easiest to review.

## Set up

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm evals
```

## Rules that every change must keep

1. **No anchor, no claim.** A fact must quote the transcript word for word. Do not weaken
   `engine/src/validate/validate-fact.ts`.
2. **Never replace a heard word.** Suggestions are shown as "Sounds like …?", never substituted.
3. **No advice.** No medical, legal or financial advice, no dose calculation, no ranking of
   sellers. `pnpm check:copy` fails on advice wording.
4. **Nothing leaves the device by default.** No analytics, no uploads.
5. **Real people's audio is never committed.** Samples use actors with written releases
   (docs/RELEASES.md). Use fictional scripts.

## Adding a conversation type

Use the `echo-kit` Kiro power (`powers/echo-kit`) or copy a file in
`apps/*/schemas/`, then add scripted consults in `evals/consults/` and run `pnpm evals`.

## Before you open a pull request

`pnpm lint && pnpm typecheck && pnpm test && pnpm evals`, and for UI changes
`pnpm --filter echo-care e2e` or `pnpm --filter echo-cover e2e`.
