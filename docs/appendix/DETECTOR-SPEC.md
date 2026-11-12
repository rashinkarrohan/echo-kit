# Appendix A: detector and cue specification (with test vectors)

Kiro implements detectors and cues exactly as below and writes these vectors as tests first (S4, S5, S6, S9). Add more vectors; never remove one to make a test pass.

## Cue syntax (used in schemas)
- A **cue alternative** is either a regular expression (case-insensitive, matched against the normalised text) or a detector reference written `@<detector>` (for example `@number`, `@drug`, `@frequency`).
- `any: [alt, alt]` matches if any alternative matches in a segment.
- `all: [[alt, alt], [alt]]` is a list of **groups**; it matches when every group has at least one alternative matching within a window of at most 3 consecutive segments.
- `windowWords: N` (facts only) is the maximum number of words between the first and last matched token of a fact (default 25).
- Result of a checklist item: `answered` if the whole `all` matches (anchors = the segments that matched); `unclear` if at least one but not every group matches; `not_discussed` if none match.

## Detector registry (ids used in schemas)
Care: `number`, `drug`, `frequency`, `date`. Cover: `money`, `percent`, `duration`, `commission`. Each returns `FlaggedToken { kind, text, segmentId, lowConfidence, suggestion? }`. Detectors never change the heard text.

## Normalisation vectors (S2)
| Input | Normalised |
| --- | --- |
| "Take FIFTY milligrams." | "take 50 milligrams" |
| "fifteen tablets" | "15 tablets" |
| "five hundred milligrams" | "500 milligrams" |
| "a hundred and twenty" | "120" |
| "two thousand dollars" | "2000 dollars" |
| "twelve percent" | "12 percent" |
| "half a tablet" | "0.5 a tablet" |
Idempotence: normalising a normalised string returns it unchanged.

## number (S4)
Matches digits with optional decimal and optional unit: mg, mcg, g, ml, units, tablet(s), capsule(s), drop(s), puff(s). Bare numbers are matched too.
| Input (normalised) | Expected tokens |
| --- | --- |
| "metformin 500 milligrams twice daily" | number "500 milligrams" |
| "take 2 tablets" | number "2 tablets" |
| "you have 15 minutes" | number "15" |
| "no numbers here" | none |

## frequency (S4)
Canonical forms: `1/day`, `2/day`, `3/day`, `4/day`, `prn`, `every-N-hours`, plus modifiers `morning`, `night`, `before-food`, `after-food`.
| Input | Token text | Canonical |
| --- | --- | --- |
| "once daily" / "once a day" / "one time a day" | as heard | 1/day |
| "twice daily" / "two times a day" / "twice a day" | as heard | 2/day |
| "three times a day" / "three times daily" | as heard | 3/day |
| "every 8 hours" | as heard | every-8-hours |
| "as needed" | as heard | prn |
| "after food" / "with food" | as heard | after-food |
| "in the morning" | as heard | morning |

## date (S4)
tomorrow, today, next week, next month, weekday names, month names with day numbers, "in N days|weeks|months", "N weeks from now".
| Input | Expected token |
| --- | --- |
| "come back in three months" (normalised "in 3 months") | date "in 3 months" |
| "see me on Tuesday" | date "tuesday" |
| "tomorrow morning" | date "tomorrow" |

## drug (S4)
Match tokens against `engine/data/drugs.sample.json` (marked `"sample": true`; the real list is a spike). A near match at edit distance 1 sets `suggestion` but never replaces the heard text.
| Input | Expected |
| --- | --- |
| "start you on metformin" | drug "metformin" |
| "metformine" | drug token "metformine" with suggestion "metformin" |
| "I like medicine" | none |

## money (S5)
Currency symbols or words (dollar(s), pound(s), euro(s), rupee(s)) with an amount; "per month|a month|monthly".
| Input (normalised) | Expected |
| --- | --- |
| "3800 dollars for the pair" | money "3800 dollars" |
| "$4200" | money "$4200" |
| "250 dollars a month" | money "250 dollars" + frequency-like "a month" |

## percent (S5)
`%`, "percent", "per cent".
| Input | Expected |
| --- | --- |
| "finance at 12 percent interest" | percent "12 percent" |
| "12%" | percent "12%" |

## duration (S5)
N + day(s)|week(s)|month(s)|year(s); the words "trial period", "return period", "warranty".
| Input | Expected |
| --- | --- |
| "30 days to return them" | duration "30 days" |
| "over 3 years" | duration "3 years" |

## commission (S5)
commission, incentive, bonus, "paid per sale", kickback.
| Input | Expected |
| --- | --- |
| "our staff earn a commission on sales" | commission "commission" |
| "no commission here" | commission "commission" (the detector flags the word; the user decides what it means) |

## Property PB6 / Cover equivalent
For generated sentences with planted tokens, every planted token appears in the flagged output.
