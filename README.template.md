# Echo Kit

A skeleton for apps that turn a consented spoken conversation into a receipt where every fact links to the audio it came from. Two apps built on it: **Echo Care** (doctor and pharmacy) and **Echo Cover** (hearing-aid purchase conversations). Built for Kiroween 2026, Skeleton Crew.

## Try it in 3 clicks
1. Open the Echo Care URL on a phone: <URL>
2. Tap "Play sample consult" (no download needed).
3. Tap any fact to hear the audio it came from. Then open Echo Cover: <URL> and tap "Compare sample quotes".

## Platform
Web app for phone browsers. Tested on: <Android phone>, <iPhone>. On-device speech needs a WebGPU-capable browser; otherwise a slower path or the optional cloud toggle is used.

## Repo layout
`engine/` the skeleton; `apps/echo-care/`; `apps/echo-cover/`; `evals/`; `.kiro/` steering, hooks, specs; `docs/`.

## Setup
<commands>

## What it does not do
Not an interpreter, not an ADA accommodation, not medical, legal or financial advice. No claim that it reduces errors. See docs/CLAIMS.md.

## For judges: where to see each criterion
Impact: docs/EVIDENCE.md and docs/CLAIMS.md | Technological Implementation: docs/KIRO.md and `.kiro/` | Design: the two apps and docs/PRIVACY.md | Innovation: the PRD's "Skeleton and the two apps" | Presentation: the demo video <URL>.

## License
<license>
