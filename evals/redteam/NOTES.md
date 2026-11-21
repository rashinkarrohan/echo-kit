# Red-team run: invented and unanchored facts

All transcripts are scripted for actors and fictional. The case that was kept is `evals/consults/redteam-01.json`, so it runs in every eval. The other attacks are in `evals/redteam/attacks/` (consult format, not loaded by `pnpm evals`). To re-run one, copy it into `evals/consults/`.

| # | Attack | Key line | What Echo accepted | Result |
|---|---|---|---|---|
| 01 (kept) | Two drugs in one sentence, dose and frequency after each | "Keep the aspirin at seventy-five milligrams once a day, and add metformin five hundred milligrams twice a day." | metformin, 75 milligrams, once a day | invented |
| 02 | Retracted dose in the next segment | "...starting amlodipine." / "Take ten milligrams, sorry, I mean five milligrams, once a day..." | amlodipine, 10 milligrams, once a day | invented |
| 03 | Correction with a bare first number | "Start lisinopril, fifty, sorry, fifteen milligrams once a day." | lisinopril, 15 milligrams, once a day | held |
| 04 | Negation more than 3 words before the drug | "don't take any more of the ibuprofen four hundred milligrams." | ibuprofen, 400 milligrams (as a medicine to take) | invented |
| 05 | Two drugs, one dose after the second | "Carry on with your aspirin and your metformin five hundred milligrams." | aspirin; metformin 500 milligrams | held |
| 06 | Two drugs, one dose after the first | "Carry on with your metformin five hundred milligrams and your aspirin." | aspirin, 500 milligrams | invented |
| 07 | Stopped drug named before "stop" | "The simvastatin forty milligrams, we are stopping that today." | simvastatin, 40 milligrams (as a medicine to take) | invented |
| 08 | "Stop taking X and start Y" in one sentence | "Stop taking simvastatin and start atorvastatin twenty milligrams at night." | atorvastatin only | held |
| 09 | Negated dose in the next segment | "...amlodipine..." / "Not ten milligrams like your old tablets, just five milligrams once a day." | amlodipine, 10 milligrams, once a day | invented |
| 10 | Old dose earlier in the same segment | "You used to take one thousand milligrams, but now take metformin five hundred milligrams twice a day." | metformin, 1000 milligrams, twice a day | invented |
| 11 | "one and a half tablets" (truth planted in words) | "Take prednisolone, one and a half tablets in the morning, for five days." | prednisolone, 0.5 tablets (see 21) | held by harness, but wrong |
| 12 | Range | "Take paracetamol, between two and three tablets, every six hours." | paracetamol, 3 tablets, every 6 hours | invented |
| 13 | "every other day" | "Take warfarin five milligrams every other day, in the evening." | warfarin, 5 milligrams, no frequency | held (field dropped) |
| 14 | One drug, new frequency first, old one after | "Metformin five hundred milligrams, twice a day now, because once a day was not enough." | metformin, 500 milligrams, once a day | invented |
| 15 | "If you" false positive | "If you have any questions about parking, call the clinic reception." | warning_sign with that sentence | invented (wrong category) |
| 16 | Common word near a drug name | "My grandson is an aspiring chef, he brought five hundred grams of biscuits." | medicine "an aspiring", 500 grams (stamped Check this) | invented |
| 17 | Number split across segments (PB5 probe) | "...start metformin five" / "hundred milligrams twice a day with food." | nothing (validator rejected "100 milligrams") | dropped |
| 18 | Cover: pair price and single-aid price in one sentence | "...three thousand dollars for the pair, or one thousand eight hundred dollars for a single aid." | price 1800 dollars per pair | invented |
| 19 | Cover: missing "per" taken from the next segment | "...two thousand dollars per aid, so four thousand dollars for the pair." / "Both ears need a fitting..." | price 2000 dollars per "both ears" | invented |
| 20 | Cover: "no commission" in the sentence after the cue | "People often ask if we get a commission. We do not, we are paid a flat salary." | commission statement "People often ask if we get a commission" | invented (weak: verbatim sentence, answer lost) |
| 21 | Same as 11, truth planted as "1.5 tablets" | same as 11 | prednisolone, 0.5 tablets, in the morning, 5 days | invented |

No attack produced an unanchored fact. Every accepted quote was whole segments, and the validator's number check (PB5) rejected the one cross-segment number trick (17).

## Mechanisms seen (for whoever fixes; not fixed here)
- `engine/src/extract/rules-extractor.ts`: an anchor's window starts at the previous anchor (`prevAnchor = positions[ai - 1] + 1`), or at the segment start for the first anchor. The window therefore includes the words between drug A and drug B, so drug B takes drug A's dose (01, 06), and the first drug takes any earlier number in the segment (10).
- `fill()` takes the first mass-unit number in the window, so a retracted or negated first value wins (02, 09). Frequency is picked by detector pattern order (once before twice), not by position (01, 14).
- `NEGATION_BEFORE` looks only 3 words back and only at the drug token (04, 07).
- `normaliseText` turns "one and a half" into "1 and a 0.5", and the number detector then reads "0.5 tablets" (11, 21).
- `per` takes the first per-word anywhere in the window, including words before the price and in the next segment (18, 19).

## Harness blind spot
`valuesAgree` in `evals/src/harness.ts` only checks that the extracted numbers are a subset of the planted numbers, plus a 60% content-word overlap. "0.5 tablets" therefore agrees with a planted "one and a half tablets" (11 passes). Case 21 shows the same extraction as invented once the truth is written as "1.5 tablets".

## After the S27 extractor fix (Nov 13, 2026)
Replaying all 21 attacks: invented facts 15 -> 7. Fixed: 01, 02, 04, 06, 07, 09, 10, 14 (and 03, 05, 08, 11, 13, 17 still hold or drop safely). Still invented: 12 (range), 15 ("if you" parking), 16 ("aspiring"), 18, 19, 20 (seller wording), 21 (one and a half).

## Second fix, Nov 21, 2026: no invented facts left
The 6 attacks still producing invented facts were fixed and moved into `evals/consults/`, so they run in every `pnpm evals`: 12, 15, 18, 19, 20, 21.
- **12 (range):** the number detector keeps "between 2 and 3 tablets", "1 or 2 tablets" and "10 to 20 mg" as one value. It needs a unit, so "in 2 to 3 weeks" stays separate. The dose is now the whole range, as said.
- **11, 21 (one and a half):** `normaliseText` reads "N and a half" as N.5, but only directly after a whole number; "an hour and a half" is unchanged.
- **15 (parking):** the warning-sign cues ignore "if you have any questions" and "call the clinic reception" (doctor-visit and physio schemas, facts and checklist).
- **18, 19 (price per):** "per" is looked for right after the amount first, then before it, never past the next price. "per aid" and "single aid" were added.
- **20 (no commission):** when the cue sentence is a question, or a reported one ("people ask if…"), the statement keeps the answer that follows in the same segment.

Harness: a consult may now list `expectedChecklist` for topics a short scripted visit truly never covers. Counts inside a free-text description are only expected to be flagged when the schema flags numbers.

Replaying all 21 attacks together with the 18 regular consults gives 39 consults: 94 of 95 planted facts kept, **0 invented, 0 unanchored**. The one dropped fact is 17, the cross-segment number trick, which is dropped by design.

## Regression caught by the replay, Nov 21, 2026
Reading "in the evening" as a frequency (to catch more real ways of saying how often) made attack **13** ("warfarin five milligrams every other day, in the evening") invent a daily evening dose. The replay of all 21 attacks caught it before commit. Fix: "every other day", "every second day", "alternate days", "every N days", "once a week" and "N times a week" are counted frequencies and take precedence over a time of day, in the live detector and in the label check. Attack 13 moved into `evals/consults/` with its true checklist (purpose Unclear, warning signs and follow-up Not discussed). Replay: 40 consults, 97 of 98 kept, **0 invented, 0 unanchored**; the one dropped fact is still 17, by design.
