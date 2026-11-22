# Evidence we produce (fill honestly; report n and limits)

Status on Nov 21, 2026: sections 1 and 2 have measured results; sections 3 and 4 have not been run yet.

## 1. Eval harness (every build)
Facts kept, dropped, invented, unanchored; flagged-token recall; checklist accuracy; number of runs. Gate: invented = 0 and unanchored = 0.

**Latest run (Nov 21, 2026, `pnpm evals`, recorded in `evals/results.json`):**

| Measure | Result |
|---|---|
| Scripted conversations | 27: 12 Echo Care doctor and pharmacy, 2 physiotherapy, 5 Echo Cover, 8 kept from the red-team attacks |
| Planted facts kept | 83 of 83 (0 dropped) |
| Invented facts | 0 |
| Facts without a verbatim quote | 0 |
| Field recall | 100% (was 99.3% before "when you need it" was read as a frequency) |
| Flagged-token recall (doses, medicine names, money, percentages, durations) | 100% |
| Checklist accuracy (asked / not discussed) | 100% |
| Label-check and quote-comparison cases checked | 7 and 3, all passed |

The gate is checked in the other direction too: `pnpm evals --break` swaps in a deliberately broken extractor and must fail, and it does.

**Red-team attacks** (`evals/redteam/`, written by the `red-team` custom agent, 21 scripted transcripts designed to make Echo state something nobody said):

| Date | Attacks that produced an invented fact | Attacks that produced an unanchored fact |
|---|---|---|
| Nov 13, 2026, before fixes | 15 of 21 | 0 |
| Nov 13, 2026, after the clause fix | 7 of 21 | 0 |
| Nov 21, 2026, after the last six fixes | 0 of 21 | 0 |
| Nov 21, 2026, after the frequency changes (attack 13 caught and fixed in the same change) | 0 of 21 | 0 |

**Limits:** all conversations are scripted and read by actors (the project owner for the sample audio). The harness runs on transcript text, so speech-recognition errors are measured separately (section 2). The same people wrote the scripts and the extractor, so the cases may share blind spots; the red-team attacks are the only adversarial part, and they were also written with Kiro.

## 2. Drug-name accuracy
Spoken drug names in quiet, in noise, with accents. Report measured rates. No target is claimed before the first run.

**Bench (`evals/src/asr-bench.ts`, details in docs/SPIKES.md):** 24 sentences, each a medicine with a dose, read by two macOS synthetic voices (Daniel en-GB, Aman en-IN), so 48 clips. Run on the laptop CPU in Node. "Found" means Echo shows the right medicine, either exactly or as "sounds like".

| Model (as used) | Name heard exactly | Name found | Dose number right |
|---|---|---|---|
| whisper-base.en with medicine prompt (app default), Nov 18, 2026 | 34/48 | 41/48 | 47/48 |
| whisper-large-v3-turbo, no prompt (opt-in `?model=turbo`), Nov 13, 2026 | 37/48 | 46/48 | 48/48 |
| whisper-tiny.en with prompt, Nov 13, 2026 | 23/48 | 38/48 | 46/48 |

**With the user's own medicines list** (Nov 21, 2026; a 5-name list per clip): when the clip's medicine was on the list, names found rose from 41 to 47 of 48 and exact names from 34 to 41, with no wrong medicine named. When it was not on the list, results were unchanged (41 of 48), with one wrong but flagged name (prednisone, shown as "Could also be prednisolone?").

When a name is not recognised, Echo does not guess. A word heard right before a dose that is not everyday English is shown as "Not a medicine name Echo knows" and marked Check this. Across 329 eval, red-team and bench segments this flagged 21 words, all of them misheard medicine names, and no ordinary words.

**Real voice** (Nov 21, 2026, `evals/src/real-voice.ts`): the owner's five recordings of the sample scripts (one speaker, quiet room, 23 segments, 296 words) through the app's speech set-up and the eval scoring. Word error rate 13.2%; 18 of 18 planted facts kept; 0 invented; 0 without a quote. Before Echo Cover got its own prompt words it was 14.5%, 15 of 18 and 2 invented (details in docs/SPIKES.md).

**Real doctor speech** (Nov 22, 2026, PriMock57, CC BY 4.0, `evals/src/primock.ts`, numbers in `evals/primock-results.json`): 12 mock UK GP consultations, 114 minutes of doctor audio through the app's full speech path.
- Word error rate: 36.5%.
- Medicine names: 27 of 37 said names shown.
- Medicine facts: 30 of 46 reference facts rebuilt from speech.
- 6 extra medicine facts, all stamped Check this, and **no wrong medicine stamped Heard clearly**.

Three problems found here were fixed: ordinary words in the medicine list, ordinary words joined into medicine names, and a prompt-induced wrong name. Details are in docs/SPIKES.md.

**Not measured yet:** background noise in a real clinic, older speakers, and US accents. Synthetic voices are cleaner than real speech, so real-world rates will be lower. Names that Whisper turns into ordinary words ("water in" for warfarin) are not recovered by any model tried.

## 3. Recall comparison (audio alone vs Echo receipt)
**Status: not run.** Planned design:
- Participants: 3 to 5 people with hearing loss if reachable (US and UK preferred); otherwise say who they were. Written consent.
- Material: a scripted consultation by actors with 8 planted facts. No real patient data.
- Conditions: memory only vs audio replay vs Echo receipt; test at 10 minutes and 24 hours.
- Report: sample size, scores, limits. The validation doc found no study in hearing-impaired patients; this is a small test, not proof.

## 4. Interviews
**Status: none held yet.** Older adults with hearing loss, their adult children, pharmacists. Validation doc aim: 20 to 30 older adults plus adult children (US, UK, Australia) and 10 pharmacists. Scaled-down aim in the hackathon window: 5 to 8 and 2 to 3 pharmacists, labelled honestly. Record consent; store notes without names.

## 5. Open items from the validation doc
Direct community voices outside UK and US; older-adult smartphone ownership by country; recording law by state and country (counsel before launch); payer interest from hospitals, pharmacies and hearing-aid clinics.
