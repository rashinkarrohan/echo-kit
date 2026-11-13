/**
 * Echo Care copy not worded in docs/appendix/UI-SPEC.md (written by Kiro; neutral, no
 * advice; review before release). Spec wording comes from FINAL in @echo/ui.
 */
export const CARE = {
  appName: "Echo Care",
  loadingApp: "Opening Echo Care.",
  storageFallback:
    "This browser cannot keep data after you close the page. Nothing was sent anywhere.",
  readBackTitle: "Read back what you heard",
  toReceipt: "See the receipt",
  receiptHeading: (stage: "doctor" | "pharmacy", date: string) =>
    stage === "doctor" ? `Visit, ${date}` : `Pharmacy, ${date}`,
  toPharmacy: "At the pharmacy",
  checkLabel: "Check the label",
  labelTitle: "Check the label against what was said",
  labelNoMedicine: "No medicine was heard yet, so there is nothing to compare.",
  labelAgain: "Check another label",
  backToReceipt: "Back to the receipt",
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
  deleteVisit: "Delete this visit",
  deleted: "This visit was deleted from this phone.",
  startAgain: "Start a new visit",
  resume: "Resume",
  paused: "Paused. Nothing is recorded while paused.",
  recording: "Recording on this phone.",
  stopping: "Building the receipt.",
  promptMissingName: "A dose was heard without a medicine name.",
  promptUnclearName: (heard: string, suggestion: string) =>
    `“${heard}” sounds like ${suggestion}. It may have been misheard.`,
  playing: (range: string) => `Playing ${range}`,
  playFailed: "This part could not be played.",
  sampleBadge: "Sample consult (actors, no microphone)",
  noReceipt: "There is no receipt yet. Record a visit first.",
} as const;
