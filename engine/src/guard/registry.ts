/**
 * Detector registry: schemas name detectors by id; this maps ids to implementations.
 * Also provides the shared cue matcher used by the extractor and the gap check.
 */

import type { EntityDetector, FlaggedToken, Segment } from "../types";
import { normaliseText } from "../text/normalise";
import { numberDetector, frequencyDetector, dateDetector, drugDetector } from "./care-detectors";
import {
  moneyDetector,
  percentDetector,
  durationDetector,
  commissionDetector,
} from "./cover-detectors";
import drugsData from "../../data/drugs.sample.json";

export const DETECTORS: Readonly<Record<string, EntityDetector>> = {
  number: numberDetector,
  drug: drugDetector,
  frequency: frequencyDetector,
  date: dateDetector,
  money: moneyDetector,
  percent: percentDetector,
  duration: durationDetector,
  commission: commissionDetector,
};

/** Sample drug dictionary (marked "sample": true; the real list is a spike). */
export const DRUG_DICTIONARY: { drugs: string[] } = { drugs: drugsData.drugs };

export function getDetector(id: string): EntityDetector | undefined {
  return Object.prototype.hasOwnProperty.call(DETECTORS, id) ? DETECTORS[id] : undefined;
}

/** Detectors for a list of ids; unknown ids are skipped (validateSchema rejects them earlier). */
export function detectorsFor(ids: readonly string[]): EntityDetector[] {
  return ids.map(getDetector).filter((d): d is EntityDetector => d !== undefined);
}

/** Run one detector id on a segment, if the schema enables it. */
export function detectWith(
  id: string,
  segment: Segment,
  enabled: readonly string[],
): FlaggedToken[] {
  if (!enabled.includes(id)) return [];
  const detector = getDetector(id);
  if (!detector) return [];
  return detector.detect(segment, DRUG_DICTIONARY);
}

/**
 * Does a cue alternative match a segment?
 *
 * An alternative is a case-insensitive regular expression or a detector reference
 * `@id`. Mixed forms such as `@frequency|morning|evening` are split on `|` and each
 * part is tried. Regexes are tried against the normalised text and the lowercased
 * original text, so cues with apostrophes or number words still match.
 */
export function matchesCue(
  alternative: string,
  segment: Segment,
  enabled: readonly string[],
): boolean {
  const parts = alternative.includes("@") ? alternative.split("|") : [alternative];
  const normalised = normaliseText(segment.text);
  const original = segment.text.toLowerCase();

  return parts.some((part) => {
    const alt = part.trim();
    if (alt.length === 0) return false;
    if (alt.startsWith("@")) {
      return detectWith(alt.slice(1), segment, enabled).length > 0;
    }
    let regex: RegExp;
    try {
      regex = new RegExp(alt, "i");
    } catch {
      const literal = alt.toLowerCase();
      return normalised.includes(literal) || original.includes(literal);
    }
    return regex.test(normalised) || regex.test(original);
  });
}
