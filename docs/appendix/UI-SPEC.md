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
1. `/home`: brand "Echo Care"; title "Turn what was said into a receipt you can check." Intro: "Follow the conversation with large-text captions. Afterwards, check each fact against the words it came from." Primary "Start a visit". Secondary "Play sample consult". Show a small example receipt with Heard clearly / Check this / Not said, the three-step explanation, the exact on-phone privacy sentence, and the Care disclaimer. When saved live visits exist, show their count and "View saved visits". No microphone or storage access is needed to view this screen.
2. `/visits`: "Saved visits" lists live receipts stored on this phone, newest first, with visit type, date, fact count and an "Open receipt" action. Restored receipts say "Audio not kept" and show no dead audio controls. Empty, loading and storage-error states include a route back to starting a visit.
3. `/consent`: title "Before we start". Three toggles with plain labels: "Record this conversation", "Turn speech into text on my phone", "Share a summary (off unless I choose)". Primary button "I agree and continue" (disabled until record + transcribe are on). Secondary "Learn how my data is kept".
4. `/doctor-card`: a full-screen large-text card to show the doctor: "I have hearing loss. Please face me and speak slowly. May I record this visit so I can check what you said?" Buttons: "They agreed, start" and "Skip".
5. `/record`: top: caption area (24 px, newest at bottom, `aria-live="polite"`), flagged tokens shown with an icon and underline. Bottom bar: big "Please repeat" button (shows the speaker card), "Pause", "Stop and review", and "Discard recording" (asks first: nothing is kept). Uncertainty line visible. While audio may be captured, no navigation link is shown. A refused or missing microphone, or a model error, shows "Try again" and "Back to home"; starting without consent says "Echo needs your consent before it can record." with a link to Before we start.
6. Speaker card (full screen, opens from Please repeat): "Please say the medicine name and the dose again, slowly." Button "Done".
7. `/read-back`: for each medicine fact: "I heard: metformin, 500 milligrams, twice daily." Buttons "Right" and "Not right". A "Show the doctor" toggle flips the screen to a speaker-facing large-text view of the same items and marks. Items are confirmed only by a tap.
8. `/receipt`: header with date and a stamp legend. One row per fact: label, value in large text, the original quote beneath in smaller text, a stamp (icon + "Heard clearly" / "Check this"), and an anchor chip "Hear it" (plays the 5 seconds around the quote; second chip "Slower"). A receipt restored after reload says "Audio not kept" instead of showing audio buttons. Below: "Questions I planned" list with Answered / Not discussed markers, each Answered with a chip when audio is still in memory. Footer: Share, Delete this visit. Delete requires an explicit confirmation and says it cannot be undone.
9. `/pharmacy`: pharmacist card: "I have hearing loss. Please write down how to take each medicine and any side effects, and speak slowly." then the same record and receipt flow with the pharmacy-counter schema.
10. `/label`: "Take a photo of the label" (or "Type it in"). Show three editable fields (medicine, dose, how often) for the user to confirm. Result: either "Matches what was said" or a flag card: "Said: once in the morning and once in the evening. Printed: once daily. Check with your pharmacist or doctor." with both anchors. No verdict on who is right.
11. `/share`: choose receipt, sections, recipient; "Share (no audio)" uses the share sheet; warning: "A file you send can't be taken back."
12. `/trust`: eval numbers: facts kept, dropped, invented (target 0), unanchored (target 0), flagged-token recall, runs, date.

## Echo Cover screens
1. `/home`: a distinct navy ledger-style product home. Title "Compare what sellers said, side by side." Explain the two-seller minimum, anchored receipts, neutral comparison, fictional actor sample, on-phone privacy and the Cover disclaimer. Primary "Start comparing"; secondary "Play sample consult". When saved live conversations exist, show their count and "Open saved comparisons".
2. `/saved`: "Saved seller conversations" lists live receipts stored on the phone, newest first, with seller name, date, fact count and "Open seller receipt". With two or more conversations, show "Compare these sellers". Restored anchors say "Audio not kept" rather than showing dead controls.
3. `/consent`: all-party consent wording with separate toggles for recording and on-device transcription. Do not request sharing consent because Echo Cover has no share action. Show the storage fallback explicitly when receipts cannot persist.
4. `/questions`: "Questions to ask before you buy". Each question from the schema checklist is a checkbox row with a small "Source" link. Button "Start recording a seller".
5. `/record`: seller or clinic name field (required and unique), Cover-specific caption uncertainty naming money, percentages, time periods and commission wording, Pause/Resume, "Stop and review", and deliberate "Discard recording" confirmation.
6. `/review/:seller`: the seller's gap check and receipt, explicit "N of at least 2 sellers recorded" progress, and contextual actions. Before two sellers, "Record another seller" is primary and comparison explains why it is disabled. At two or more, "Compare sellers" becomes primary. Deleting a seller conversation requires confirmation.
7. `/compare`: h1 "Compare sellers" and a ledger table: rows = price, what is included, trial and returns, financing, commission; columns = sellers in recording order. Each cell shows the value, its "Hear it" chip when audio remains in memory, "Audio not kept" after reload, or amber "Not discussed". A row where values differ gets a "Differs" tag. No ranking, no "best", no highlighting of one seller.
8. `/confirm/:seller`: a drafted message: "Hello, thank you for your time. To confirm what we discussed: [for each fact: label: value]. [For each Not discussed item: I would also like to know: question]. Please reply in writing to confirm." Button "Copy message". Text: "Echo does not send anything. Keep the reply." Include clear routes back to the seller review and comparison.
9. `/trust`: as in Care.

## Sample consult mode (both apps)
A prominent "Play sample consult" button on the home screen runs a bundled scripted consult with its audio and pre-made segments: captions appear on schedule, the receipt (or comparison) builds, anchor chips play the bundled audio. No model download, no microphone, works offline after first load. The audio is an actor reading docs/RECORDING-SCRIPT.md word for word, split at the pauses into the consult's segments (`apps/*/public/samples/*.mp3`). A sample with no recording (the misheard-names test sample) shows "Audio not kept" instead of audio buttons.

## Definition of done per app
- Every screen above exists with its states; axe reports zero serious or critical issues; keyboard-only completes the main flow; 200% zoom has no horizontal scroll; reduced motion removes animation.
- The main flow passes a Playwright test with the sample consult.
- No screen contains advice, a diagnosis, a dose calculation, or a seller ranking.
- Care and Cover are visibly distinct (see the distinctness rule).
