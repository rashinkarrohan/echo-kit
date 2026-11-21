/**
 * The user's own medicines list: names they typed, kept only on this phone. Echo uses it
 * to prompt the speech engine and to match misheard names (engine `personal` list). It is
 * never put on a receipt or a shared summary, and it never confirms a name: a misheard
 * listed name is still shown as heard and marked Check this.
 */

export const MAX_MEDICINES = 20;

export type AddMedicineError = "empty" | "invalid" | "duplicate" | "full";
export type AddMedicineResult =
  | { ok: true; value: string[] }
  | { ok: false; error: AddMedicineError };

/** Letters, spaces, hyphens and apostrophes; 2 to 40 characters; starts with a letter. */
const NAME = /^[A-Za-z][A-Za-z' -]{1,39}$/;

const key = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, "");

/** Add a typed name to the list (returns a new list; never changes the one given). */
export function addMedicine(list: readonly string[], input: string): AddMedicineResult {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length === 0) return { ok: false, error: "empty" };
  if (!NAME.test(name) || key(name).length < 2) return { ok: false, error: "invalid" };
  if (list.some((n) => key(n) === key(name))) return { ok: false, error: "duplicate" };
  if (list.length >= MAX_MEDICINES) return { ok: false, error: "full" };
  return { ok: true, value: [...list, name] };
}

export function removeMedicine(list: readonly string[], name: string): string[] {
  return list.filter((n) => n !== name);
}
