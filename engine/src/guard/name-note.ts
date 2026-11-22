/**
 * Why a heard medicine name needs checking, for the receipt and captions. Never says
 * which medicine it is; only what it sounds like or could be mixed up with.
 */

import type { DrugDictionary } from "../types";
import { drugDetector } from "./care-detectors";
import { DRUG_DICTIONARY } from "./registry";

export type MedicineNameNote =
  /** Not an exact name; it sounds like this one */
  | { kind: "sounds-like"; name: string }
  /** An exact name that sounds like other real medicines */
  | { kind: "could-also-be"; names: string[] }
  /** Not a medicine name Echo knows */
  | { kind: "unknown" }
  /** An exact name that a second hearing, without the medicine list, did not back up */
  | { kind: "unconfirmed" };

/** The note for a heard name, or undefined when it is an exact name with no sound-alikes. */
export function medicineNameNote(
  heard: string,
  dictionary: DrugDictionary = DRUG_DICTIONARY,
): MedicineNameNote | undefined {
  const tokens = drugDetector.detect(
    { id: "name", index: 0, startMs: 0, endMs: 0, text: heard },
    dictionary,
  );
  const t = tokens[0];
  if (t === undefined || tokens.length > 1) return { kind: "unknown" };
  if (t.suggestion !== undefined) return { kind: "sounds-like", name: t.suggestion };
  if (t.soundsAlike !== undefined && t.soundsAlike.length > 0)
    return { kind: "could-also-be", names: t.soundsAlike };
  return undefined;
}
