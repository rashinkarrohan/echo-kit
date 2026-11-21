# Claims table (what we can say, what we cannot)

Source of figures: Echo Kit validation doc v2 (Nov 11, 2026). Figures were first read from search results. Kiro opened each original on Nov 21, 2026 and recorded what it found under "Source check" below; **the owner confirms each one before it goes in the pitch.** Status column: Open / Opened (date): result.

| Claim | Evidence | Strength | Say this | Status |
|---|---|---|---|---|
| About 1.57 billion people had hearing loss in 2019 (20.3%), 62.1% of them over 50 | GBD 2019 | Strong | "Most people with hearing loss are over 50" | Opened Nov 21, 2026: confirmed in the abstract (S1). Owner to confirm |
| Only 17% of those who could benefit use a hearing aid (WHO) | WHO | Strong | "Most go unaided" | Opened Nov 21, 2026: **not on the WHO fact sheet**; only a secondary source found (S2). Do not use until the owner finds it in the World Report on Hearing |
| England 2025: 10.6% of deaf and hard-of-hearing people understood all information in NHS appointments; 18.3% understood none (n=1,114) | RNID survey | Strong (UK) | "In a 2025 England survey, most left appointments without full understanding" | Opened Nov 21, 2026: 10.6% and 18.3% confirmed; n=1,114 not seen on the page (S3). Owner to confirm |
| Medicine mishearing: about 10% of clinicians said hearing-loss miscommunication contributed to medication errors several times a year | Age and Ageing 2020 | Moderate | "Clinicians report it contributes to medication errors" | Opened Nov 21, 2026: figure found, but **SOURCES.md linked a different study** (S4). Owner to confirm the wording |
| Label vs intent: about 10% of 25,000 e-prescription directions problematic | JMCP | Moderate | "Printed directions can differ from intent" | Opened Nov 21, 2026: confirmed (S5). Owner to confirm |
| AI scribes: 1.47% hallucination, 3.45% omission; 18.5% of safety reports concern medication names, doses or instructions | Primary-care evaluation; Abridge feedback study | Moderate | "AI summaries make errors, so every dose links to its audio" | Opened Nov 21, 2026: 18.5% confirmed; **1.47% and 3.45% come from a different paper** than the one linked (S6). Owner to confirm |
| Hearing-aid sales (Australia): commissions up to 15%; some buyers paid $10,000 for aids found online at half price; finance up to 25.9% | ACCC via ABC and CHOICE | Moderate | "Australian regulator findings; US not checked" | Opened Nov 21, 2026: 15% and $10,000 confirmed; **"finance up to 25.9%" not found** in ABC, CHOICE or the ACCC report (S7). Drop the 25.9% |
| Recordings improve recall in older patients | Systematic review of patients 50+ | Moderate | "Recordings help older patients' recall in studies; not tested in hearing-impaired patients" | Opened Nov 21, 2026: confirmed (S8). Owner to confirm |

## Source check (opened by Kiro on Nov 21, 2026; owner to confirm)
Each note records what the page said when opened, paraphrased. Nothing here changes a `verified` flag or replaces a source; the owner decides both.

- **S1. GBD 2019 hearing loss** (Lancet 2021, PMID 33714390). The Lancet page returned 403, so the abstract was read through Europe PMC instead. It estimates 1.57 billion people with hearing loss in 2019 (20.3%) and says 62.1% of people with hearing impairment were older than 50. Matches the claim.
- **S2. WHO "17% use a hearing aid".** The current WHO fact sheet gives 430 million people needing rehabilitation and over 25% of people over 60 with disabling hearing loss, but no 17% figure. The 2021 WHO editorial in the Bulletin (PMC8085630) does not contain it either. ENT & Audiology News (2021) quotes the World Report on Hearing as saying only 17% of those in need of ear and hearing care are using the devices they need: https://www.entandaudiologynews.com/features/audiology-features/post/unpacking-the-world-health-organization-s-world-report-on-hearing-what-does-it-say . That is a secondary source, and its wording is broader than "hearing aid". The report PDF could not be downloaded automatically (the WHO IRIS site needs a browser). Owner: open the World Report on Hearing (https://iris.who.int/items/0a86e86a-d6e5-4ca7-a9eb-906a18f76348) and find the page, or drop the figure.
- **S3. RNID.** The RNID "consequences for healthcare" page cites Parmar et al. (2025): 10.6% understood all information in NHS appointments and 18.3% understood none. The sample size of 1,114 was not shown on that page; it may be in the linked report.
- **S4. Age and Ageing 2020.** The "about 10%" figure is in PMID 32253433 (Age Ageing 2020;49(5):873): 10% of respondents said communication problems contributed to several medication error events a year. The SOURCES.md link (PMID 22904014) is a **different study**: Mira et al., Family Practice 2013, 382 patients over 65 in Spain, about physician-patient communication failure and medication errors. Both are now listed in SOURCES.md; the owner picks which supports which sentence.
- **S5. JMCP Sig quality.** Confirmed: about 25,000 e-prescriptions were reviewed and about 10% of the directions had quality-related events.
- **S6. AI scribes.** The 18.5% figure is confirmed in the Abridge feedback study (arXiv 2512.04118): 18.5% of safety-related feedback concerned medication names, doses or instructions. The 1.47% hallucination and 3.45% omission rates are from Asgari et al., npj Digital Medicine 2025 (PMID 40360677, https://pubmed.ncbi.nlm.nih.gov/40360677/), which measured 12,999 clinician-annotated sentences across 18 LLM note-writing set-ups. They are not from the linked primary-care scribe study (Draper et al. 2025, PMC13528381), which reports that omissions were 83.8% of errors. Neither figure is about noise, so docs/CONTEXT.md's "AI scribes in noise" wording is wrong. The pitch line "AI summaries make errors" is supported either way.
- **S7. ACCC hearing-aid sales.** The primary source is the ACCC report "Issues around the sale of hearing aids: Consumer and clinician perspectives" (3 March 2017): https://www.accc.gov.au/system/files/Issues%20around%20the%20sale%20of%20hearing%20aids%20-%20Consumer%20and%20clinical%20perspectives.pdf . It says commissions can be as much as 15%. It mentions customers entering finance plans, including one plan that could not be cancelled, but gives no interest rate. ABC reports prices up to $15,000 a pair and buyers who paid $10,000 and then found the aids online at half the price. No source gives 25.9%.
- **S8. Recall review.** Dommershuijsen et al., Health Communication 2021 (PMID 31556750): 25 studies; consultation recordings improved recall for patients aged 50 and over. None were in hearing-impaired patients, so keep the existing "not tested" wording.

### Echo Cover checklist sources (`apps/echo-cover/schemas/hearing-aid-sale.yaml`)
All five items are `verified: false`. All current sources are Australian and from 2017, while the app targets the US first, so the card should say where each question comes from.

| Item | Current source | What the source says | Suggestion for the owner |
|---|---|---|---|
| q-total-price | ABC | Prices up to $15,000 a pair; aids later found online at half price. Supports both parts of the question | Keep |
| q-inclusions | CHOICE | **Does not mention** fitting, follow-ups or warranty; nor does the ACCC report | Replace. Candidate (US): Boys Town National Research Hospital, https://www.boystownhospital.org/knowledge-center/questions-to-ask-audiologist , which covers fitting fees, follow-up visits included or billed separately, a 1-year warranty, a 30-day trial and restocking fees |
| q-trial-returns | CHOICE | Advises getting a 30-day trial; does not mention return terms | Partly supported. The Boys Town page covers both trial and return (restocking) terms |
| q-financing | ABC | **No mention of finance** | Replace with the ACCC report (S7) or CHOICE, which mention finance plans. Neither gives rates, so the question stays "ask what the rate is" |
| q-commission | ABC | Undisclosed commissions up to 15%; the ACCC report says the same | Keep, or point to the ACCC report as the primary source |

## Do not claim
- "Echo reduces errors"
- Any percentage of hearing-impaired people mis-sold insurance or hearing aids
- Legal-evidence value of recordings
- That no other app does this (say: existing tools caption or summarise; Echo checks medicine facts, compares quotes and shares them)
- That doctor and pharmacist spoken instructions contradict each other often (no study; the label check compares speech with print)
- That Echo is an interpreter or a medical, legal or financial adviser. It is not an ADA accommodation.

## Evidence we will produce ourselves (report sample sizes and limits)
Eval results, drug-name accuracy in noise and accents, interviews, recall comparison (audio alone vs the Echo receipt). See docs/EVIDENCE.md.
