# Sources, models, datasets and licences
Record the licence and the date opened for every item. Anything not written during the submission period must be disclosed.

## Rules and hackathon
- Kiroween 2026 official rules and overview (Devpost), saved Nov 12, 2026: https://kiroween.devpost.com/rules

## Problem evidence (from the validation doc v2; open and verify each)
- WHO deafness and hearing loss: https://www.who.int/health-topics/hearing-loss
- Global Burden of Disease 2019, hearing loss (Lancet): https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(21)00516-X/fulltext
- RNID evidence review: https://rnid.org.uk/what-we-do/evidence-hub/access-to-healthcare-evidence-pack/evidence-review/consequences-for-healthcare/
- Physician-patient communication failure and medication errors: https://pubmed.ncbi.nlm.nih.gov/22904014
- Hearing loss at the pharmacy (Hearing Journal): https://www.ovid.com/jnls/thehearingjournal/fulltext/10.1097/01.hj.0000935968.26392.01~hearing-loss-at-the-pharmacy-a-qualitative-study-of
- Pharmacy Times, deaf patients: https://www.pharmacytimes.com/view/how-pharmacists-can-better-assist-deaf-patients (opened)
- E-prescription discrepancies (AHRQ PSNet): https://psnet.ahrq.gov/issue/physician-intent-pharmacy-label-prevalence-and-description-discrepancies-cross-sectional
- Sig quality (JMCP): https://www.jmcp.org/doi/10.18553/jmcp.2018.17404
- Consultation recording for patients 50+: https://www.tandfonline.com/doi/full/10.1080/10410236.2019.1669270
- ACCC hearing-aid sales (ABC): https://www.abc.net.au/news/2017-03-02/consumer-watchdog-puts-hearing-aid-industry-on-notice/8319738 ; CHOICE: https://www.choice.com.au/health-and-body/optical-and-hearing/hearing/articles/profit-hungry-hearing-clinics-put-on-notice-by-the-accc-030317
- AI scribe error study: https://www.researchgate.net/publication/395991766_Clinical_AI_Scribes_in_primary_care_accuracy_error_severity_and_implications_for_clinical_practice ; Abridge feedback: https://arxiv.org/pdf/2512.04118
- US one-party and all-party recording states (AHCJ): https://healthjournalism.org/blog/2026/07/dear-doctor-your-patient-may-be-recording-this-visit/
- DOJ Trinity Health settlement: https://www.justice.gov/opa/pr/justice-department-reaches-americans-disabilities-act-settlement-trinity-health-systems-iowa

## Models, libraries, datasets (fill as chosen; record licence)
- `idb` 8.0.4 (IndexedDB wrapper, used by `ui/src/platform/idb-store.ts`): ISC licence, checked on the npm registry Nov 12, 2026: https://www.npmjs.com/package/idb
- On-device English speech model (spike S16, provisional): `Xenova/whisper-tiny.en`, Apache-2.0 per its Hugging Face model card (checked Nov 12, 2026): https://huggingface.co/Xenova/whisper-tiny.en . Alternative under evaluation: `Xenova/whisper-base.en`, Apache-2.0: https://huggingface.co/Xenova/whisper-base.en . Both are ONNX conversions of OpenAI Whisper.
- `@huggingface/transformers` 4.3.2 (runs the speech model on the device, `ui/src/platform/asr-worker.ts`): Apache-2.0, checked on the npm registry Nov 12, 2026: https://www.npmjs.com/package/@huggingface/transformers . Pulls in `onnxruntime-web` and `onnxruntime-node` (MIT), `sharp` (Apache-2.0), `@huggingface/jinja` (MIT) and `@huggingface/tokenizers` (Apache-2.0) as its own dependencies (licences checked on npm the same day).
- Drug-name list: `engine/data/drugs.json`, 1,755 generic names built by `scripts/build-drug-list.mjs` from the FDA National Drug Code Directory (`https://www.accessdata.fda.gov/cder/ndctext.zip`, downloaded Nov 13, 2026): substance names of approved human prescription and OTC drugs, salts and everyday words removed, plus 19 UK/INN names (paracetamol, salbutamol, ...). Public domain, CC0 1.0 per https://open.fda.gov/license/ (checked Nov 13, 2026). Generic names only, no brand names.
- English guard: `engine/data/english-guard.json`, built by `evals/src/build-english-guard.ts` from `/usr/share/dict/web2` (Webster's Second International Dictionary, public domain, as shipped with macOS/FreeBSD): only words that would otherwise near-match a medicine.
- Everyday English words: `engine/data/common-english.json` (39,546 words of 4+ letters, about 105 KB gzipped), built by `scripts/build-common-english.mjs` from SCOWL / English Speller Database (ESDB) size 35, US and GB spellings, generated at https://app.aspell.net/create (downloaded Nov 18, 2026). Licence: permissive (use, copy, modify, distribute and sell, without fee) provided the copyright and permission notice is kept; the full notice is copied into the file's `licence` field. Copyright 2000-2026 Kevin Atkinson; most underlying sources are public domain (12dicts, ENABLE2K). Used so an ordinary word just before a dose is never taken for an unknown medicine name.
- Sample consult audio: `apps/echo-care/public/samples/` (care-01, care-02) and `apps/echo-cover/public/samples/` (cover-01, cover-04, cover-02). Original recordings made Nov 21, 2026 for this project, reading docs/RECORDING-SCRIPT.md (fictional script, no real patient, customer or business). Release: pending in docs/RELEASES.md; the files are gitignored until it is recorded. Processed on the owner's Mac with ffmpeg (trim, loudness normalisation, MP3 via LAME at 24 kHz mono, 48 kbps); ffmpeg is a local tool and is not shipped. Splits checked by transcribing each segment with whisper-large-v3-turbo (MIT, already listed under the speech spike).
- Label OCR approach (spike): licence ____
- Hosted model for extraction (capped proxy): terms ____
- Hindi/Hinglish model Shruti (stretch only): https://huggingface.co/udgamlabs/Shruti , Apache-2.0 per its card

## Development and test tools (not shipped to users; licences checked on npm Nov 13, 2026)
- `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.4.0 (eval MCP server and its test): Apache-2.0. `zod` 4.6.7: MIT.
- `@playwright/test` 1.65.0 and its Chromium download: Apache-2.0.
- `@axe-core/playwright` 4.14.0 and `axe-core` 4.14.0 (accessibility checks): MPL-2.0. Used unmodified as test dependencies.
- `@testing-library/react` 16.3.3 and `@testing-library/dom` 10.4.2: MIT.
- `vite-node` 2.1.8 (runs the eval harness): MIT.

## Pre-existing work disclosed
None, unless listed here: ____
