# Scripted consults (eval seeds)

Four finished examples: care-01 (doctor visit), care-02 (pharmacy), cover-01 and cover-02 (two sellers, built to test the comparison). Kiro writes the remaining 11 (8 Care, 3 Cover) in the same format.

## Format
`{ id, app, schemaId, seller?, segments:[{id,startMs,endMs,text}], planted:[{key,fields,quote}], plantedGapItemIds:[], label?, expectedLabelFlags?, comparisonWith?, expectedComparison? }`

## Rules for writing consults
1. Actors only; fictional names and prices; no real patient, customer or business.
2. Each segment is 3 to 8 seconds long, ordered, non-overlapping; text is what is said, without speaker labels.
3. Every planted fact has a `quote` that is a verbatim substring of the joined, normalised transcript (the eval harness checks this).
4. Exactly one planted gap per consult (`plantedGapItemIds`), a checklist item that is truly never mentioned.
5. Vary the cases: numbers spoken as words and digits; dose and frequency in different segments; "fifty" vs "fifteen" in separate consults; a drug name misspelled by the speech engine (for example "metformine"); filler words; a sentence with a negation ("do not take").
6. Include at least two consults with a `label` mismatch and two where the label matches.
7. Record each consult as audio with consenting actors who signed a release, for the sample-consult mode (S23).
