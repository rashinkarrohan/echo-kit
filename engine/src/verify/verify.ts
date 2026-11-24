/**
 * Fact verifier for Echo Kit.
 * Assigns stamps: heard_clearly or check_this.
 *
 * A fact gets heard_clearly if:
 * - Every field value appears in its quote (normalized)
 * - If the speech engine reports word confidence, no word in the quote is below 0.6
 *   (the current Whisper adapter does not, so this only applies to engines that do)
 *
 * Otherwise it gets check_this.
 */

import type { DrugDictionary, Fact, Segment, VerifiedFact } from "../types";
import { DRUG_DICTIONARY } from "../guard/registry";
import { normaliseText } from "../text/normalise";
import { medicineNameNote } from "../guard/name-note";
import { unclearCounts } from "../guard/care-detectors";
import { containsPhrase } from "../validate/validate-fact";

export type { VerifiedFact } from "../types";

const LOW_CONFIDENCE = 0.6;

/**
 * Check if any word of the quote has low confidence.
 * Only applies when the speech engine reports per-word confidence (`segment.words`).
 * The current Whisper adapter does not, so for it this check never fires (docs/SPIKES.md).
 * Words are matched as whole words, so "a" never matches inside "metformin".
 */
function hasLowConfidenceInQuote(quote: string, segment: Segment): boolean {
  if (!segment.words || segment.words.length === 0) {
    return false;
  }

  // Normalising turns "five hundred" into "500", so the spoken words are checked too.
  const normalisedQuote = normaliseText(quote);
  const spokenQuote = quote
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const wordData of segment.words) {
    if (wordData.confidence >= LOW_CONFIDENCE) continue;
    const spoken = wordData.word
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();
    if (
      containsPhrase(normalisedQuote, normaliseText(wordData.word)) ||
      (spoken.length > 0 && containsPhrase(spokenQuote, spoken))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Verify facts and assign stamps.
 *
 * Stamp logic:
 * - heard_clearly: all field values in quote, name unambiguous, no low-confidence word (when reported)
 * - check_this: otherwise
 *
 * @param facts - Validated facts to verify
 * @param segments - All segments from conversation
 * @param dictionary - Medicine names, with the user's own list if they gave one
 * @returns Facts with stamps assigned
 */
export function verifyFacts(
  facts: Fact[],
  segments: Segment[],
  dictionary: DrugDictionary = DRUG_DICTIONARY,
): VerifiedFact[] {
  const verified: VerifiedFact[] = [];

  for (const fact of facts) {
    let stamp: "heard_clearly" | "check_this" = "heard_clearly";

    // Check 1: All field values must appear in the normalized quote
    const normalizedQuote = normaliseText(fact.anchor.quote);

    for (const value of Object.values(fact.fields)) {
      const normalizedValue = normaliseText(String(value));

      // Whole-word check: "5 mg" is not found inside "15 mg"
      if (!containsPhrase(normalizedQuote, normalizedValue)) {
        // Value not found in quote - needs checking
        stamp = "check_this";
        break;
      }
    }

    // Check 2: a drug name that is only a near match to the dictionary is unsure
    // Not an exact name, an unknown name, or an exact name that sounds like another medicine.
    if (
      stamp === "heard_clearly" &&
      fact.fields["name"] !== undefined &&
      medicineNameNote(fact.fields["name"], dictionary) !== undefined
    ) {
      stamp = "check_this";
    }

    // Check 2b: a dose heard as "to puffs" may have been 2; the line needs checking
    if (stamp === "heard_clearly" && unclearCounts(normalizedQuote).length > 0) {
      stamp = "check_this";
    }
    // Check 3: no low-confidence word in the quote (only when the engine reports confidence)
    if (stamp === "heard_clearly") {
      // Check all segments referenced by this fact
      for (const segId of fact.anchor.segmentIds) {
        const segment = segments.find((s) => s.id === segId);
        if (segment && hasLowConfidenceInQuote(fact.anchor.quote, segment)) {
          stamp = "check_this";
          break;
        }
      }
    }

    // Check 4: a medicine name only the prompted hearing wrote (the prompt may have put it
    // there; the same audio heard without the prompt did not back it up). Applies even when
    // another check already said Check this, so the receipt can say why.
    const name = fact.fields["name"];
    const unconfirmed =
      name !== undefined &&
      fact.anchor.segmentIds.some((id) =>
        (segments.find((s) => s.id === id)?.unconfirmedNames ?? []).some(
          (n) => normaliseText(n) === normaliseText(name),
        ),
      );

    verified.push({
      ...fact,
      stamp: unconfirmed ? "check_this" : stamp,
      ...(unconfirmed ? { checkReason: "unconfirmed-name" as const } : {}),
    });
  }

  return verified;
}
