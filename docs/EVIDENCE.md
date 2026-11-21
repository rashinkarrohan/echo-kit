# Evidence we produce (fill honestly; report n and limits)

Status on Nov 21, 2026: sections 1 and 2 have measured results; sections 3 and 4 have not been run yet.

## 1. Eval harness (every build)
Facts kept, dropped, invented, unanchored; flagged-token recall; checklist accuracy; number of runs. Gate: invented = 0 and unanchored = 0.

**Latest run (Nov 21, 2026, `pnpm evals`, run 49 recorded in `evals/results.json`):**

| Measure | Result |
|---|---|
| Scripted conversations | 26: 12 Echo Care doctor and pharmacy, 2 physiotherapy, 5 Echo Cover, 7 kept from the red-team attacks |
| Planted facts kept | 82 of 82 (0 dropped) |
| Invented facts | 0 |
| Facts without a verbatim quote | 0 |
| Field recall | 99.3% (the one miss is in care-04) |
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

**Limits:** all conversations are scripted and read by actors (the project owner for the sample audio). The harness runs on transcript text, so speech-recognition errors are measured separately (section 2). The same people wrote the scripts and the extractor, so the cases may share blind spots; the red-team attacks are the only adversarial part, and they were also written with Kiro.

## 2. Drug-name accuracy
Spoken drug names in quiet, in noise, with accents. Report measured rates. No target is claimed before the first run.

**Bench (`evals/src/asr-bench.ts`, details in docs/SPIKES.md):** 24 sentences, each a medicine with a dose, read by two macOS synthetic voices (Daniel en-GB, Aman en-IN), so 48 clips. Run on the laptop CPU in Node. "Found" means Echo shows the right medicine, either exactly or as "sounds like".

| Model (as used) | Name heard exactly | Name found | Dose number right |
|---|---|---|---|
| whisper-base.en with medicine prompt (app default), Nov 18, 2026 | 34/48 | 41/48 | 47/48 |
| whisper-large-v3-turbo, no prompt (opt-in `?model=turbo`), Nov 13, 2026 | 37/48 | 46/48 | 48/48 |
| whisper-tiny.en with prompt, Nov 13, 2026 | 23/48 | 38/48 | 46/48 |

When a name is not recognised, Echo does not guess. A word heard right before a dose that is not everyday English is shown as "Not a medicine name Echo knows" and marked Check this. Across 329 eval, red-team and bench segments this flagged 21 words, all of them misheard medicine names, and no ordinary words.

**Not measured yet:** real human voices (beyond the owner's own sample recordings, which were only used to check the splits), background noise, older speakers, and US accents. Synthetic voices are cleaner than real speech, so real-world rates will be lower. Names that Whisper turns into ordinary words ("water in" for warfarin) are not recovered by any model tried.

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
