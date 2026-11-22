# Echo Kit

**A receipt you can check for a spoken conversation.** Echo Kit turns a consented conversation into a list of facts. Each fact quotes the words it came from and links to that part of the audio. Anything Echo is unsure of is marked **Check this**; anything not mentioned is marked **Not said**. It never guesses.

It is built first for older adults with unaided hearing loss and their adult children. Two apps share one engine:

| | **Echo Care** | **Echo Cover** |
|---|---|---|
| For | Doctor visits and the pharmacy counter | Hearing-aid purchase conversations |
| During the conversation | Large-text captions with medicine names, doses, frequencies and dates highlighted; a full-screen "Please repeat" card; a card asking the doctor to face you and speak slowly | Captions with money, percentages, time periods and commission wording highlighted; a card of questions to ask, each with its source |
| Afterwards | A receipt of medicines, follow-ups and warning signs; read-back with a screen to show the doctor; a check of the pharmacy label against what was said; a patient-controlled summary to share with family (no audio) | A receipt per seller; a side-by-side ledger of two or more sellers that never ranks them; a drafted "please confirm in writing" message |

Built for Kiroween 2026, Skeleton Crew category. The skeleton is `engine/` plus `ui/`; the two apps are the creatures built on it.

## Try it
Each app has a **Play sample consult** button on its home screen. It runs a fictional visit, read by an actor, with real audio behind every "Hear it" button. It needs no microphone and no model download, and it works offline after the first load.

- Echo Care: *public link added at deployment (build guide Step 30)*
- Echo Cover: *public link added at deployment (build guide Step 30)*

To run them locally:

```bash
pnpm install
pnpm dev:care    # Echo Care on http://localhost:5181
pnpm dev:cover   # Echo Cover on http://localhost:5182
```

Then open `http://localhost:5181/?sample=care-01&demo=1#/doctor-card` or `http://localhost:5182/?sample=sales&demo=1#/questions`.

Live recording uses an on-device Whisper model (whisper-base.en by default, about 77 MB on first use) and needs a browser on `https` or `localhost`. Measurements so far are from a laptop; phone results are still to be recorded (docs/SPIKES.md).

## How a fact earns its place on the receipt
1. **Consent first.** Separate switches for recording and for speech-to-text, with all-party wording, are stored in a consent ledger. Recording cannot start without them; this is enforced in code.
2. **Speech to text on the device.** Audio is cut into 3 to 8 second segments and transcribed in a Web Worker. Neither audio nor text leaves the phone.
3. **Flagging.** Detectors highlight the details people mishear: doses, medicine names, frequencies, money, percentages and durations. Spoken numbers are normalised first ("five hundred" becomes 500; "one and a half" becomes 1.5).
4. **Medicine names are matched by sound** against 1,749 generic names: the FDA drug directory plus common UK names such as paracetamol. A near match is shown as "Sounds like metformin?", and an unknown word right before a dose as "Not a medicine name Echo knows". The heard word is never replaced. Users can also type the medicines they take (kept on the phone). Echo then listens for those names first; in the speech test, names found rose from 41 to 47 of 48 when the medicine was on the list.
5. **Rules-based extraction.** No language model is involved. A doctor-visit or hearing-aid-sale schema says which facts to look for.
6. **No anchor, no claim.** Every fact must quote the transcript word for word. Code rejects any fact whose quote is not found, and any number that is not in its quote.
7. **Stamps.** A fact is **Heard clearly** only when every value is in its quote and its medicine name is an exact, unambiguous match. Otherwise it is **Check this**. A checklist question nobody raised is **Not discussed**.

## How well it does (scripted tests)
`pnpm evals` runs the whole pipeline on 27 scripted conversations (fictional, read by actors), including the attacks our red-team agent wrote to make Echo invent facts. Latest run: **83 of 83 planted facts kept, 0 made up, 0 without a quote**, and every number and medicine name flagged. The **Test results** page in each app shows the same numbers. On real speech, 12 mock GP consultations from the PriMock57 dataset (114 minutes, CC BY 4.0), the speech engine got 36.5% of words wrong. Even so, every medicine fact Echo built that the doctor did not say was stamped Check this, and none was marked Heard clearly (docs/SPIKES.md). The scripted runs are conversations written for testing, not real visits; real speech is harder, and the drug-name bench in docs/SPIKES.md shows where speech recognition still mishears names.

## What it does not do
- It gives no medical, legal or financial advice and calculates no doses. It says what was said: "said", "sounds like", "check this".
- It never ranks sellers or recommends a purchase.
- It is not an interpreter and not an accommodation under disability law.
- It makes no claim to reduce errors and no claim of legal-evidence value (docs/CLAIMS.md).

## Privacy
Audio and transcripts stay on the device by default. After a visit, receipts are kept in the browser's storage and audio is not kept. Every visit can be deleted. Sharing is off by default, and a shared file has no audio. Sample and test data use only actors with written releases (docs/RELEASES.md). More in docs/PRIVACY.md.

## Repository
```
engine/        pure TypeScript: detectors, extractor, anchor check, verifier, gap check, label and quote comparison, consent ledger, session
ui/            shared React components, design tokens, browser platform code (capture, Whisper worker, storage, player)
apps/echo-care/   Echo Care (schemas: doctor-visit, pharmacy-counter, physio-visit)
apps/echo-cover/  Echo Cover (schema: hearing-aid-sale)
evals/         scripted consults, eval harness, red-team notes
mcp-eval/      MCP server so Kiro can run the evals and inspect a failing case
powers/        the echo-kit Kiro power (add a conversation type)
.kiro/         steering, specs, hooks and custom agents
docs/          build guide, Kiro write-up, sources, claims, privacy, releases, spikes
```

## Checks
```bash
pnpm lint && pnpm typecheck && pnpm test   # unit and property-based tests (fast-check)
pnpm evals                                 # fails on any made-up or unanchored fact
pnpm evals --break                         # proves the harness fails with a broken extractor
pnpm --filter echo-care e2e                # Playwright with axe accessibility checks
pnpm --filter echo-cover e2e
```

## Built with Kiro
All development used Kiro: spec-driven tasks in `.kiro/specs/`, steering in `.kiro/steering/`, four agent hooks, a custom eval MCP server, a Kiro power and two custom agents (schema writer, red team). Details and evidence are in docs/KIRO.md.

## Sources and licences
Every model, dataset and library is listed with its licence in docs/SOURCES.md. Code is under the MIT licence (LICENSE).
