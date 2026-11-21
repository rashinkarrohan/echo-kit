/**
 * "Please repeat" prompts for medicine names, raised while recording so the user can
 * ask straight away (UI: the speaker card "Please say the medicine name and the dose
 * again, slowly.").
 *
 * - missing-medicine-name: a dose with a unit (mg, ml, units...) was heard, but no drug
 *   name in this segment or the one before. The speech engine may have misheard it.
 * - unclear-medicine-name: a word only sounds like a known drug. `suggestion` is what
 *   it sounds like; the heard word is never replaced.
 * - unknown-medicine-name: a word just before a dose is not a medicine name Echo knows
 *   ("paramet 500 mg"). Echo does not guess what it is.
 * - unclear-dose: a count heard as "to puffs" or "too tablets"; it may have been 2.
 *
 * Prompts only ask; they never say what the medicine is.
 */

import type { FlaggedToken, Segment } from "../types";

export type RepeatPromptKind =
  | "missing-medicine-name"
  | "unclear-medicine-name"
  | "unknown-medicine-name"
  | "unclear-dose";

export interface RepeatPrompt {
  kind: RepeatPromptKind;
  segmentId: string;
  heard?: string;
  suggestion?: string;
}

export interface FlaggedSegment {
  segment: Segment;
  tokens: FlaggedToken[];
}

const DOSE_UNIT =
  /\d\s*(mg|mcg|g|ml|milligrams?|micrograms?|millilitres?|milliliters?|grams?|units?)$/;

export function repeatPrompts(current: FlaggedSegment, previous?: FlaggedSegment): RepeatPrompt[] {
  const prompts: RepeatPrompt[] = [];
  const segmentId = current.segment.id;

  for (const t of current.tokens) {
    if (t.kind === "drug" && t.suggestion !== undefined) {
      prompts.push({
        kind: "unclear-medicine-name",
        segmentId,
        heard: t.value,
        suggestion: t.suggestion,
      });
    } else if (t.kind === "drug" && t.unknownName === true) {
      prompts.push({ kind: "unknown-medicine-name", segmentId, heard: t.value });
    } else if (t.kind === "number" && t.suggestion !== undefined) {
      prompts.push({ kind: "unclear-dose", segmentId, heard: t.value, suggestion: t.suggestion });
    }
  }

  const hasDose = current.tokens.some((t) => t.kind === "number" && DOSE_UNIT.test(t.value));
  const drugNearby = [...current.tokens, ...(previous?.tokens ?? [])].some(
    (t) => t.kind === "drug",
  );
  if (hasDose && !drugNearby) {
    prompts.push({ kind: "missing-medicine-name", segmentId });
  }

  return prompts;
}
