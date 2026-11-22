/**
 * Second hearing for medicine names. The medicine prompt helps Whisper spell names, but it
 * can also make Whisper write a common prompted name for something else: on PriMock57 the
 * doctor said "antihistamines like cetirizine" (cut at a segment end) and the prompted pass
 * wrote "antistamins like acetaminophen", an exact name stamped Heard clearly. When a
 * prompted transcript contains exact names, the speech worker hears the same audio again
 * without the prompt; names that pass does not back up are marked Check this.
 *
 * Measured (docs/SPIKES.md, Nov 22, 2026): PriMock57, 20 of 20 correct names backed up and
 * the one substitution caught; the 48-clip bench, 33 of 34 correct names backed up.
 */
import type { DrugDictionary } from "../types";
import { normaliseText } from "../text/normalise";
import { drugDetector } from "./care-detectors";
import { confirmsName } from "./drug-match";
import { DRUG_DICTIONARY } from "./registry";

/** Exact medicine names in a text, in order (no "Sounds like" or unknown words). */
export function exactMedicineNames(
  text: string,
  dictionary: DrugDictionary = DRUG_DICTIONARY,
): string[] {
  return drugDetector
    .detect({ id: "x", index: 0, startMs: 0, endMs: 0, text }, dictionary)
    .filter((t) => t.suggestion === undefined && t.unknownName !== true)
    .map((t) => normaliseText(t.value));
}

/** Exact names in the prompted hearing that the unprompted hearing does not back up. */
export function promptOnlyNames(
  prompted: string,
  unprompted: string,
  dictionary: DrugDictionary = DRUG_DICTIONARY,
): string[] {
  return [...new Set(exactMedicineNames(prompted, dictionary))].filter(
    (name) => !confirmsName(name, unprompted),
  );
}
