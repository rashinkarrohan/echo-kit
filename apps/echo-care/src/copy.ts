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
  receiptHeading: (date: string) => `Visit, ${date}`,
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
