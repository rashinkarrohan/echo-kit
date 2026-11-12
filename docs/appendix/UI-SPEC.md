# Appendix C: screens, copy deck and states

Kiro builds each screen exactly as written. Where copy is given it is final; Kiro does not invent advice or claims. Both apps: English, phone portrait first, large text (see DESIGN-TOKENS.md), every screen has loading, empty, error and permission-denied states, and every list of results has an empty state.

## Global copy
- Consent wording (all-party everywhere): "Echo will record this conversation on your phone. Everyone in the conversation must agree. Audio and text stay on your phone unless you choose to share. You can stop and delete at any time."
- Disclaimer (Care): "Echo records and summarises what was said. It is not medical advice and not an interpreter."
- Disclaimer (Cover): "Echo compares what sellers said. It is not legal or financial advice and it does not recommend a purchase."
- Uncertainty line on captions: "Captions can be wrong. Numbers and medicine names are highlighted so you can check them."
- Mic denied: "Echo can't hear anything yet. Allow the microphone in your browser settings, then try again."
- Model loading: "Getting ready. This happens once and then works without internet."
- Generic error: "Something went wrong. Nothing was sent anywhere. Try again."

## Echo Care screens
1. `/consent`: title "Before we start". Three toggles with plain labels: "Record this conversation", "Turn speech into text on my phone", "Share a summary (off unless I choose)". Primary button "I agree and continue" (disabled until record + transcribe are on). Secondary "Learn how my data is kept".
2. `/doctor-card`: a full-screen large-text card to show the doctor: "I have hearing loss. Please face me and speak slowly. May I record this visit so I can check what you said?" Buttons: "They agreed, start" and "Skip".
3. `/record`: top: caption area (24 px, newest at bottom, `aria-live="polite"`), flagged tokens shown with an icon and underline. Bottom bar: big "Please repeat" button (shows the speaker card), "Pause", "Stop and review". Uncertainty line visible.
4. Speaker card (full screen, opens from Please repeat): "Please say the medicine name and the dose again, slowly." Button "Done".
5. `/read-back`: for each medicine fact: "I heard: metformin, 500 milligrams, twice daily." Buttons "Right" and "Not right". A "Show the doctor" toggle flips the screen to a speaker-facing large-text view of the same items and marks. Items are confirmed only by a tap.
6. `/receipt`: header with date and a stamp legend. One row per fact: label, value in large text, the original quote beneath in smaller text, a stamp (icon + "Heard clearly" / "Check this"), and an anchor chip "Hear it" (plays the 5 seconds around the quote; second chip "Slower"). Below: "Questions I planned" list with Answered / Not discussed markers, each Answered with a chip. Footer: Share, Delete this visit.
7. `/pharmacy`: pharmacist card: "I have hearing loss. Please write down how to take each medicine and any side effects, and speak slowly." then the same record and receipt flow with the pharmacy-counter schema.
8. `/label`: "Take a photo of the label" (or "Type it in"). Show three editable fields (medicine, dose, how often) for the user to confirm. Result: either "Matches what was said" or a flag card: "Said: once in the morning and once in the evening. Printed: once daily. Check with your pharmacist or doctor." with both anchors. No verdict on who is right.
9. `/share`: choose receipt, sections, recipient; "Share (no audio)" uses the share sheet; warning: "A file you send can't be taken back."
10. `/trust`: eval numbers: facts kept, dropped, invented (target 0), unanchored (target 0), flagged-token recall, runs, date.

## Echo Cover screens
1. `/consent`: same wording and toggles.
2. `/questions`: "Questions to ask before you buy". Each question from the schema checklist as a large tick-row with a small "Source" link. Button "Start recording a seller".
3. `/record`: seller name field (required: "Who are you talking to?"), live captions with money, percentages, durations and commission wording highlighted, "Stop and review".
4. `/review/:seller`: gap check for that seller: each question Answered (with "Hear it" chip) / Not discussed / Unclear.
5. `/compare`: a ledger table: rows = price, what is included, trial and returns, financing, commission; columns = sellers. Each cell shows the value, its "Hear it" chip, or an amber "Not discussed". A row where values differ gets a "Differs" tag. No ranking, no "best", no highlighting of one seller.
6. `/confirm`: a drafted message: "Hello, thank you for your time. To confirm what we discussed: [for each fact: label: value]. [For each Not discussed item: I would also like to know: question]. Please reply in writing to confirm." Button "Copy message". Text: "Echo does not send anything. Keep the reply."
7. `/trust`: as in Care.

## Sample consult mode (both apps)
A prominent "Play sample consult" button on the home screen runs a bundled scripted consult with its audio and pre-made segments: captions appear on schedule, the receipt (or comparison) builds, anchor chips play the bundled audio. No model download, no microphone, works offline after first load.

## Definition of done per app
- Every screen above exists with its states; axe reports zero serious or critical issues; keyboard-only completes the main flow; 200% zoom has no horizontal scroll; reduced motion removes animation.
- The main flow passes a Playwright test with the sample consult.
- No screen contains advice, a diagnosis, a dose calculation, or a seller ranking.
- Care and Cover are visibly distinct (see the distinctness rule).
