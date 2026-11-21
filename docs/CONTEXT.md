# Context and decisions (public-safe)

## Problem (from the validation doc v2, Nov 11, 2026; originals opened Nov 21, 2026, see the source check in docs/CLAIMS.md)
Older adults with unaided hearing loss leave clinics and pharmacies without the content of what they were told, and nobody keeps a record. About 1.57 billion people have some hearing loss (20.3%), 62.1% of them over 50, and only 17% of those who could benefit use a hearing aid (17% not yet found in a WHO primary source; CLAIMS.md S2). England 2025 survey (n=1,114): 10.6% of deaf and hard-of-hearing people understood all information in NHS appointments; 18.3% understood none.
Unproven: that doctor and pharmacist spoken advice contradicts often; that hearing loss drives health-insurance mis-selling; that recordings help hearing-impaired patients' recall.

## Segments and markets
Lead segment: adults 65+ with age-related loss, unaided, with a smartphone, plus their adult children (co-user and buyer). Not a target: deaf sign-language users (their need is interpretation; ADA cases turn on interpreters). Launch order: US, UK, Australia; India and China later. Respect the older adult's independence: the patient controls sharing.

## Product decisions
- Echo Care (doctor + pharmacy) and Echo Cover (hearing-aid purchase conversations) as two distinct apps on one skeleton. Cover reframed from health-insurance mis-selling (no hearing link found) to purchase conversations with a documented link (hearing-aid sales, ACCC).
- Care thread demoted: compare the doctor's spoken instruction with the printed label (photo), not spoken vs spoken.
- Cover differentiators: pre-purchase question card, quote comparison across sellers, money/percent/duration/commission detectors.
- English-first; Whisper on-device by default; Hindi/Hinglish (Shruti) is a stretch goal.
- Dropped ideas (history): Entitlement Engine (2026 repos already include rules/case and document-check engines), scam checker, Poltergeist (motion sensing; conflicts with the builder's employer domain, see private/), Ghost Ears (phones already have sound alerts), Machine Ear, Witness Kit, Batch Check, Awaaz Kit.

## Competitors (as found; absence is not proof)
Live captioning apps marketed for doctor visits; AI scribes with patient summaries (Abridge, Heidi) sold mainly to clinicians; consumer visit recorders (Abridge for Patients, Medcorder, Hedy, Kiri, AI Doctor Notes about US$4.99/month; vendor sources, weak); free phone captioning in the US. Echo's gap: structured medicine facts, gap checks, quote comparison and family sharing after the visit.

## Technical findings (verify in spikes)
- LLM clinical note writing: 1.47% hallucination and 3.45% omission rates across 12,999 annotated sentences (npj Digit Med 2025; not a noise study, see CLAIMS.md S6); incorrect medication names, doses or instructions were 18.5% of safety-related reports in one feedback study. Hence audio anchors and the deterministic anchor check.
- On-device Whisper via WebGPU is the assumed default; model size, latency, per-word confidence and word timestamps are open spikes.
- Shruti (Hindi/English/Hinglish, 29.5 MB, Apache-2.0): Whisper-small scored far worse on Hindi in its published table; stretch goal only.
- Cost: a small hosted model behind a capped proxy is assumed to cost a fraction of a cent per consult (pricing seen in search, not verified).

## Hackathon facts
See docs/RULES-COMPLIANCE.md. 12,460 participants on Nov 12, 2026; $100,000 cash. Judging: Stage One pass/fail, then five equal criteria (Impact, Technological Implementation, Design, Innovation, Presentation), 10 points each. Judges may be unlisted and may use automated analysis.

## Lessons from 2025 winners
InteractionKit (1st): builders' own pain, hard tech hidden, hooks that auto-wire new gestures, fun app plus useful app. Impulse Kit (Best Skeleton Crew): vivid idea, plain JS, short Kiro description. Faxi: real excluded users. Winners had a one-line hook, a real person and a visible demo.

## Risks
Hinglish/accent accuracy; hallucination (anchor check); consent and privacy; two apps too similar (mitigated by F14, F15, detectors, distinct outputs); scope; cost during free testing; no tests with hearing-impaired users yet; ownership confirmation.

## Open questions
Team size (max 3) and Representative. All students (Best Student prize)? Registered for Kiroween 2025 (Ghost prize)? Hosted model and region. Written ownership confirmation (see private/).
