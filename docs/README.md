# Docs index

Start with the main [README](../README.md). Each doc below stands alone.

## For judges (by the five judging criteria)

| Criterion                    | Read                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Impact                       | [EVIDENCE.md](EVIDENCE.md): what Echo was measured to do, including real doctor speech, with sample sizes and limits.<br>[CLAIMS.md](CLAIMS.md): what we can and cannot claim, with each source opened and recorded.                                                     |
| Technological Implementation | [KIRO.md](KIRO.md): the eight write-up prompts with dates, commits and evidence, plus the experiment log.<br>[SPIKES.md](SPIKES.md): every technical decision, the measurements behind it, and what was rejected.<br>`.kiro/`: steering, specs, hooks and custom agents. |
| Design                       | [appendix/UI-SPEC.md](appendix/UI-SPEC.md): every screen and state.<br>[appendix/DESIGN-TOKENS.md](appendix/DESIGN-TOKENS.md): colours with contrast checked.<br>[PRIVACY.md](PRIVACY.md): consent, storage and sharing.                                                 |
| Innovation                   | The main [README](../README.md): one skeleton (`engine/`) and two distinct apps, with every fact quoted from the audio, nothing guessed, and quotes compared without ranking sellers.                                                                                    |
| Presentation                 | The demo video (link in the main README).                                                                                                                                                                                                                                |

## Rules and licences

- [RULES-COMPLIANCE.md](RULES-COMPLIANCE.md): each official rule and how it is met.
- [SOURCES.md](SOURCES.md): every model, dataset and library, with its licence.
- [RELEASES.md](RELEASES.md): the people whose voices are used.

## How it was built

- [SPEC-SEED.md](SPEC-SEED.md): the features (F1 to F15) and correctness properties the specs in `.kiro/specs/` came from.
- [BUILD-GUIDE.md](BUILD-GUIDE.md): the step-by-step plan, one Kiro step per commit (`S<number>: …`).
- [PLAN.md](PLAN.md): the schedule.
- [CONTEXT.md](CONTEXT.md): the problem, the users chosen, and ideas dropped.
- [appendix/DETECTOR-SPEC.md](appendix/DETECTOR-SPEC.md): the detector and cue rules, with test vectors.
- [RECORDING-SCRIPT.md](RECORDING-SCRIPT.md): the fictional script read for the sample audio.
