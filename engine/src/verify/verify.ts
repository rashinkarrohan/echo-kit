/**
 * Fact verifier for Echo Kit.
 * Assigns stamps: heard_clearly or check_this.
 *
 * A fact gets heard_clearly if:
 * - Every field value appears in its quote (normalized)
 * - No word in the quote has low confidence (< 0.6)
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

/**
 * Check if any word in the segment's quote region has low confidence.
 */
function hasLowConfidenceInQuote(quote: string, segment: Segment): boolean {
  if (!segment.words || segment.words.length === 0) {
    return false;
  }

  const normalizedQuote = normaliseText(quote).toLowerCase();

  // Check all words in the segment
  for (const wordData of segment.words) {
    const normalizedWord = normaliseText(wordData.word).toLowerCase();

    // If this word appears in the quote and has low confidence, flag it
    if (normalizedQuote.includes(normalizedWord) && wordData.confidence < 0.6) {
      return true;
    }

    // Also check if the original word (before normalization) appears in original quote
    const originalWord = wordData.word.toLowerCase();
    const originalQuote = quote.toLowerCase();
    if (originalQuote.includes(originalWord) && wordData.confidence < 0.6) {
      return true;
    }
  }

  return false;
}

/**
 * Verify facts and assign stamps.
 *
 * Stamp logic:
 * - heard_clearly: all field values in quote, no low confidence
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
    // Check 3: No low confidence tokens in the quote
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
