# Spec seed (paste into Kiro as the starting point)

## Requirements (EARS)
- WHEN a user starts a recording THE SYSTEM SHALL show a consent screen and store a consent record per purpose before capturing audio.
- WHEN audio is captured THE SYSTEM SHALL split it into 3 to 8 second segments and keep each segment's time range.
- WHEN a segment is transcribed THE SYSTEM SHALL show it as a large-text caption and normalise number words to digits for checking, keeping the original text for display.
- WHEN a caption contains a dose, drug name, date or frequency THE SYSTEM SHALL highlight it, and IF its confidence is low THEN THE SYSTEM SHALL mark it "Check this".
- WHEN the user taps "Please repeat" THE SYSTEM SHALL show the doctor a large-text card asking them to repeat the medicine and dose.
- WHEN the user starts read-back THE SYSTEM SHALL show what it heard ("500 mg twice daily") with Right / Not right buttons and a doctor-facing view.
- WHEN a schema is applied THE SYSTEM SHALL produce facts, each with a verbatim quote and the segment time range.
- IF a fact's quote is not a substring of the transcript (after normalisation) THEN THE SYSTEM SHALL reject the fact.
- WHEN a checklist is applied THE SYSTEM SHALL mark each item Answered, Not discussed or Unclear, with anchors.
- WHEN a doctor receipt and a pharmacy receipt both exist THE SYSTEM SHALL compare medicine, dose and frequency and flag differences as "Check with your doctor", linking both audio clips, without saying which is right.
- THE SYSTEM SHALL NOT give advice, diagnoses, legal or financial opinions, or dose calculations.

## Correctness properties (property-based tests)
1. Anchor soundness: every returned fact's quote occurs in the transcript.
2. No-anchor-no-claim: removing a quote invalidates its fact.
3. Noise invariance: filler words never create new facts.
4. Idempotence: same transcript and schema give the same facts.
5. Numeric faithfulness: numbers in a fact appear in its quote after normalisation.
6. Flag completeness: every number, drug-name and date token in a caption is highlighted.
7. Care-thread neutrality: the comparer never outputs which side is right; swapping the two receipts gives the same set of flags.
8. Read-back reflexivity: an answer identical to the facts matches fully.
9. Time ordering: anchors stay within audio duration and segment ranges do not overlap.

## Conversation schema (example, YAML)
```yaml
id: doctor-visit
language: [hi, en, hinglish]
facts:
  - key: medicine
    fields: [name, dose, frequency, duration]
  - key: follow_up
    fields: [when, what]
  - key: warning_sign
    fields: [description]
checklist:
  - id: q1
    text: "What is the name and purpose of the new medicine?"
    source: user-planned
disclaimer: "Echo records and summarises. It is not medical advice."
```
Also write `pharmacy-counter` (medicine, how to take, side effects) and `health-insurance-sale` (waiting periods, pre-existing conditions, exclusions and sub-limits, co-pay, claim process, free-look period). Every checklist item needs a source verified against IRDAI's own pages. Escalation path: grievance officer, then IRDAI Bima Bharosa, then the insurance ombudsman.

## Receipt states
Stamp per line: Heard clearly, Check this, Not said. Screens: consent, doctor card, recording with captions, read-back, receipt, Care thread, share/confirm, history. States: low-confidence, empty, error, permission denied.

## Design direction
Receipt metaphor (itemised lines, tappable chips). One signature motion: the receipt prints line by line as each line is verified. Accessibility first: large text, high contrast, read-aloud in Hindi and English, slow replay, large-print export. Two skins on shared tokens: warm and calm for Care, ledger-style navy and amber for Cover.

## Additions after the Care/Cover differentiation review
- F3 is a framework: each schema names the entity detectors it enables. Echo Care: numbers with units, drug names, frequencies, dates. Echo Cover: money amounts, percentages, durations, commission wording.
- F14 Pre-purchase question card (P1): WHEN a sales conversation is about to start THE SYSTEM SHALL show the sourced questions as a checklist the user can tick, and unticked unanswered questions SHALL appear as Not discussed in the gap check.
- F15 Quote comparison (P0): WHEN two or more sales conversations exist THE SYSTEM SHALL show confirmed fields side by side (total price, inclusions, trial and returns, financing interest and total repayment, commission disclosure) with audio anchors and Not discussed for missing fields, and SHALL NOT rank sellers or recommend a purchase.
- PB11 Comparison neutrality: the comparison never outputs a ranking or recommendation, and reordering conversations gives the same differences.
- F10 Echo Cover is P0: Skeleton Crew requires two distinct apps in two folders.
