/**
 * Copy deck. Strings under FINAL are verbatim from docs/appendix/UI-SPEC.md.
 * Strings under ADDED were written by Kiro for states the spec does not word
 * (neutral, no advice); review them before release.
 */

import { CONSENT_WORDING } from "@echo/engine";
import type { MedicineNameNote } from "@echo/engine";

export const FINAL = {
  consentWording: CONSENT_WORDING,
  disclaimerCare:
    "Echo records and summarises what was said. It is not medical advice and not an interpreter.",
  disclaimerCover:
    "Echo compares what sellers said. It is not legal or financial advice and it does not recommend a purchase.",
  captionUncertainty:
    "Captions can be wrong. Numbers and medicine names are highlighted so you can check them.",
  micDenied:
    "Echo can't hear anything yet. Allow the microphone in your browser settings, then try again.",
  modelLoading: "Getting ready. This happens once and then works without internet.",
  genericError: "Something went wrong. Nothing was sent anywhere. Try again.",

  consentTitle: "Before we start",
  consentRecord: "Record this conversation",
  consentTranscribe: "Turn speech into text on my phone",
  consentShare: "Share a summary (off unless I choose)",
  consentAgree: "I agree and continue",
  consentLearnMore: "Learn how my data is kept",

  doctorCard:
    "I have hearing loss. Please face me and speak slowly. May I record this visit so I can check what you said?",
  doctorCardStart: "They agreed, start",
  skip: "Skip",
  pharmacistCard:
    "I have hearing loss. Please write down how to take each medicine and any side effects, and speak slowly.",
  pleaseRepeat: "Please repeat",
  pleaseRepeatCard: "Please say the medicine name and the dose again, slowly.",
  done: "Done",
  pause: "Pause",
  stopAndReview: "Stop and review",

  readBackPrefix: "I heard: ",
  right: "Right",
  notRight: "Not right",
  showTheDoctor: "Show the doctor",

  heardClearly: "Heard clearly",
  checkThis: "Check this",
  notSaid: "Not said",
  answered: "Answered",
  notDiscussed: "Not discussed",
  unclear: "Unclear",
  hearIt: "Hear it",
  slower: "Slower",
  differs: "Differs",
  questionsPlanned: "Questions I planned",
  questionsBeforeYouBuy: "Questions to ask before you buy",
  source: "Source",
  playSampleConsult: "Play sample consult",
  share: "Share",
  shareNoAudio: "Share (no audio)",
  shareWarning: "A file you send can't be taken back.",
  labelTakePhoto: "Take a photo of the label",
  labelTypeIt: "Type it in",
  labelMedicine: "Medicine",
  labelDose: "Dose",
  labelHowOften: "How often",
  labelMatches: "Matches what was said",
  labelFlag: (said: string, printed: string) =>
    `Said: ${said}. Printed: ${printed}. Check with your pharmacist or doctor.`,
} as const;

export const ADDED = {
  captionsEmpty: "Captions will appear here when someone speaks.",
  silentSegment: "(no speech)",
  receiptTitle: "What was said",
  receiptLoading: "Building the receipt.",
  receiptEmpty: "No facts were heard in this conversation.",
  stampLegend: "What the stamps mean",
  checklistEmpty: "No questions in this list.",
  compareTitle: "What each seller said",
  compareEmpty: "Record at least two sellers to compare them.",
  compareScrollLabel: "Comparison table, scrolls sideways",
  readBackEmpty: "No medicines to read back.",
  readBackUnmarked: "Not marked yet",
  readBackMarkedRight: "Marked right",
  readBackMarkedNotRight: "Marked not right",
  audioNotKept: "Audio not kept",
  /** Short hints next to a medicine name in the captions */
  hintSoundsLike: (name: string) => `Sounds like ${name}?`,
  hintCouldAlsoBe: (names: readonly string[]) => `Could also be ${names.join(" or ")}?`,
  hintUnknown: "Not a medicine name Echo knows",
  /** Hint after a dose heard as "to puffs" (speech engines write "two" as "to") */
  hintUnclearDose: (suggestion: string) => `Sounds like ${suggestion}?`,
  flagged: "flagged",
  loading: "Loading.",
  trustTitle: "How Echo did in tests",
  trustIntro: (n: number) =>
    `Results from ${n} scripted test conversations read by actors. Every fact Echo keeps must quote the conversation word for word.`,
  trustKept: "Facts kept",
  trustDropped: "Facts missed",
  trustInvented: "Facts made up",
  trustUnanchored: "Facts without a quote",
  trustTargetZero: "target 0",
  trustRecall: "Numbers and names flagged",
  trustChecklist: "Questions marked correctly",
  trustRuns: "Test runs",
  trustDate: "Last run",
  trustMissing: "No test results are bundled with this copy of the app.",
  trustLimits:
    "These are scripted test conversations, not real visits. Real speech can be harder to hear.",
  trustLink: "Test results",
  shareTitle: "what was said",
  shareFor: (name: string) => `For: ${name}`,
  shareNote: (date: string) => `Made on ${date} on the patient's own phone. It has no audio.`,
  shareReadBack: "Read back",
  shareLabel: "Label check",
  photoNotKept: "The photo stays on this screen and is not kept.",
  photoAlt: "Your photo of the label",
  labelCompare: "Compare with what was said",
  labelDifferences: "Differences between what was said and the label",
  labelWhereSaid: "Where it was said",
} as const;

/** Display names for schema fact keys and fields (ADDED; compare-row names from UI-SPEC). */
export const FACT_LABELS: Record<string, string> = {
  medicine: "Medicine",
  follow_up: "Follow-up",
  warning_sign: "Warning sign",
  side_effects: "Side effects",
  missed_dose: "If a dose is missed",
  price: "Price",
  inclusions: "What is included",
  trial_returns: "Trial and returns",
  financing: "Financing",
  commission: "Commission",
};

export const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  dose: "Dose",
  strength: "Strength",
  frequency: "How often",
  how_to_take: "How to take",
  duration: "For how long",
  when: "When",
  what: "What",
  description: "Said",
  amount: "Amount",
  per: "Per",
  period: "Period",
  terms: "Terms",
  rate: "Rate",
  term: "Term",
  monthly: "Monthly",
  statement: "Said",
};

/** "how_to_take" -> "How to take", for keys with no label. */
export function humanise(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function factLabel(key: string, labels: Record<string, string> = FACT_LABELS): string {
  return labels[key] ?? humanise(key);
}

export function fieldLabel(key: string, labels: Record<string, string> = FIELD_LABELS): string {
  return labels[key] ?? humanise(key);
}

/** 6500 -> "0:06" */
export function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Short hint for a medicine name in the captions (ADDED). */
export function medicineHintText(note: MedicineNameNote): string {
  if (note.kind === "sounds-like") return ADDED.hintSoundsLike(note.name);
  if (note.kind === "could-also-be") return ADDED.hintCouldAlsoBe(note.names.slice(0, 2));
  return ADDED.hintUnknown;
}

/**
 * Why a medicine on the receipt needs checking, in plain words (ADDED). Says what was
 * heard and what it sounds like; never says which medicine it is.
 */
export function medicineNoteText(heard: string, note: MedicineNameNote): string {
  const check = "Check the name on the label or with your pharmacist.";
  if (note.kind === "sounds-like")
    return `Echo heard “${heard}”. It sounds like ${note.name}. ${check}`;
  if (note.kind === "unknown")
    return `Echo heard “${heard}”. This is not a medicine name Echo knows. ${check}`;
  const name = heard.charAt(0).toUpperCase() + heard.slice(1);
  return `${name} sounds like ${note.names.slice(0, 2).join(" or ")}. Check which one is on the label.`;
}

/** Why a medicine's dose on the receipt needs checking: a count heard as "to puffs". */
export function doseNoteText(heard: string, suggestion: string): string {
  return `Echo heard “${heard}”. It may have been ${suggestion}. Check the dose on the label or with your pharmacist.`;
}
