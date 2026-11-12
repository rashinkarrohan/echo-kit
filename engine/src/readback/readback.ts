/**
 * Read-back: "I heard: metformin, 500 milligrams, twice daily."
 *
 * Items are confirmed only by an explicit user mark (applyMark). scoreReadBack compares
 * the numbers and names in a spoken or typed answer with each item, and reports what
 * was found and missing; it never marks anything itself.
 */

import type { Fact, ReadBackItem, ReadBackMark, ReadBackScore } from '../types';
import { normaliseText } from '../text/normalise';
import { containsPhrase, numbersIn } from '../validate/validate-fact';

const NAME_FIELDS = ['name'];

export function buildReadBack(facts: Fact[], keys?: string[]): ReadBackItem[] {
  const counts = new Map<string, number>();
  const items: ReadBackItem[] = [];

  for (const fact of facts) {
    if (keys && !keys.includes(fact.key)) continue;
    const values = Object.values(fact.fields).filter((v) => typeof v === 'string' && v.trim().length > 0);
    if (values.length === 0) continue;

    const n = (counts.get(fact.key) ?? 0) + 1;
    counts.set(fact.key, n);

    items.push({
      factKey: `${fact.key}-${n}`,
      key: fact.key,
      heard: values.join(', '),
      names: NAME_FIELDS.map((f) => fact.fields[f]).filter((v): v is string => typeof v === 'string' && v.length > 0),
      mark: 'unmarked',
      anchor: fact.anchor,
    });
  }

  return items;
}

export function applyMark(items: ReadBackItem[], factKey: string, mark: ReadBackMark): ReadBackItem[] {
  return items.map((item) => (item.factKey === factKey ? { ...item, mark } : item));
}

/** Numbers and names to listen for in an answer, normalised. */
function expectedTokens(item: ReadBackItem): string[] {
  const tokens = [...item.names.map(normaliseText), ...numbersIn(normaliseText(item.heard))];
  return [...new Set(tokens.filter((t) => t.length > 0))];
}

export function scoreReadBack(items: ReadBackItem[], userText: string): ReadBackScore[] {
  const answer = normaliseText(userText);
  return items.map((item) => {
    const expected = expectedTokens(item);
    const found = expected.filter((t) => containsPhrase(answer, t));
    const missing = expected.filter((t) => !found.includes(t));
    const match: ReadBackScore['match'] =
      expected.length > 0 && missing.length === 0 ? 'full' : found.length > 0 ? 'partial' : 'none';
    return { factKey: item.factKey, match, found, missing };
  });
}

/** Numbers the user said that are in no read-back item (worth a "Check this"). */
export function unexpectedNumbers(items: ReadBackItem[], userText: string): string[] {
  const known = new Set(items.flatMap((i) => numbersIn(normaliseText(i.heard))));
  return [...new Set(numbersIn(normaliseText(userText)))].filter((n) => !known.has(n));
}
