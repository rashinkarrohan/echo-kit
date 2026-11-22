/**
 * Echo Care copy not worded in docs/appendix/UI-SPEC.md (written by Kiro; neutral, no
 * advice; review before release). Spec wording comes from FINAL in @echo/ui.
 */
export const CARE = {
  appName: "Echo Care",
  viewSavedVisits: "View saved visits",
  savedVisitsLoading: "Opening saved visits.",
  savedVisitsError: "Saved visits could not be opened. Nothing was sent anywhere.",
  loadingApp: "Opening Echo Care.",
  storageFallback:
    "This browser cannot keep data after you close the page. Nothing was sent anywhere.",
  readBackTitle: "Read back what you heard",
  toReceipt: "See the summary",
  labelTitle: "Check the label against what was said",
  labelNoMedicine: "No medicine was heard yet, so there is nothing to compare.",
  labelAgain: "Check another label",
  backToReceipt: "Back to the summary",
  shareTitle: "Share a summary",
  shareWhich: "Which visits",
  shareSections: "What to include",
  shareFacts: "What was said",
  shareChecklist: "Questions I planned",
  shareReadBack: "Read back",
  shareLabel: "Label check",
  shareRecipient: "Who is it for? (optional)",
  shared: "Shared.",
  downloaded: "Saved to this phone as a file. You can send it from there.",
  shareCancelled: "Not shared.",
  doctorTitle: "Doctor visit",
  pharmacyTitle: "Pharmacy",
  promptMissingName: "A dose was heard without a medicine name.",
  promptUnclearName: (heard: string, suggestion: string) =>
    `Echo heard “${heard}”. It sounds like ${suggestion}, but it may have been misheard.`,
  promptUnknownName: (heard: string) =>
    `Echo heard “${heard}” before a dose. It is not a medicine name Echo knows.`,
  promptUnconfirmedName: (heard: string) =>
    `Echo heard “${heard}”, but a second listen did not hear it clearly.`,
  promptUnclearDose: (heard: string, suggestion: string) =>
    `Echo heard “${heard}”. It may have been ${suggestion}, but it may have been misheard.`,
  promptAsk: "Tap Please repeat to ask them to say the name and dose again.",
  playing: (range: string) => `Playing ${range}`,
  playFailed: "This part could not be played.",
  medicinesLoading: "Opening your list.",
  medicinesErrors: {
    empty: "Type a medicine name first.",
    invalid: "Type the name only, using letters. Leave out the dose.",
    duplicate: "That medicine is already on the list.",
    full: "The list is full (20 names). Remove one to add another.",
  },
  medicinesSaveFailed: "The list could not be saved on this phone. Nothing was sent anywhere.",
} as const;
