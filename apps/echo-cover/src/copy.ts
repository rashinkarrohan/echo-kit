/**
 * Echo Cover copy not worded in docs/appendix/UI-SPEC.md (written by Kiro; neutral, no
 * advice, no ranking; review before release). Spec wording comes from FINAL in @echo/ui.
 */
export const COVER = {
  openSaved: "Open saved comparisons",
  savedLoading: "Opening saved seller conversations.",
  savedError: "Saved seller conversations could not be opened. Nothing was sent anywhere.",
  loadingApp: "Opening Echo Cover.",
  sellerNeeded: "Type a seller or clinic name first.",
  sellerDuplicate: "Use a different name so the sellers are easy to tell apart.",
  consentNeeded: "Return to Before we start and give consent before recording.",
  playing: (range: string) => `Playing ${range}`,
  playFailed: "This part could not be played.",
  storageFallback:
    "This browser cannot keep comparisons after you close the page. Nothing was sent anywhere.",
} as const;
