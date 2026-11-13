/**
 * Echo Cover copy not worded in docs/appendix/UI-SPEC.md (written by Kiro; neutral, no
 * advice, no ranking; review before release). Spec wording comes from FINAL in @echo/ui.
 */
export const COVER = {
  appName: "Echo Cover",
  loadingApp: "Opening Echo Cover.",
  sellerName: "Who are you talking to?",
  sellerNeeded: "Type a name for this seller first.",
  startRecordingSeller: "Start recording a seller",
  startRecording: "Start recording",
  recording: (seller: string) => `Recording the conversation with ${seller} on this phone.`,
  stopping: "Putting together what was said.",
  reviewTitle: (seller: string) => `${seller}: questions`,
  saidTitle: (seller: string) => `${seller}: what was said`,
  recordAnother: "Record another seller",
  compare: "Compare sellers",
  confirm: "Draft a message to confirm in writing",
  confirmTitle: (seller: string) => `Message to ${seller}`,
  copyMessage: "Copy message",
  copied: "Copied. Paste it into an email or text message.",
  copyFailed: "Could not copy. Select the message and copy it yourself.",
  notSent: "Echo does not send anything. Keep the reply.",
  sellersSoFar: "Sellers recorded",
  noSellers: "No sellers recorded yet.",
  playing: (range: string) => `Playing ${range}`,
  playFailed: "This part could not be played.",
  sampleBadge: "Sample sales (actors, fictional prices, no microphone)",
  backToCompare: "Back to the comparison",
  questionsHint: "Tick the ones you plan to ask.",
  planned: "I plan to ask this",
  sampleIntro:
    "Try Echo Cover with sample sales conversations read by actors, with fictional prices. No microphone, and nothing is kept.",
} as const;
